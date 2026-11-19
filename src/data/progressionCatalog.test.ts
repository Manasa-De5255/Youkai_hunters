import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultCustomization } from './customizationCatalog';
import {
  enforceCustomizationProgression,
  findLockedCustomizationError,
  getLevelFromXp,
  getUnlockedItemsForLevel,
  isActivityUnlocked,
  isGadgetUnlocked,
  isItemUnlocked,
} from './progressionCatalog';

test('getLevelFromXp computes accurate progression thresholds', () => {
  assert.equal(getLevelFromXp(0), 1);
  assert.equal(getLevelFromXp(99), 1);
  assert.equal(getLevelFromXp(100), 2);
  assert.equal(getLevelFromXp(249), 2);
  assert.equal(getLevelFromXp(250), 3);
  assert.equal(getLevelFromXp(450), 4);
  assert.equal(getLevelFromXp(700), 5);
});

test('Level 1 allows ONLY Archery activity and starter Archery equipment', () => {
  assert.equal(isActivityUnlocked(1, 'archery'), true);
  assert.equal(isActivityUnlocked(1, 'sword_combat'), false);
  assert.equal(isActivityUnlocked(1, 'superpower_burst'), false);

  assert.equal(isGadgetUnlocked(1, 'archery_bow'), true);
  assert.equal(isGadgetUnlocked(1, 'hunter_blade'), false);
  assert.equal(isGadgetUnlocked(1, 'spirit_talisman'), false);
  assert.equal(isGadgetUnlocked(1, 'yokai_radar'), false);
  assert.equal(isGadgetUnlocked(1, 'spirit_beam'), false);

  const lvl1Unlocked = getUnlockedItemsForLevel(1);
  assert.equal(isItemUnlocked(1, lvl1Unlocked, 'archery', 'ravenwood_recurve'), true);
  assert.equal(isItemUnlocked(1, lvl1Unlocked, 'archery', 'moonlight_crescent'), false);
  assert.equal(isItemUnlocked(1, lvl1Unlocked, 'costume', 'moonlit_azure'), false);
  assert.equal(isItemUnlocked(1, lvl1Unlocked, 'sword', 'dragonfire_jian'), false);
  assert.equal(isItemUnlocked(1, lvl1Unlocked, 'superpower', 'void_lightning'), false);
});

test('Level 2 unlocks Level 2 gear & Katana Strike while keeping Level 3+ locked', () => {
  assert.equal(isActivityUnlocked(2, 'archery'), true);
  assert.equal(isActivityUnlocked(2, 'sword_combat'), true);
  assert.equal(isActivityUnlocked(2, 'superpower_burst'), false);

  assert.equal(isGadgetUnlocked(2, 'hunter_blade'), true);
  assert.equal(isGadgetUnlocked(2, 'spirit_talisman'), true);
  assert.equal(isGadgetUnlocked(2, 'yokai_radar'), false);
  assert.equal(isGadgetUnlocked(2, 'spirit_beam'), false);

  const defaults = getDefaultCustomization('male');
  const lvl1Unlocked = getUnlockedItemsForLevel(1);
  const lockedErr = findLockedCustomizationError(
    { ...defaults, costume: 'moonlit_azure' },
    defaults,
    1,
    lvl1Unlocked,
  );
  assert.match(lockedErr ?? '', /Unlock at Level 2/);

  const lvl2Unlocked = getUnlockedItemsForLevel(2);
  const allowedAt2 = findLockedCustomizationError(
    { ...defaults, costume: 'moonlit_azure', archery: 'moonlight_crescent' },
    defaults,
    2,
    lvl2Unlocked,
  );
  assert.equal(allowedAt2, null);

  // Enforcing progression strips any unauthorized Level 3 items back to defaults at Level 2
  const enforced = enforceCustomizationProgression(
    { ...defaults, costume: 'moonlit_azure', superpower: 'void_lightning' },
    'male',
    2,
    lvl2Unlocked,
  );
  assert.equal(enforced.costume, 'moonlit_azure');
  assert.equal(enforced.superpower, 'azure_moonbeam');
});
