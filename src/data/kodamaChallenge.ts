import { KodamaChallengeProgress } from '../types/game';

export const KODAMA_MIN_HITS = 6;
export const KODAMA_TOTAL_ROUNDS = 5;

export function getMinRequiredHits(totalGhosts: number): number {
  return Math.max(1, Math.floor(totalGhosts) - 4);
}

export type KodamaSpawnKind = 'wall' | 'crossing';
export type KodamaMotionPattern = 'hover' | 'drift' | 'linear' | 'wave' | 'arc' | 'zigzag';

export function getDiamondRewardForGhost(kind: KodamaSpawnKind): number {
  return kind === 'crossing' ? 1 : 0;
}

export interface KodamaRoundConfig {
  round: number;
  label: string;
  totalGhosts: number;
  minHits: number;
  crossingCount: number;
  maxConcurrent: number;
  visibleDurationMin: number;
  visibleDurationMax: number;
  quickPeekChance: number;
  quickPeekDuration: number;
  suspenseGapChance: number;
  spawnDelayMin: number;
  spawnDelayMax: number;
  crossingSpeed: number;
  fadeDuration: number;
}

export const KODAMA_ROUND_CONFIGS: KodamaRoundConfig[] = [
  {
    round: 1,
    label: 'Round 1 · Whispering Moss',
    totalGhosts: 10,
    minHits: getMinRequiredHits(10),
    crossingCount: 2,
    maxConcurrent: 2,
    visibleDurationMin: 2.55,
    visibleDurationMax: 3.35,
    quickPeekChance: 0.1,
    quickPeekDuration: 2.15,
    suspenseGapChance: 0.15,
    spawnDelayMin: 0.7,
    spawnDelayMax: 1.4,
    crossingSpeed: 3.1,
    fadeDuration: 0.36,
  },
  {
    round: 2,
    label: 'Round 2 · Crimson Mist',
    totalGhosts: 12,
    minHits: getMinRequiredHits(12),
    crossingCount: 2,
    maxConcurrent: 2,
    visibleDurationMin: 2.15,
    visibleDurationMax: 2.95,
    quickPeekChance: 0.2,
    quickPeekDuration: 1.85,
    suspenseGapChance: 0.2,
    spawnDelayMin: 0.55,
    spawnDelayMax: 1.35,
    crossingSpeed: 3.7,
    fadeDuration: 0.33,
  },
  {
    round: 3,
    label: 'Round 3 · Restless Canopy',
    totalGhosts: 14,
    minHits: getMinRequiredHits(14),
    crossingCount: 2,
    maxConcurrent: 3,
    visibleDurationMin: 1.9,
    visibleDurationMax: 2.75,
    quickPeekChance: 0.25,
    quickPeekDuration: 1.7,
    suspenseGapChance: 0.22,
    spawnDelayMin: 0.45,
    spawnDelayMax: 1.25,
    crossingSpeed: 4.25,
    fadeDuration: 0.3,
  },
  {
    round: 4,
    label: 'Round 4 · Bloodmoon Veil',
    totalGhosts: 16,
    minHits: getMinRequiredHits(16),
    crossingCount: 2,
    maxConcurrent: 3,
    visibleDurationMin: 1.65,
    visibleDurationMax: 2.55,
    quickPeekChance: 0.32,
    quickPeekDuration: 1.55,
    suspenseGapChance: 0.25,
    spawnDelayMin: 0.38,
    spawnDelayMax: 1.2,
    crossingSpeed: 4.8,
    fadeDuration: 0.28,
  },
  {
    round: 5,
    label: 'Round 5 · Elder Spirit Storm',
    totalGhosts: 18,
    minHits: getMinRequiredHits(18),
    crossingCount: 2,
    maxConcurrent: 3,
    visibleDurationMin: 1.5,
    visibleDurationMax: 2.45,
    quickPeekChance: 0.35,
    quickPeekDuration: 1.48,
    suspenseGapChance: 0.28,
    spawnDelayMin: 0.32,
    spawnDelayMax: 1.15,
    crossingSpeed: 5.35,
    fadeDuration: 0.26,
  },
];

