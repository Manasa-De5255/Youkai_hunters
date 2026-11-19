import { KodamaChallengeProgress } from '../types/game';

export const KODAMA_MIN_HITS = 6;
export const KODAMA_TOTAL_ROUNDS = 5;

export interface KodamaRoundConfig {
  round: number;
  label: string;
  totalGhosts: number;
  minHits: number;
  crossingCount: number;
  maxConcurrent: number;
  visibleDurationMin: number;
  visibleDurationMax: number;
  spawnDelayMin: number;
  spawnDelayMax: number;
  crossingSpeed: number;
}

export const KODAMA_ROUND_CONFIGS: KodamaRoundConfig[] = [
  {
    round: 1,
    label: 'Round 1 · Whispering Moss',
    totalGhosts: 10,
    minHits: KODAMA_MIN_HITS,
    crossingCount: 2,
    maxConcurrent: 2,
    visibleDurationMin: 2.8,
    visibleDurationMax: 3.4,
    spawnDelayMin: 0.75,
    spawnDelayMax: 1.35,
    crossingSpeed: 3.3,
  },
  {
    round: 2,
    label: 'Round 2 · Crimson Mist',
    totalGhosts: 12,
    minHits: KODAMA_MIN_HITS,
    crossingCount: 3,
    maxConcurrent: 2,
    visibleDurationMin: 2.55,
    visibleDurationMax: 3.15,
    spawnDelayMin: 0.65,
    spawnDelayMax: 1.2,
    crossingSpeed: 3.9,
  },
  {
    round: 3,
    label: 'Round 3 · Restless Canopy',
    totalGhosts: 14,
    minHits: KODAMA_MIN_HITS,
    crossingCount: 4,
    maxConcurrent: 3,
    visibleDurationMin: 2.4,
    visibleDurationMax: 2.95,
    spawnDelayMin: 0.55,
    spawnDelayMax: 1.05,
    crossingSpeed: 4.5,
  },
  {
    round: 4,
    label: 'Round 4 · Bloodmoon Veil',
    totalGhosts: 16,
    minHits: KODAMA_MIN_HITS,
    crossingCount: 5,
    maxConcurrent: 3,
    visibleDurationMin: 2.3,
    visibleDurationMax: 2.8,
    spawnDelayMin: 0.48,
    spawnDelayMax: 0.92,
    crossingSpeed: 5.1,
  },
  {
    round: 5,
    label: 'Round 5 · Elder Spirit Storm',
    totalGhosts: 18,
    minHits: KODAMA_MIN_HITS,
    crossingCount: 6,
    maxConcurrent: 3,
    visibleDurationMin: 2.2,
    visibleDurationMax: 2.7,
    spawnDelayMin: 0.42,
    spawnDelayMax: 0.82,
    crossingSpeed: 5.7,
  },
];

export type KodamaSpawnKind = 'wall' | 'crossing';

export interface KodamaSpawnSpec {
  id: string;
  index: number;
  kind: KodamaSpawnKind;
  x: number;
  y: number;
  z: number;
  startX: number;
  endX: number;
  speed: number;
  fadeDuration: number;
  visibleDuration: number;
  delayAfterPrevious: number;
  bobPhase: number;
  swayAmp: number;
}

export interface KodamaHitCheckState {
  active: boolean;
  hitAwarded: boolean;
  phase: 'fading_in' | 'visible' | 'fading_out' | 'dissolving' | 'gone';
}

export interface KodamaRoundOutcome {
  round: number;
  hits: number;
  totalGhosts: number;
  minRequiredHits: number;
  passed: boolean;
}

export interface KodamaRoundHudSnapshot {
  round: number;
  stage: 1 | 2;
  totalGhosts: number;
  spawnedCount: number;
  activeCount: number;
  hits: number;
  minRequiredHits: number;
  remainingGhosts: number;
  completed: boolean;
  passed: boolean;
}

export function getRoundConfig(round: number): KodamaRoundConfig {
  const clamped = Math.max(1, Math.min(KODAMA_TOTAL_ROUNDS, Math.floor(round)));
  return KODAMA_ROUND_CONFIGS[clamped - 1];
}

