import test from 'node:test';
import assert from 'node:assert/strict';
import { YokaiDatabase } from './db';

test('YokaiDatabase enforces unique usernames, hashes secrets, isolates players, and restores customizations', () => {
  const db = new YokaiDatabase(':memory:');
  try {
    const regA = db.registerPlayer({
      username: 'Kenshin',
      password: 'HunterPass1',
      confirmPassword: 'HunterPass1',
      gender: 'male',
      recoveryQuestion: 'Spirit Animal',
      recoveryAnswer: 'White Wolf',
    });
    assert.equal(regA.ok, true);
    if (!regA.ok) return;

    assert.match(regA.player.playerId, /^YH-\d+$/);
    assert.equal(regA.player.gender, 'male');

    // Duplicate username (case-insensitive) must be rejected
    const dup = db.registerPlayer({
      username: 'kenshin',
      password: 'AnotherPassword1',
      confirmPassword: 'AnotherPassword1',
      gender: 'female',
      recoveryAnswer: 'Owl',
    });
    assert.equal(dup.ok, false);
    if (!dup.ok) {
      assert.equal(dup.status, 409);
    }

    // Second account receives distinct Player ID
    const regB = db.registerPlayer({
      username: 'Sakura',
      password: 'SakuraPass1',
      confirmPassword: 'SakuraPass1',
      gender: 'female',
      recoveryAnswer: 'Lotus',
    });
    assert.equal(regB.ok, true);
    if (!regB.ok) return;
    assert.notEqual(regA.player.playerId, regB.player.playerId);

    // Update Player A customization (legacy eye/facial keys if injected must be stripped cleanly)
    const updatedA = db.updatePlayerCustomization(regA.player.playerId, 'male', {
      costume: 'moonlit_azure',
      hairStyle: 'high_ponytail',
      hairColor: 'silver_moon',
      sword: 'azure_odachi',
      superpower: 'void_lightning',
      ...({ eyeShape: 'crescent_fox', eyeColor: 'crimson_blood', facialFeature: 'blade_scar' } as Record<string, string>),
    });
    assert.ok(updatedA);
    assert.equal(updatedA.maleCustomization.costume, 'moonlit_azure');
    assert.equal(updatedA.maleCustomization.sword, 'azure_odachi');
    assert.equal('eyeShape' in updatedA.maleCustomization, false);
    assert.equal('eyeColor' in updatedA.maleCustomization, false);
    assert.equal('facialFeature' in updatedA.maleCustomization, false);

    // Player B must remain untouched
    const fetchedB = db.getPlayerBySession(regB.sessionToken);
    assert.ok(fetchedB);
    assert.equal(fetchedB.femaleCustomization.costume, 'shadow_hunter');
    assert.equal(fetchedB.femaleCustomization.sword, 'moonfang_katana');
    assert.equal('eyeShape' in fetchedB.femaleCustomization, false);
    assert.equal('eyeColor' in fetchedB.femaleCustomization, false);
    assert.equal('facialFeature' in fetchedB.femaleCustomization, false);

    // Logout & Forgot Password for Player A
    db.deleteSession(regA.sessionToken);
    assert.equal(db.getPlayerBySession(regA.sessionToken), null);

    const badReset = db.resetPassword({
      username: 'Kenshin',
      recoveryAnswer: 'Wrong Animal',
      newPassword: 'NewHunterPass2',
      confirmNewPassword: 'NewHunterPass2',
    });
    assert.equal(badReset.ok, false);

    const goodReset = db.resetPassword({
      username: 'Kenshin',
      recoveryAnswer: 'white wolf',
      newPassword: 'NewHunterPass2',
      confirmNewPassword: 'NewHunterPass2',
    });
    assert.equal(goodReset.ok, true);

    // Old password must fail, new password must succeed and restore saved customization
    const oldLogin = db.loginPlayer({ username: 'Kenshin', password: 'HunterPass1' });
    assert.equal(oldLogin.ok, false);

    const newLogin = db.loginPlayer({ username: 'Kenshin', password: 'NewHunterPass2' });
    assert.equal(newLogin.ok, true);
    if (newLogin.ok) {
      assert.equal(newLogin.player.playerId, regA.player.playerId);
      assert.equal(newLogin.player.maleCustomization.costume, 'moonlit_azure');
      assert.equal(newLogin.player.maleCustomization.superpower, 'void_lightning');
    }
  } finally {
    db.close();
  }
});
