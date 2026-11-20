import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRoundCompletion,
  buildRoundSpawnPlan,
  evaluateRoundOutcome,
  getDefaultKodamaProgress,
  getDiamondRewardForGhost,
  getMinRequiredHits,
  KODAMA_ROUND_CONFIGS,
  KODAMA_TOTAL_ROUNDS,
  sanitizeKodamaProgress,
  shouldAwardGhostHit,
} from './kodamaChallenge';

test('Kodama round configurations enforce totalGhosts (10,12,14,16,18) and minHits = totalGhosts - 4', () => {
  assert.equal(KODAMA_TOTAL_ROUNDS, 5);
  assert.deepEqual(
    KODAMA_ROUND_CONFIGS.map((c) => c.totalGhosts),
    [10, 12, 14, 16, 18],
  );
  assert.deepEqual(
    KODAMA_ROUND_CONFIGS.map((c) => c.minHits),
    [6, 8, 10, 12, 14],
  );
  for (let i = 0; i < KODAMA_ROUND_CONFIGS.length; i++) {
    const cfg = KODAMA_ROUND_CONFIGS[i];
    assert.equal(cfg.minHits, getMinRequiredHits(cfg.totalGhosts));
    assert.equal(cfg.minHits, cfg.totalGhosts - 4);
    assert.equal(cfg.crossingCount, 2, 'each round must have exactly 2 running ghosts');
    if (i > 0) {
      const prev = KODAMA_ROUND_CONFIGS[i - 1];
      assert.ok(cfg.crossingSpeed > prev.crossingSpeed, 'crossingSpeed increases progressively');
      assert.ok(cfg.visibleDurationMin < prev.visibleDurationMin, 'visibleDurationMin tightens progressively');
    }
  }
});

test('getDiamondRewardForGhost awards 0 for wall ghost and 1 for running crossing ghost', () => {
  assert.equal(getDiamondRewardForGhost('wall'), 0);
  assert.equal(getDiamondRewardForGhost('crossing'), 1);
});

test('buildRoundSpawnPlan creates fair timings and exactly 2 running ghosts across rounds 1-5', () => {
  for (let r = 1; r <= 5; r++) {
    const plan = buildRoundSpawnPlan(r, 1);
    const cfg = KODAMA_ROUND_CONFIGS[r - 1];
    assert.equal(plan.length, cfg.totalGhosts);
    const crossings = plan.filter((s) => s.kind === 'crossing');
    assert.equal(crossings.length, 2);
    for (const spec of plan) {
      assert.ok(spec.visibleDuration >= 1.4, 'ghost must stay visible long enough to react');
      if (spec.kind === 'crossing') {
        assert.ok(Math.abs(spec.endX - spec.startX) >= 12);
        assert.ok(spec.speed > 0);
      }
    }
  }

  // Round 5 includes varied motion patterns across deterministic RNG sweep
  let seed = 42;
  const detRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const r5Plan = buildRoundSpawnPlan(5, 1, detRng);
  const patterns = new Set(r5Plan.map((s) => s.motionPattern));
  assert.ok(patterns.size >= 3, `Expected varied patterns in Round 5, got: ${Array.from(patterns).join(', ')}`);
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

test('Stage 2 stays locked until all 5 rounds pass with minRequiredHits = totalGhosts - 4', () => {
  let progress = getDefaultKodamaProgress();
  assert.equal(progress.stage2Unlocked, false);

  // Fail round 1 (5 hits < 6): does not complete round 1 or lose diamonds
  progress.diamonds = 5;
  const failR1 = applyRoundCompletion(progress, 1, 5);
  assert.equal(failR1.passed, false);
  assert.equal(failR1.progress.diamonds, 5);
  assert.deepEqual(failR1.progress.completedRounds, []);
  assert.equal(failR1.progress.stage2Unlocked, false);

  // Round 3 requires 14 - 4 = 10 hits; 9 hits must fail
  const failR3 = applyRoundCompletion(progress, 3, 9);
  assert.equal(failR3.passed, false);

  // Pass rounds 1..4 with their exact minHits (6, 8, 10, 12)
  progress = { diamonds: 24, completedRounds: [], stage2Unlocked: false };
  for (let r = 1; r <= 4; r++) {
    const minReq = KODAMA_ROUND_CONFIGS[r - 1].minHits;
    const res = applyRoundCompletion(progress, r, minReq);
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

  // Passing round 5 (requires 18 - 4 = 14) unlocks Stage 2!
  assert.equal(applyRoundCompletion(progress, 5, 13).passed, false);
  const res5 = applyRoundCompletion(progress, 5, 14);
  assert.equal(res5.passed, true);
  assert.equal(res5.stage2JustUnlocked, true);
  assert.equal(res5.progress.stage2Unlocked, true);
  assert.deepEqual(res5.progress.completedRounds, [1, 2, 3, 4, 5]);
  assert.equal(evaluateRoundOutcome(5, 14).passed, true);
});