export function buildRoundSpawnPlan(
  round: number,
  stage: 1 | 2 = 1,
  rng: () => number = Math.random,
): KodamaSpawnSpec[] {
  const cfg = getRoundConfig(round);
  const stageSpeedFactor = stage === 2 ? 1.18 : 1.0;
  const stageDurationFactor = stage === 2 ? 0.9 : 1.0;

  // Choose evenly spread + jittered indices for sudden horizontal crossings so they don't cluster
  const crossingIndices = new Set<number>();
  const step = cfg.totalGhosts / Math.max(1, cfg.crossingCount);
  for (let c = 0; c < cfg.crossingCount; c++) {
    const baseIdx = Math.floor(c * step + rng() * Math.max(1, step * 0.75));
    let candidate = Math.min(cfg.totalGhosts - 1, Math.max(1, baseIdx));
    while (crossingIndices.has(candidate) && candidate < cfg.totalGhosts - 1) {
      candidate += 1;
    }
    crossingIndices.add(candidate);
  }
  while (crossingIndices.size < cfg.crossingCount) {
    crossingIndices.add(Math.floor(rng() * cfg.totalGhosts));
  }

  const plan: KodamaSpawnSpec[] = [];
  let prevWallX = 0;

  for (let i = 0; i < cfg.totalGhosts; i++) {
    const isCrossing = crossingIndices.has(i);
    const fadeDuration = 0.34;
    const delayAfterPrevious =
      i === 0
        ? 0.45
        : cfg.spawnDelayMin + rng() * (cfg.spawnDelayMax - cfg.spawnDelayMin);

    if (isCrossing) {
      const leftToRight = rng() >= 0.5;
      const startX = leftToRight ? -7.2 : 7.2;
      const endX = leftToRight ? 7.2 : -7.2;
      const speed = (cfg.crossingSpeed + (rng() - 0.5) * 0.45) * stageSpeedFactor;
      const travelDistance = Math.abs(endX - startX);
      const visibleDuration = travelDistance / speed;
      const y = 1.45 + rng() * 1.95;
      const z = -4.25 + rng() * 0.65;

      plan.push({
        id: `r${cfg.round}-s${stage}-g${i + 1}`,
        index: i,
        kind: 'crossing',
        x: startX,
        y,
        z,
        startX,
        endX,
        speed,
        fadeDuration: 0.24,
        visibleDuration,
        delayAfterPrevious: Math.max(0.35, delayAfterPrevious * 0.9),
        bobPhase: rng() * Math.PI * 2,
        swayAmp: 0.14 + rng() * 0.1,
      });
    } else {
      // Pick a wall position spaced away from the immediate previous wall spawn for visual variety
      let x = (rng() * 2 - 1) * 5.8;
      if (Math.abs(x - prevWallX) < 1.8) {
        x = x > 0 ? Math.max(-5.8, x - 3.0) : Math.min(5.8, x + 3.0);
      }
      prevWallX = x;

      const y = 1.28 + rng() * 2.45;
      const z = -5.95 + rng() * 0.35;
      const baseVis =
        cfg.visibleDurationMin + rng() * (cfg.visibleDurationMax - cfg.visibleDurationMin);

      plan.push({
        id: `r${cfg.round}-s${stage}-g${i + 1}`,
        index: i,
        kind: 'wall',
        x,
        y,
        z,
        startX: x,
        endX: x,
        speed: (0.28 + rng() * 0.35) * stageSpeedFactor,
        fadeDuration,
        visibleDuration: baseVis * stageDurationFactor,
        delayAfterPrevious,
        bobPhase: rng() * Math.PI * 2,
        swayAmp: 0.12 + rng() * 0.16,
      });
    }
  }

  return plan;
}

export function shouldAwardGhostHit(state: KodamaHitCheckState): boolean {
  if (!state.active || state.hitAwarded) return false;
  return (
    state.phase === 'fading_in' ||
    state.phase === 'visible' ||
    state.phase === 'fading_out'
  );
}

export function evaluateRoundOutcome(
  round: number,
  hits: number,
  totalGhosts?: number,
): KodamaRoundOutcome {
  const cfg = getRoundConfig(round);
  const safeHits = Math.max(0, Math.floor(hits));
  const safeTotal = totalGhosts ?? cfg.totalGhosts;
  return {
    round: cfg.round,
    hits: safeHits,
    totalGhosts: safeTotal,
    minRequiredHits: cfg.minHits,
    passed: safeHits >= cfg.minHits,
  };
}

export function getDefaultKodamaProgress(): KodamaChallengeProgress {
  return {
    diamonds: 0,
    completedRounds: [],
    stage2Unlocked: false,
  };
}

export function areAllStage1RoundsCompleted(completedRounds: number[]): boolean {
  const set = new Set(completedRounds);
  for (let r = 1; r <= KODAMA_TOTAL_ROUNDS; r++) {
    if (!set.has(r)) return false;
  }
  return true;
}

export function sanitizeKodamaProgress(
  input: Partial<KodamaChallengeProgress> | null | undefined,
): KodamaChallengeProgress {
  if (!input || typeof input !== 'object') {
    return getDefaultKodamaProgress();
  }
  const diamonds = Math.max(0, Math.floor(Number(input.diamonds ?? 0)) || 0);
  const completedSet = new Set<number>();
  if (Array.isArray(input.completedRounds)) {
    for (const r of input.completedRounds) {
      const n = Math.floor(Number(r));
      if (n >= 1 && n <= KODAMA_TOTAL_ROUNDS) {
        completedSet.add(n);
      }
    }
  }
  const completedRounds = Array.from(completedSet).sort((a, b) => a - b);
  // Stage 2 unlocks strictly only when all 5 rounds are completed
  const stage2Unlocked = areAllStage1RoundsCompleted(completedRounds);
  return {
    diamonds,
    completedRounds,
    stage2Unlocked,
  };
}

export function applyRoundCompletion(
  current: KodamaChallengeProgress,
  round: number,
  hits: number,
): {
  progress: KodamaChallengeProgress;
  passed: boolean;
  newlyCompleted: boolean;
  stage2JustUnlocked: boolean;
} {
  const clean = sanitizeKodamaProgress(current);
  const outcome = evaluateRoundOutcome(round, hits);
  if (!outcome.passed) {
    return {
      progress: clean,
      passed: false,
      newlyCompleted: false,
      stage2JustUnlocked: false,
    };
  }

  const alreadyHadRound = clean.completedRounds.includes(outcome.round);
  const nextRounds = alreadyHadRound
    ? clean.completedRounds
    : [...clean.completedRounds, outcome.round].sort((a, b) => a - b);

  const nextStage2 = areAllStage1RoundsCompleted(nextRounds);
  return {
    progress: {
      diamonds: clean.diamonds,
      completedRounds: nextRounds,
      stage2Unlocked: nextStage2,
    },
    passed: true,
    newlyCompleted: !alreadyHadRound,
    stage2JustUnlocked: !clean.stage2Unlocked && nextStage2,
  };
}
