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

    // 7. Kodama Archery Challenge diamonds (0 for wall, 1 for crossing), ghostKey deduplication, round pass/fail, and Stage 2 unlock
    for (let i = 0; i < 4; i++) {
      const kh = db.awardKodamaHit(regA.player.playerId, 'wall', `run1:wall-${i}`);
      assert.equal(kh.ok, true);
      if (kh.ok) {
        assert.equal(kh.diamondAwarded, 0);
        assert.equal(kh.player.kodamaProgress.diamonds, 0);
      }
    }
    const specialHit = db.awardKodamaHit(regA.player.playerId, 'crossing', 'run1:crossing-1');
    assert.equal(specialHit.ok, true);
    if (specialHit.ok) {
      assert.equal(specialHit.diamondAwarded, 1);
      assert.equal(specialHit.alreadyRewarded, false);
      assert.equal(specialHit.player.kodamaProgress.diamonds, 1);
    }

    // Duplicate ghostKey must NOT grant another diamond
    const dupHit = db.awardKodamaHit(regA.player.playerId, 'crossing', 'run1:crossing-1');
    assert.equal(dupHit.ok, true);
    if (dupHit.ok) {
      assert.equal(dupHit.diamondAwarded, 0);
      assert.equal(dupHit.alreadyRewarded, true);
      assert.equal(dupHit.player.kodamaProgress.diamonds, 1);
    }

    const failRound = db.completeKodamaRound(regA.player.playerId, 1, 5);
    assert.equal(failRound.ok, true);
    if (failRound.ok) {
      assert.equal(failRound.passed, false);
      assert.equal(failRound.player.kodamaProgress.diamonds, 1);
      assert.deepEqual(failRound.player.kodamaProgress.completedRounds, []);
      assert.equal(failRound.player.kodamaProgress.stage2Unlocked, false);
    }

    const roundMinHits = [6, 8, 10, 12];
    for (let r = 1; r <= 4; r++) {
      const passR = db.completeKodamaRound(regA.player.playerId, r, roundMinHits[r - 1]);
      assert.equal(passR.ok, true);
      if (passR.ok) {
        assert.equal(passR.passed, true);
        assert.equal(passR.player.kodamaProgress.stage2Unlocked, false);
      }
    }
    const failR5 = db.completeKodamaRound(regA.player.playerId, 5, 13);
    assert.equal(failR5.ok, true);
    if (failR5.ok) {
      assert.equal(failR5.passed, false);
      assert.equal(failR5.player.kodamaProgress.stage2Unlocked, false);
    }

    const passR5 = db.completeKodamaRound(regA.player.playerId, 5, 14);
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

test('YokaiDatabase supports Email registration, first-login profile setup, profile settings updates, and Email re-login', () => {
  const db = new YokaiDatabase(':memory:');
  try {
    const reg = db.registerPlayer({
      email: 'Kuro.Archer@Example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    assert.equal(reg.player.email, 'kuro.archer@example.com');
    assert.equal(reg.player.profileCompleted, false);

    // Register another player to verify player name conflict rejection on updatePlayerProfile
    const other = db.registerPlayer({
      email: 'taken@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    db.updatePlayerProfile(other.player.playerId, { username: 'TakenName', gender: 'male' });

    const conflict = db.updatePlayerProfile(reg.player.playerId, {
      username: 'takenname',
      gender: 'female',
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.status, 409);

    // Complete first-login profile setup
    const setup = db.updatePlayerProfile(reg.player.playerId, {
      username: 'AoiShadow',
      gender: 'female',
    });
    assert.equal(setup.ok, true);
    if (!setup.ok) return;
    assert.equal(setup.player.username, 'AoiShadow');
    assert.equal(setup.player.gender, 'female');
    assert.equal(setup.player.profileCompleted, true);

    // Earn 1 diamond on a running ghost
    const hit = db.awardKodamaHit(reg.player.playerId, 'crossing', 'runA:c1');
    assert.equal(hit.ok, true);
    if (hit.ok) assert.equal(hit.player.kodamaProgress.diamonds, 1);

    // Re-login with email preserves profileCompleted=true, name, gender, and diamonds
    const relogin = db.loginPlayer({
      email: 'KURO.ARCHER@example.com',
      password: 'Password123',
    });
    assert.equal(relogin.ok, true);
    if (!relogin.ok) return;
    assert.equal(relogin.player.profileCompleted, true);
    assert.equal(relogin.player.username, 'AoiShadow');
    assert.equal(relogin.player.gender, 'female');
    assert.equal(relogin.player.kodamaProgress.diamonds, 1);

    // Update name and gender later via profile settings
    const edited = db.updatePlayerProfile(reg.player.playerId, {
      username: 'KuroBlade',
      gender: 'male',
    });
    assert.equal(edited.ok, true);
    if (!edited.ok) return;
    assert.equal(edited.player.username, 'KuroBlade');
    assert.equal(edited.player.gender, 'male');
    assert.equal(edited.player.kodamaProgress.diamonds, 1);
  } finally {
    db.close();
  }
});