export interface KodamaSpawnSpec {
  id: string;
  index: number;
  kind: KodamaSpawnKind;
  motionPattern: KodamaMotionPattern;
  motionFreq: number;
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

function pickWallMotionPattern(round: number, rng: () => number): KodamaMotionPattern {
  if (round === 1) return 'hover';
  if (round === 2) return rng() < 0.4 ? 'drift' : 'hover';
  if (round === 3) return rng() < 0.55 ? 'drift' : 'hover';
  if (round === 4) return rng() < 0.3 ? 'zigzag' : rng() < 0.7 ? 'drift' : 'hover';
  const roll = rng();
  if (roll < 0.35) return 'zigzag';
  if (roll < 0.75) return 'drift';
  return 'hover';
}

function pickCrossingMotionPattern(round: number, rng: () => number): KodamaMotionPattern {
  if (round === 1) return 'linear';
  if (round === 2) return rng() < 0.45 ? 'wave' : 'linear';
  if (round === 3) {
    const roll = rng();
    if (roll < 0.4) return 'wave';
    if (roll < 0.75) return 'arc';
    return 'linear';
  }
  const roll = rng();
  if (roll < 0.3) return 'zigzag';
  if (roll < 0.6) return 'wave';
  if (roll < 0.85) return 'arc';
  return 'linear';
}

export function buildRoundSpawnPlan(
  round: number,
  stage: 1 | 2 = 1,
  rng: () => number = Math.random,
): KodamaSpawnSpec[] {
  const cfg = getRoundConfig(round);
  const stageSpeedFactor = stage === 2 ? 1.15 : 1.0;
  const stageDurationFactor = stage === 2 ? 0.92 : 1.0;

  // Spread moving crossings unpredictably across the round without clustering all at once
  const crossingIndices = new Set<number>();
  const step = cfg.totalGhosts / Math.max(1, cfg.crossingCount);
  for (let c = 0; c < cfg.crossingCount; c++) {
    const baseIdx = Math.floor(c * step + rng() * Math.max(1, step * 0.8));
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
  let prevWallY = 2.4;

  for (let i = 0; i < cfg.totalGhosts; i++) {
    const isCrossing = crossingIndices.has(i);
    let delayAfterPrevious =
      i === 0
        ? 0.42
        : cfg.spawnDelayMin + rng() * (cfg.spawnDelayMax - cfg.spawnDelayMin);

    // Occasional suspense gap between appearances
    if (i > 1 && rng() < cfg.suspenseGapChance) {
      delayAfterPrevious += 0.55 + rng() * 0.65;
    }

    if (isCrossing) {
      const leftToRight = rng() >= 0.5;
      const startX = leftToRight ? -7.2 : 7.2;
      const endX = leftToRight ? 7.2 : -7.2;
      const speedJitter = (rng() - 0.5) * 0.85;
      const speed = Math.max(2.6, (cfg.crossingSpeed + speedJitter) * stageSpeedFactor);
      const travelDistance = Math.abs(endX - startX);
      const visibleDuration = travelDistance / speed;
      const y = 1.45 + rng() * 2.15;
      const z = -4.5 + rng() * 0.9;
      const motionPattern = pickCrossingMotionPattern(cfg.round, rng);

      plan.push({
        id: `r${cfg.round}-s${stage}-g${i + 1}`,
        index: i,
        kind: 'crossing',
        motionPattern,
        motionFreq: 2.6 + rng() * 1.6,
        x: startX,
        y,
        z,
        startX,
        endX,
        speed,
        fadeDuration: Math.max(0.2, cfg.fadeDuration * 0.72),
        visibleDuration,
        delayAfterPrevious: Math.max(0.32, delayAfterPrevious * 0.92),
        bobPhase: rng() * Math.PI * 2,
        swayAmp: motionPattern === 'linear' ? 0.14 : 0.34 + rng() * 0.24,
      });
    } else {
      // Pick varied positions across the grass wall spaced from the immediate previous wall spawn
      let x = (rng() * 2 - 1) * 6.0;
      if (Math.abs(x - prevWallX) < 2.1) {
        x = x > 0 ? Math.max(-6.0, x - 3.4) : Math.min(6.0, x + 3.4);
      }
      prevWallX = x;

      let y = 1.2 + rng() * 2.65;
      if (Math.abs(y - prevWallY) < 0.55) {
        y = y > 2.4 ? Math.max(1.2, y - 0.95) : Math.min(3.85, y + 0.95);
      }
      prevWallY = y;

      const z = -6.0 + rng() * 0.45;
      const isQuick = rng() < cfg.quickPeekChance;
      const rawVis = isQuick
        ? cfg.quickPeekDuration + rng() * 0.3
        : cfg.visibleDurationMin + rng() * (cfg.visibleDurationMax - cfg.visibleDurationMin);

      const motionPattern = pickWallMotionPattern(cfg.round, rng);
      const wallDriftAmp =
        motionPattern === 'hover'
          ? 0.14 + rng() * 0.14
          : motionPattern === 'drift'
            ? 0.34 + rng() * 0.26
            : 0.42 + rng() * 0.32;

      plan.push({
        id: `r${cfg.round}-s${stage}-g${i + 1}`,
        index: i,
        kind: 'wall',
        motionPattern,
        motionFreq: 1.8 + rng() * 1.4,
        x,
        y,
        z,
        startX: x,
        endX: x,
        speed: (0.35 + cfg.round * 0.12 + rng() * 0.35) * stageSpeedFactor,
        fadeDuration: cfg.fadeDuration,
        visibleDuration: Math.max(1.4, rawVis * stageDurationFactor),
        delayAfterPrevious,
        bobPhase: rng() * Math.PI * 2,
        swayAmp: wallDriftAmp,
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
  const minRequiredHits = totalGhosts !== undefined ? getMinRequiredHits(safeTotal) : cfg.minHits;
  return {
    round: cfg.round,
    hits: safeHits,
    totalGhosts: safeTotal,
    minRequiredHits,
    passed: safeHits >= minRequiredHits,
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
