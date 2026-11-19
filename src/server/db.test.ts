import test from 'node:test';
import assert from 'node:assert/strict';
import { YokaiDatabase } from './db';

test('YokaiDatabase supports registration + login via Username & Player ID, isolates players, and enforces level progression', () => {
  const db = new YokaiDatabase(':memory:');
  try {
    // 1. Register Player A with a custom Player ID
    const regA = db.registerPlayer({
      username: 'Kenshin',
      playerId: 'YH-KENS-01',
      password: 'HunterPass1',
      confirmPassword: 'HunterPass1',
      gender: 'male',
      recoveryQuestion: 'Spirit Animal',
      recoveryAnswer: 'White Wolf',
    });
    assert.equal(regA.ok, true);
    if (!regA.ok) return;

    assert.equal(regA.player.playerId, 'YH-KENS-01');
    assert.equal(regA.player.gender, 'male');
    assert.equal(regA.player.level, 1);
    assert.equal(regA.player.xp, 0);

    // Duplicate username or duplicate Player ID (case-insensitive) must be rejected
    const dupUser = db.registerPlayer({
      username: 'kenshin',
      playerId: 'YH-OTHER-99',
      password: 'AnotherPassword1',
      confirmPassword: 'AnotherPassword1',
      gender: 'female',
      recoveryAnswer: 'Owl',
    });
    assert.equal(dupUser.ok, false);
    if (!dupUser.ok) assert.equal(dupUser.status, 409);

    const dupPid = db.registerPlayer({
      username: 'AnotherHunter',
      playerId: 'yh-kens-01',
      password: 'AnotherPassword1',
      confirmPassword: 'AnotherPassword1',
      gender: 'female',
      recoveryAnswer: 'Owl',
    });
    assert.equal(dupPid.ok, false);
    if (!dupPid.ok) assert.equal(dupPid.status, 409);

    // 2. Register Player B without custom Player ID (auto-assigned YH-100XX)
    const regB = db.registerPlayer({
      username: 'Sakura',
      password: 'SakuraPass1',
      confirmPassword: 'SakuraPass1',
      gender: 'female',
      recoveryAnswer: 'Lotus',
    });
    assert.equal(regB.ok, true);
    if (!regB.ok) return;
    assert.match(regB.player.playerId, /^YH-\d+$/);
    assert.notEqual(regA.player.playerId, regB.player.playerId);

    // 3. Level 1 Archery-only enforcement on server
    const lockedCustom = db.updatePlayerCustomization(regA.player.playerId, 'male', {
      costume: 'moonlit_azure',
    });
    assert.equal(lockedCustom.ok, false);
    if (!lockedCustom.ok) {
      assert.equal(lockedCustom.status, 403);
      assert.match(lockedCustom.error, /Unlock at Level 2/);
    }

    const lockedSwordHit = db.recordActivityProgress(regA.player.playerId, 'sword_combat');
    assert.equal(lockedSwordHit.ok, false);
    if (!lockedSwordHit.ok) {
      assert.equal(lockedSwordHit.status, 403);
    }

    const lockedPowerHit = db.recordActivityProgress(regA.player.playerId, 'superpower_burst');
    assert.equal(lockedPowerHit.ok, false);
    if (!lockedPowerHit.ok) {
      assert.equal(lockedPowerHit.status, 403);
    }

    // 4. Perform 4 Archery hits for Player A (4 x 25 XP = 100 XP -> Level 2!)
    for (let i = 0; i < 3; i++) {
      const hit = db.recordActivityProgress(regA.player.playerId, 'archery');
      assert.equal(hit.ok, true);
      if (hit.ok) assert.equal(hit.leveledUp, false);
    }
    const levelUpHit = db.recordActivityProgress(regA.player.playerId, 'archery');
    assert.equal(levelUpHit.ok, true);
    if (!levelUpHit.ok) return;
    assert.equal(levelUpHit.leveledUp, true);
    assert.equal(levelUpHit.player.level, 2);
    assert.equal(levelUpHit.player.xp, 100);
    assert.equal(levelUpHit.player.orbsCleared, 4);

    // Player B must remain isolated at Level 1!
    const fetchedB = db.getPlayerBySession(regB.sessionToken);
    assert.ok(fetchedB);
    assert.equal(fetchedB.level, 1);
    assert.equal(fetchedB.xp, 0);
    const lockedB = db.updatePlayerCustomization(regB.player.playerId, 'female', {
      costume: 'moonlit_azure',
    });
    assert.equal(lockedB.ok, false);

    // Player A (now Level 2) can equip Level 2 items (legacy eye/facial keys still stripped), while Level 3 remains locked
    const lvl3Blocked = db.updatePlayerCustomization(regA.player.playerId, 'male', {
      superpower: 'void_lightning',
    });
    assert.equal(lvl3Blocked.ok, false);

    const lvl3HairBlocked = db.updatePlayerCustomization(regA.player.playerId, 'male', {
      hairColor: 'silver_moon',
    });
    assert.equal(lvl3HairBlocked.ok, false);

    const updatedA = db.updatePlayerCustomization(regA.player.playerId, 'male', {
      costume: 'moonlit_azure',
      hairStyle: 'high_ponytail',
      hairColor: 'midnight_indigo',
      sword: 'dragonfire_jian',
      archery: 'moonlight_crescent',
      ...({ eyeShape: 'crescent_fox', eyeColor: 'crimson_blood', facialFeature: 'blade_scar' } as Record<string, string>),
    });
    assert.equal(updatedA.ok, true);
    if (!updatedA.ok) return;
    assert.equal(updatedA.player.maleCustomization.costume, 'moonlit_azure');
    assert.equal(updatedA.player.maleCustomization.sword, 'dragonfire_jian');
    assert.equal('eyeShape' in updatedA.player.maleCustomization, false);

    // 5. Logout & Login with Name + Player ID (no password) AND Name + Password
    db.deleteSession(regA.sessionToken);
    assert.equal(db.getPlayerBySession(regA.sessionToken), null);

    const wrongPidLogin = db.loginPlayer({ username: 'Kenshin', playerId: 'YH-WRONG' });
    assert.equal(wrongPidLogin.ok, false);

    const idLogin = db.loginPlayer({ username: 'kenshin', playerId: 'yh-kens-01' });
    assert.equal(idLogin.ok, true);
    if (idLogin.ok) {
      assert.equal(idLogin.player.playerId, 'YH-KENS-01');
      assert.equal(idLogin.player.level, 2);
      assert.equal(idLogin.player.xp, 100);
      assert.equal(idLogin.player.maleCustomization.costume, 'moonlit_azure');
      assert.equal(idLogin.player.maleCustomization.archery, 'moonlight_crescent');
    }

    // 6. Password reset still works cleanly
    const goodReset = db.resetPassword({
      username: 'Kenshin',
      recoveryAnswer: 'white wolf',
      newPassword: 'NewHunterPass2',
      confirmNewPassword: 'NewHunterPass2',
    });
    assert.equal(goodReset.ok, true);

    const oldLogin = db.loginPlayer({ username: 'Kenshin', password: 'HunterPass1' });
    assert.equal(oldLogin.ok, false);

    const newLogin = db.loginPlayer({ username: 'Kenshin', password: 'NewHunterPass2' });
    assert.equal(newLogin.ok, true);
    if (newLogin.ok) {
      assert.equal(newLogin.player.playerId, 'YH-KENS-01');
      assert.equal(newLogin.player.level, 2);
    }

    // 7. Kodama Archery Challenge diamonds, round pass/fail, and Stage 2 unlock per player
    for (let i = 0; i < 6; i++) {
      const kh = db.awardKodamaHit(regA.player.playerId);
      assert.equal(kh.ok, true);
    }
    const failRound = db.completeKodamaRound(regA.player.playerId, 1, 5);
    assert.equal(failRound.ok, true);
    if (failRound.ok) {
      assert.equal(failRound.passed, false);
      assert.equal(failRound.player.kodamaProgress.diamonds, 6);
      assert.deepEqual(failRound.player.kodamaProgress.completedRounds, []);
      assert.equal(failRound.player.kodamaProgress.stage2Unlocked, false);
    }

    for (let r = 1; r <= 4; r++) {
      const passR = db.completeKodamaRound(regA.player.playerId, r, 6);
      assert.equal(passR.ok, true);
      if (passR.ok) {
        assert.equal(passR.passed, true);
        assert.equal(passR.player.kodamaProgress.stage2Unlocked, false);
      }
    }
    const passR5 = db.completeKodamaRound(regA.player.playerId, 5, 8);
    assert.equal(passR5.ok, true);
    if (passR5.ok) {
      assert.equal(passR5.stage2JustUnlocked, true);
      assert.equal(passR5.player.kodamaProgress.stage2Unlocked, true);
      assert.deepEqual(passR5.player.kodamaProgress.completedRounds, [1, 2, 3, 4, 5]);
    }

    // Player B's Kodama progress remains completely isolated at 0 diamonds / Stage 2 locked
    const bAfter = db.getPlayerBySession(regB.sessionToken);
    assert.ok(bAfter);
    assert.equal(bAfter.kodamaProgress.diamonds, 0);
    assert.deepEqual(bAfter.kodamaProgress.completedRounds, []);
    assert.equal(bAfter.kodamaProgress.stage2Unlocked, false);
  } finally {
    db.close();
  }
});
