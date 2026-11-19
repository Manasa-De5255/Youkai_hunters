import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRoundCompletion,
  buildRoundSpawnPlan,
  evaluateRoundOutcome,
  getDefaultKodamaProgress,
  KODAMA_MIN_HITS,
  KODAMA_ROUND_CONFIGS,
  KODAMA_TOTAL_ROUNDS,
  sanitizeKodamaProgress,
  shouldAwardGhostHit,
} from './kodamaChallenge';

test('Kodama round configurations enforce progressive ghost counts (10,12,14,16,18) and min 6 hits', () => {
  assert.equal(KODAMA_TOTAL_ROUNDS, 5);
  assert.equal(KODAMA_MIN_HITS, 6);
  assert.deepEqual(
    KODAMA_ROUND_CONFIGS.map((c) => c.totalGhosts),
    [10, 12, 14, 16, 18],
  );
  for (const cfg of KODAMA_ROUND_CONFIGS) {
    assert.equal(cfg.minHits, 6);
    assert.ok(cfg.crossingCount >= 2);
  }
});

test('buildRoundSpawnPlan creates expected counts with wall + horizontal crossing ghosts', () => {
  for (let r = 1; r <= 5; r++) {
    const plan = buildRoundSpawnPlan(r, 1);
    const cfg = KODAMA_ROUND_CONFIGS[r - 1];
    assert.equal(plan.length, cfg.totalGhosts);
    const crossings = plan.filter((s) => s.kind === 'crossing');
    assert.equal(crossings.length, cfg.crossingCount);
    for (const c of crossings) {
      assert.ok(Math.abs(c.endX - c.startX) >= 12);
      assert.ok(c.speed > 0);
    }
  }
});

test('shouldAwardGhostHit prevents duplicate diamond awards for the same ghost', () => {
  assert.equal(
    shouldAwardGhostHit({ active: true, hitAwarded: false, phase: 'visible' }),
    true,
  );
  assert.equal(
    shouldAwardGhostHit({ active: true, hitAwarded: false, phase: 'fading_in' }),
    true,
  );
  assert.equal(
    shouldAwardGhostHit({ active: true, hitAwarded: true, phase: 'visible' }),
    false,
  );
  assert.equal(
    shouldAwardGhostHit({ active: false, hitAwarded: false, phase: 'dissolving' }),
    false,
  );
  assert.equal(
    shouldAwardGhostHit({ active: false, hitAwarded: false, phase: 'gone' }),
    false,
  );
});

test('Stage 2 stays locked until all 5 rounds pass with >= 6 hits each', () => {
  let progress = getDefaultKodamaProgress();
  assert.equal(progress.stage2Unlocked, false);

  // Fail round 1 (5 hits < 6): does not complete round 1 or lose diamonds
  progress.diamonds = 5;
  const failR1 = applyRoundCompletion(progress, 1, 5);
  assert.equal(failR1.passed, false);
  assert.equal(failR1.progress.diamonds, 5);
  assert.deepEqual(failR1.progress.completedRounds, []);
  assert.equal(failR1.progress.stage2Unlocked, false);

  // Pass rounds 1..4
  progress = { diamonds: 24, completedRounds: [], stage2Unlocked: false };
  for (let r = 1; r <= 4; r++) {
    const res = applyRoundCompletion(progress, r, 6);
    assert.equal(res.passed, true);
    assert.equal(res.progress.stage2Unlocked, false);
    assert.equal(res.stage2JustUnlocked, false);
    progress = res.progress;
  }
  assert.deepEqual(progress.completedRounds, [1, 2, 3, 4]);

  // Even a rogue stage2Unlocked=true without all 5 rounds is sanitized back to false
  const tampered = sanitizeKodamaProgress({
    diamonds: 10,
    completedRounds: [1, 2, 3, 4],
    stage2Unlocked: true,
  });
  assert.equal(tampered.stage2Unlocked, false);

  // Passing round 5 unlocks Stage 2!
  const res5 = applyRoundCompletion(progress, 5, 7);
  assert.equal(res5.passed, true);
  assert.equal(res5.stage2JustUnlocked, true);
  assert.equal(res5.progress.stage2Unlocked, true);
  assert.deepEqual(res5.progress.completedRounds, [1, 2, 3, 4, 5]);
  assert.equal(evaluateRoundOutcome(5, 7).passed, true);
});
