import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crosshair,
  Flame,
  Gem,
  Lock,
  LogOut,
  RotateCcw,
  ScrollText,
  Sliders,
  Sparkles,
  Swords,
  Trophy,
} from 'lucide-react';
import {
  ARCHERY_OPTIONS,
  COSTUME_OPTIONS,
  SUPERPOWER_OPTIONS,
  SWORD_OPTIONS,
} from '../data/customizationCatalog';
import {
  getRoundConfig,
  KODAMA_MIN_HITS,
  KODAMA_ROUND_CONFIGS,
  KODAMA_TOTAL_ROUNDS,
  KodamaRoundHudSnapshot,
  KodamaRoundOutcome,
} from '../data/kodamaChallenge';
import {
  ACTIVITY_DEFINITIONS,
  GADGET_DEFINITIONS,
  getLevelTitle,
  getNextLevelThreshold,
  isActivityUnlocked,
  isGadgetUnlocked,
} from '../data/progressionCatalog';
import SanctuaryGameCanvas from '../three/SanctuaryGameCanvas';
import { ActivityId, CharacterCustomization, GadgetId, PlayerAccount } from '../types/game';

interface GameWorldScreenProps {
  player: PlayerAccount;
  customization: CharacterCustomization;
  onRecordActivity: (activityId: ActivityId) => Promise<{
    leveledUp: boolean;
    newLevel: number;
    newlyUnlocked: string[];
  }>;
  onKodamaHit: () => Promise<{
    leveledUp: boolean;
    newLevel: number;
    newlyUnlocked: string[];
    diamonds: number;
  }>;
  onKodamaRoundComplete: (
    round: number,
    hits: number,
  ) => Promise<{
    passed: boolean;
    newlyCompleted: boolean;
    stage2JustUnlocked: boolean;
    completedRounds: number[];
    stage2Unlocked: boolean;
    diamonds: number;
  }>;
  onReturnToCustomize: () => void;
  onLogout: () => void;
}

export default function GameWorldScreen({
  player,
  customization,
  onRecordActivity,
  onKodamaHit,
  onKodamaRoundComplete,
  onReturnToCustomize,
  onLogout,
}: GameWorldScreenProps) {
  const [activeActivity, setActiveActivity] = useState<ActivityId>('archery');
  const [talismanActive, setTalismanActive] = useState(false);
  const [radarActive, setRadarActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<'unlock' | 'locked'>('unlock');

  // Kodama Archery Challenge round & stage state
  const [stage, setStage] = useState<1 | 2>(1);
  const [currentRound, setCurrentRound] = useState<number>(() => {
    const completed = player.kodamaProgress.completedRounds;
    for (let r = 1; r <= KODAMA_TOTAL_ROUNDS; r++) {
      if (!completed.includes(r)) return r;
    }
    return 1;
  });
  const [roundRunKey, setRoundRunKey] = useState(1);
  const [roundOutcome, setRoundOutcome] = useState<KodamaRoundOutcome | null>(null);
  const [showStage2Modal, setShowStage2Modal] = useState(false);

  const initialRoundCfg = getRoundConfig(currentRound);
  const [roundHud, setRoundHud] = useState<KodamaRoundHudSnapshot>({
    round: currentRound,
    stage: 1,
    totalGhosts: initialRoundCfg.totalGhosts,
    spawnedCount: 0,
    activeCount: 0,
    hits: 0,
    minRequiredHits: KODAMA_MIN_HITS,
    remainingGhosts: initialRoundCfg.totalGhosts,
    completed: false,
    passed: false,
  });

  // Ensure activeActivity drops back to archery if player switches to a Level 1 account
  useEffect(() => {
    if (!isActivityUnlocked(player.level, activeActivity)) {
      setActiveActivity('archery');
    }
    if (!isGadgetUnlocked(player.level, 'spirit_talisman')) {
      setTalismanActive(false);
    }
    if (!isGadgetUnlocked(player.level, 'yokai_radar')) {
      setRadarActive(false);
    }
    if (!player.kodamaProgress.stage2Unlocked && stage === 2) {
      setStage(1);
    }
  }, [player.level, player.kodamaProgress.stage2Unlocked, activeActivity, stage]);

  useEffect(() => {
    if (!bannerMessage) return;
    const timer = window.setTimeout(() => setBannerMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  const handleSelectActivity = (id: ActivityId) => {
    const def = ACTIVITY_DEFINITIONS.find((a) => a.id === id);
    if (!def) return;
    if (!isActivityUnlocked(player.level, id)) {
      setBannerTone('locked');
      setBannerMessage(`${def.name} is locked. Unlock at Level ${def.requiredLevel}.`);
      return;
    }
    setActiveActivity(id);
  };

  const handleGadgetAction = (id: GadgetId) => {
    const def = GADGET_DEFINITIONS.find((g) => g.id === id);
    if (!def) return;
    if (!isGadgetUnlocked(player.level, id)) {
      setBannerTone('locked');
      setBannerMessage(`${def.name} is locked. Unlock at Level ${def.requiredLevel}.`);
      return;
    }
    if (id === 'archery_bow') {
      setActiveActivity('archery');
    } else if (id === 'hunter_blade') {
      setActiveActivity('sword_combat');
    } else if (id === 'spirit_beam') {
      setActiveActivity('superpower_burst');
    } else if (id === 'spirit_talisman') {
      setTalismanActive((v) => !v);
    } else if (id === 'yokai_radar') {
      setRadarActive((v) => !v);
    }
  };

  const handleActivityHit = useCallback(
    async (activityId: ActivityId) => {
      try {
        const res = await onRecordActivity(activityId);
        if (res.leveledUp) {
          setBannerTone('unlock');
          setBannerMessage(
            `Level Up! Reached Level ${res.newLevel} (${getLevelTitle(res.newLevel)}) — New weapons, gadgets & armor unlocked!`,
          );
        }
      } catch (err) {
        setBannerTone('locked');
        setBannerMessage(err instanceof Error ? err.message : 'Unable to record activity.');
      }
    },
    [onRecordActivity],
  );

  const handleKodamaHit = useCallback(async () => {
    try {
      const res = await onKodamaHit();
      if (res.leveledUp) {
        setBannerTone('unlock');
        setBannerMessage(
          `Level Up! Reached Level ${res.newLevel} (${getLevelTitle(res.newLevel)}) — New weapons, gadgets & armor unlocked!`,
        );
      }
    } catch (err) {
      setBannerTone('locked');
      setBannerMessage(err instanceof Error ? err.message : 'Unable to record diamond reward.');
    }
  }, [onKodamaHit]);

  const handleRoundFinished = useCallback(
    async (outcome: KodamaRoundOutcome) => {
      setRoundOutcome(outcome);
      try {
        const res = await onKodamaRoundComplete(outcome.round, outcome.hits);
        if (res.stage2JustUnlocked) {
          setShowStage2Modal(true);
        }
      } catch (err) {
        setBannerTone('locked');
        setBannerMessage(err instanceof Error ? err.message : 'Unable to save round progress.');
      }
    },
    [onKodamaRoundComplete],
  );

  const startRoundRun = (targetRound: number, targetStage: 1 | 2 = stage) => {
    setRoundOutcome(null);
    setShowStage2Modal(false);
    setSidebarOpen(false);
    setStage(targetStage);
    setCurrentRound(targetRound);
    setRoundRunKey((k) => k + 1);
  };

  const handleSelectStage = (nextStage: 1 | 2) => {
    if (nextStage === 2 && !player.kodamaProgress.stage2Unlocked) {
      setBannerTone('locked');
      setBannerMessage('Stage 2 unlocks after completing all 5 rounds with at least 6 hits each.');
      return;
    }
    startRoundRun(1, nextStage);
  };

  const handleLockedAttempt = (msg: string) => {
    setBannerTone('locked');
    setBannerMessage(msg);
  };

  const costume = COSTUME_OPTIONS.find((c) => c.id === customization.costume);
  const bow = ARCHERY_OPTIONS.find((a) => a.id === customization.archery);
  const sword = SWORD_OPTIONS.find((s) => s.id === customization.sword);
  const power = SUPERPOWER_OPTIONS.find((sp) => sp.id === customization.superpower);

  const nextThreshold = getNextLevelThreshold(player.level);
  const currentMin =
    player.level === 1 ? 0 : getNextLevelThreshold(player.level - 1)?.minXp ?? 0;
  const xpPct = nextThreshold
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(((player.xp - currentMin) / Math.max(1, nextThreshold.minXp - currentMin)) * 100),
        ),
      )
    : 100;

  const roundStatusLabel = roundHud.completed
    ? roundHud.passed
      ? 'Round Passed'
      : 'Round Failed'
    : roundHud.hits >= KODAMA_MIN_HITS
      ? 'Quota Met'
      : 'Hunting';

  const renderActivityIcon = (id: ActivityId) => {
    if (id === 'archery') return <Crosshair className="h-4 w-4" aria-hidden="true" />;
    if (id === 'sword_combat') return <Swords className="h-4 w-4" aria-hidden="true" />;
    return <Flame className="h-4 w-4" aria-hidden="true" />;
  };

  const renderGadgetIcon = (id: GadgetId) => {
    if (id === 'archery_bow') return <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />;
    if (id === 'hunter_blade') return <Swords className="h-3.5 w-3.5" aria-hidden="true" />;
    if (id === 'spirit_talisman') return <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />;
    if (id === 'yokai_radar') return <Compass className="h-3.5 w-3.5" aria-hidden="true" />;
    return <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />;
  };

  const completedRoundsSet = new Set(player.kodamaProgress.completedRounds);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#050a07] text-slate-100">
      <SanctuaryGameCanvas
        gender={player.gender}
        customization={customization}
        playerLevel={player.level}
        activeActivity={activeActivity}
        talismanActive={talismanActive}
        round={currentRound}
        stage={stage}
        roundRunKey={roundRunKey}
        onKodamaHit={handleKodamaHit}
        onRoundStatsChange={setRoundHud}
        onRoundFinished={handleRoundFinished}
        onActivityHit={handleActivityHit}
        onSelectActivity={handleSelectActivity}
        onToggleTalisman={() => handleGadgetAction('spirit_talisman')}
        onToggleRadar={() => handleGadgetAction('yokai_radar')}
        onLockedAttempt={handleLockedAttempt}
      />

      {/* Top Left HUD: Compact Hunter Profile + Kodama Challenge Stats prioritizing the grass wall */}
      <div className="pointer-events-none absolute left-3 top-[52px] z-20 flex w-[min(calc(100vw-3.5rem),308px)] flex-col gap-1.5 sm:left-4 sm:top-4 sm:w-[316px] sm:gap-2">
        <section className="pointer-events-auto rounded-xl border border-emerald-500/25 bg-[#060e0a]/92 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.75)] sm:px-3.5 sm:py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap font-display text-xs font-bold tracking-wider text-emerald-200 sm:text-sm">
              KODAMA FOREST
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span
                data-testid="kodama-diamonds"
                className="inline-flex items-center gap-1 rounded border border-cyan-400/35 bg-cyan-950/60 px-1.5 py-0.5 font-mono-id text-[11px] font-bold text-cyan-200 sm:px-2 sm:text-xs"
              >
                <Gem className="h-3 w-3 text-cyan-300 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                {player.kodamaProgress.diamonds}
              </span>
              <span
                data-testid="game-player-id"
                className="whitespace-nowrap font-mono-id text-[11px] text-emerald-400 sm:text-xs"
              >
                {player.playerId}
              </span>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-300 sm:mt-1.5 sm:text-xs">
            <div className="flex min-w-0 items-center gap-1.5">
              <span data-testid="game-username" className="truncate font-semibold text-white">
                {player.username}
              </span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 uppercase">{player.gender}</span>
            </div>
            <span
              data-testid="game-level"
              className="shrink-0 whitespace-nowrap font-mono-id font-semibold text-amber-300"
            >
              Lv.{player.level} · {getLevelTitle(player.level)}
            </span>
          </div>

          <div className="mt-1.5 sm:mt-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
              <span data-testid="game-xp">
                XP: {player.xp}
                {nextThreshold ? ` / ${nextThreshold.minXp}` : ' (MAX)'}
              </span>
              <span data-testid="game-orbs-cleared" className="font-mono-id text-emerald-300">
                Total Eliminated: {player.orbsCleared}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-rose-400 transition-all duration-300"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>

          <div className="mt-1.5 border-t border-emerald-500/20 pt-1 text-[11px] text-slate-300 sm:mt-2 sm:pt-1.5">
            <div className="truncate">
              Armor: {player.gender === 'male' ? costume?.maleTitle : costume?.femaleTitle}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
              <span className="truncate">Bow: {bow?.name}</span>
              {player.level >= 2 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Blade: {sword?.name}</span>
                </>
              )}
              {player.level >= 3 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-300">{power?.name}</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Kodama Challenge Round & Telemetry Card */}
        <section
          aria-label="Kodama Challenge Status"
          className="pointer-events-auto rounded-xl border border-rose-500/30 bg-[#080c0a]/92 px-3 py-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.75)] sm:px-4 sm:py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-300">
                Stage {stage} · Kodama Challenge
              </div>
              <div data-testid="kodama-round" className="font-display text-sm font-bold text-white">
                Round {roundHud.round} / {KODAMA_TOTAL_ROUNDS}
              </div>
            </div>
            <span
              data-testid="kodama-status"
              className={`shrink-0 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold ${
                roundHud.completed
                  ? roundHud.passed
                    ? 'border-emerald-400/50 bg-emerald-950/70 text-emerald-200'
                    : 'border-rose-400/50 bg-rose-950/70 text-rose-200'
                  : roundHud.hits >= KODAMA_MIN_HITS
                    ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-950/50 text-amber-200'
              }`}
            >
              {roundStatusLabel}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:mt-2.5 sm:gap-x-3 sm:text-xs">
            <div className="flex items-center justify-between gap-1 rounded bg-[#0d1712] px-2 py-1 sm:px-2.5">
              <span className="text-slate-400">Appeared</span>
              <span
                data-testid="kodama-appearing"
                className="whitespace-nowrap font-mono-id font-semibold text-white"
              >
                {roundHud.spawnedCount} / {roundHud.totalGhosts}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 rounded bg-[#0d1712] px-2 py-1 sm:px-2.5">
              <span className="text-slate-400">Hits</span>
              <span
                data-testid="kodama-hits"
                className="whitespace-nowrap font-mono-id font-semibold text-cyan-300"
              >
                {roundHud.hits}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 rounded bg-[#0d1712] px-2 py-1 sm:px-2.5">
              <span className="whitespace-nowrap text-slate-400">Min Hits</span>
              <span
                data-testid="kodama-min-hits"
                className="whitespace-nowrap font-mono-id font-semibold text-amber-300"
              >
                {roundHud.minRequiredHits}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 rounded bg-[#0d1712] px-2 py-1 sm:px-2.5">
              <span className="text-slate-400">Remaining</span>
              <span
                data-testid="kodama-remaining"
                className="whitespace-nowrap font-mono-id font-semibold text-rose-300"
              >
                {roundHud.remainingGhosts}
              </span>
            </div>
          </div>

          {/* Round Selector & Replay Controls */}
          <div className="mt-2 flex items-center justify-between gap-1.5 sm:mt-2.5">
            <div className="flex items-center gap-1">
              {KODAMA_ROUND_CONFIGS.map((cfg) => {
                const isDone = completedRoundsSet.has(cfg.round);
                const isCurrent = currentRound === cfg.round;
                return (
                  <button
                    key={cfg.round}
                    type="button"
                    data-testid={`select-round-${cfg.round}`}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      startRoundRun(cfg.round, stage);
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded border text-[11px] font-bold transition sm:w-9 ${
                      isCurrent
                        ? 'border-rose-400 bg-rose-950/75 text-white'
                        : isDone
                          ? 'border-emerald-500/45 bg-emerald-950/45 text-emerald-200 hover:border-emerald-400'
                          : 'border-slate-700 bg-[#0d1712] text-slate-300 hover:border-slate-500'
                    }`}
                    title={`${cfg.label} (${cfg.totalGhosts} ghosts)`}
                  >
                    R{cfg.round}
                    {isDone ? '✓' : ''}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              data-testid="kodama-restart-btn"
              onClick={(e) => {
                e.currentTarget.blur();
                startRoundRun(currentRound, stage);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-600 bg-[#0e1913] px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-white sm:px-2.5"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Restart
            </button>
          </div>

          {/* Stage Switcher: Stage 2 locked until all 5 Stage 1 rounds are completed */}
          <div className="mt-2 flex items-center gap-1.5 border-t border-emerald-500/15 pt-2">
            <button
              type="button"
              data-testid="stage-1-btn"
              onClick={() => handleSelectStage(1)}
              className={`flex-1 rounded border px-2 py-1 text-[11px] font-semibold transition ${
                stage === 1
                  ? 'border-emerald-400/70 bg-emerald-950/60 text-emerald-100'
                  : 'border-slate-700 bg-[#0c1410] text-slate-300 hover:border-emerald-400/40'
              }`}
            >
              Stage 1 ({completedRoundsSet.size}/5)
            </button>
            <button
              type="button"
              data-testid="stage-2-btn"
              aria-disabled={!player.kodamaProgress.stage2Unlocked}
              onClick={() => handleSelectStage(2)}
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition ${
                !player.kodamaProgress.stage2Unlocked
                  ? 'cursor-not-allowed border-slate-800 bg-[#0a0f0c] text-slate-400 opacity-75'
                  : stage === 2
                    ? 'border-rose-400/80 bg-rose-950/70 text-rose-100'
                    : 'border-amber-400/50 bg-amber-950/40 text-amber-200 hover:border-amber-300'
              }`}
            >
              {!player.kodamaProgress.stage2Unlocked ? (
                <>
                  <Lock className="h-3 w-3 text-amber-300" aria-hidden="true" />
                  Stage 2 Locked
                </>
              ) : (
                <>
                  <Trophy className="h-3 w-3 text-amber-300" aria-hidden="true" />
                  Stage 2
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Top Center Notification Banner (Level Up or Locked Attempt) */}
      {bannerMessage && (
        <div
          role="status"
          data-testid="game-banner"
          className={`pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-xl border px-4 py-2 text-xs font-semibold shadow-lg ${
            bannerTone === 'unlock'
              ? 'border-amber-400/60 bg-amber-950/95 text-amber-100'
              : 'border-rose-400/60 bg-rose-950/95 text-rose-100'
          }`}
        >
          {bannerMessage}
        </div>
      )}

      {/* Top Right Quick Actions (compact so central grass wall stays unobstructed) */}
      <div className="pointer-events-none absolute right-3 top-2.5 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onReturnToCustomize();
          }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-[#060e0a]/95 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-950/70 sm:px-3"
        >
          <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Customize Warrior</span>
          <span className="sm:hidden">Customize</span>
        </button>
        <button
          type="button"
          aria-label="Logout"
          onClick={(e) => {
            e.currentTarget.blur();
            onLogout();
          }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#060e0a]/95 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-rose-400/50 hover:text-white sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {/* Collapsible Right-Edge Sidebar Drawer (hidden by default during active gameplay) */}
      <aside
        id="hunter-gameplay-sidebar"
        data-testid="hunter-sidebar"
        data-open={sidebarOpen ? 'true' : 'false'}
        aria-label="Activities and Hunter Gadgets Sidebar"
        className={`pointer-events-none fixed right-0 top-[52px] z-30 w-[min(86vw,292px)] transition-transform duration-300 ease-out sm:top-16 sm:w-[286px] ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Edge Toggle Tab anchored to the right screen border when collapsed, sliding with drawer when open */}
        <button
          type="button"
          data-testid="sidebar-toggle-btn"
          aria-expanded={sidebarOpen}
          aria-controls="hunter-gameplay-sidebar"
          aria-label={sidebarOpen ? 'Close hunter sidebar' : 'Open hunter sidebar'}
          title={sidebarOpen ? 'Collapse Sidebar' : 'Open Activities & Gadgets Sidebar'}
          onClick={(e) => {
            e.currentTarget.blur();
            setSidebarOpen((prev) => !prev);
          }}
          className="pointer-events-auto absolute -left-9 top-1/2 flex h-24 w-9 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-xl border border-r-0 border-emerald-500/40 bg-[#060e0a] text-emerald-200 shadow-[-6px_0_20px_rgba(0,0,0,0.8)] transition hover:border-emerald-400 hover:bg-emerald-950 hover:text-white"
        >
          {sidebarOpen ? (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="[writing-mode:vertical-rl] text-[10px] font-bold uppercase tracking-widest">
            {sidebarOpen ? 'Hide' : 'Gear'}
          </span>
        </button>

        {/* Scrollable Sidebar Contents */}
        <section
          aria-hidden={!sidebarOpen}
          aria-label="Activities and Hunter Gadgets"
          className={`max-h-[calc(100vh-7.5rem)] w-full overflow-y-auto rounded-l-xl border border-r-0 border-emerald-500/35 bg-[#060e0a] p-3 shadow-[0_12px_36px_rgba(0,0,0,0.9)] ${
            sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Activities
            </span>
            <span className="text-[10px] text-slate-400">Keys 1–5</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {ACTIVITY_DEFINITIONS.map((act) => {
              const unlocked = isActivityUnlocked(player.level, act.id);
              const selected = activeActivity === act.id && unlocked;
              return (
                <button
                  key={act.id}
                  type="button"
                  tabIndex={sidebarOpen ? 0 : -1}
                  disabled={!unlocked}
                  aria-disabled={!unlocked}
                  aria-pressed={selected}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleSelectActivity(act.id);
                  }}
                  data-testid={`activity-${act.id}`}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                    !unlocked
                      ? 'cursor-not-allowed border-slate-800/90 bg-[#080d0b]/80 opacity-65'
                      : selected
                        ? 'border-emerald-400 bg-emerald-950/60 text-white'
                        : 'border-slate-700/70 bg-[#0b1510] text-slate-200 hover:border-emerald-400/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={unlocked ? 'text-emerald-300' : 'text-slate-500'}>
                      {renderActivityIcon(act.id)}
                    </span>
                    <div>
                      <div className="font-semibold text-white">{act.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {unlocked
                          ? `Key ${act.shortcut} · +${act.xpPerHit} XP/hit`
                          : `Unlock at Level ${act.requiredLevel}`}
                      </div>
                    </div>
                  </div>
                  {!unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Lv.{act.requiredLevel}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-300">
                      {selected ? 'Active' : 'Ready'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 border-b border-emerald-500/20 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Equipment &amp; Gadgets
          </div>
          <div className="mt-2 space-y-1.5">
            {GADGET_DEFINITIONS.map((gad) => {
              const unlocked = isGadgetUnlocked(player.level, gad.id);
              const isOn =
                (gad.id === 'spirit_talisman' && talismanActive) ||
                (gad.id === 'yokai_radar' && radarActive) ||
                (gad.id === 'archery_bow' && activeActivity === 'archery') ||
                (gad.id === 'hunter_blade' && activeActivity === 'sword_combat') ||
                (gad.id === 'spirit_beam' && activeActivity === 'superpower_burst');
              return (
                <button
                  key={gad.id}
                  type="button"
                  tabIndex={sidebarOpen ? 0 : -1}
                  disabled={!unlocked}
                  aria-disabled={!unlocked}
                  aria-pressed={unlocked && isOn}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleGadgetAction(gad.id);
                  }}
                  data-testid={`gadget-${gad.id}`}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition ${
                    !unlocked
                      ? 'cursor-not-allowed border-slate-800/90 bg-[#080d0b]/80 opacity-65'
                      : isOn
                        ? 'border-emerald-400/70 bg-emerald-950/50 text-emerald-100'
                        : 'border-slate-700/60 bg-[#0b1510] text-slate-300 hover:border-emerald-400/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={unlocked ? 'text-emerald-300' : 'text-slate-500'}>
                      {renderGadgetIcon(gad.id)}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-100">{gad.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {unlocked ? `Key ${gad.shortcut}` : `Unlock at Level ${gad.requiredLevel}`}
                      </div>
                    </div>
                  </div>
                  {!unlocked && (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          {radarActive && player.level >= 3 && (
            <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1.5 text-[10px] text-emerald-200">
              Compass: {roundHud.activeCount} active Kodama signature(s) along the moss wall.
            </div>
          )}
        </section>
      </aside>

      {/* Round End / Replay Modal */}
      {roundOutcome && !showStage2Modal && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="kodama-round-modal"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#090f0c] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
            <div className="text-xs font-bold uppercase tracking-widest text-rose-300">
              Stage {stage} · Round {roundOutcome.round} Result
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-white">
              {roundOutcome.passed ? 'Round Cleared!' : 'Round Failed — Try Again'}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {roundOutcome.passed
                ? 'You banished enough Kodama spirits emerging from the overgrown wall.'
                : `You needed at least ${roundOutcome.minRequiredHits} hits to pass this round. Your earned diamonds remain saved.`}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-slate-800 bg-[#0d1712] px-3 py-2">
                <div className="text-[10px] uppercase text-slate-400">Hits</div>
                <div className="font-mono-id text-lg font-bold text-cyan-300">
                  {roundOutcome.hits} / {roundOutcome.totalGhosts}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0d1712] px-3 py-2">
                <div className="text-[10px] uppercase text-slate-400">Required</div>
                <div className="font-mono-id text-lg font-bold text-amber-300">
                  {roundOutcome.minRequiredHits}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0d1712] px-3 py-2">
                <div className="text-[10px] uppercase text-slate-400">Diamonds</div>
                <div className="font-mono-id text-lg font-bold text-cyan-200">
                  {player.kodamaProgress.diamonds}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                data-testid="modal-replay-round"
                onClick={() => startRoundRun(roundOutcome.round, stage)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#101c16] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:border-emerald-400"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {roundOutcome.passed ? 'Replay Round' : 'Retry Round'}
              </button>

              {roundOutcome.passed && roundOutcome.round < KODAMA_TOTAL_ROUNDS && (
                <button
                  type="button"
                  data-testid="modal-next-round"
                  onClick={() => startRoundRun(roundOutcome.round + 1, stage)}
                  className="rounded-lg border border-emerald-400/60 bg-emerald-800/80 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  Next Round (R{roundOutcome.round + 1})
                </button>
              )}

              {player.kodamaProgress.stage2Unlocked && (
                <button
                  type="button"
                  data-testid="modal-stage2-summary"
                  onClick={() => setShowStage2Modal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/70 bg-amber-800/80 px-4 py-2 text-xs font-bold text-amber-50 transition hover:bg-amber-700"
                >
                  <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                  Stage 2 Unlocked
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage 2 Completion Screen (Unlocked strictly when all 5 rounds completed with >= 6 hits each) */}
      {showStage2Modal && player.kodamaProgress.stage2Unlocked && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="kodama-stage2-modal"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/75 px-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-amber-400/60 bg-[#080f0b] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.9)]">
            <div className="inline-flex items-center gap-1.5 rounded border border-amber-400/40 bg-amber-950/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
              All 5 Kodama Rounds Mastered
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">
              Stage 2 Unlocked!
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              You defeated the haunted Kodama spirits across all five rounds with your bow and earned{' '}
              <span className="font-bold text-cyan-300">{player.kodamaProgress.diamonds} Diamonds</span>.
            </p>

            <div className="mt-4 space-y-1.5">
              {KODAMA_ROUND_CONFIGS.map((cfg) => (
                <div
                  key={cfg.round}
                  className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-[#0d1913] px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 font-semibold text-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    {cfg.label}
                  </div>
                  <span className="font-mono-id text-emerald-300">
                    {cfg.totalGhosts} Ghosts · Cleared
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-950/50 px-3 py-2 text-xs font-bold text-cyan-200">
                <Gem className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                Total Diamonds: <span data-testid="stage2-total-diamonds">{player.kodamaProgress.diamonds}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="replay-stage1-btn"
                  onClick={() => startRoundRun(1, 1)}
                  className="rounded-lg border border-slate-600 bg-[#101c16] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400"
                >
                  Replay Stage 1
                </button>
                <button
                  type="button"
                  data-testid="enter-stage2-btn"
                  onClick={() => startRoundRun(1, 2)}
                  className="rounded-lg border border-rose-400/70 bg-rose-800/85 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                >
                  Enter Stage 2
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Control Hint */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 w-[calc(100vw-1.5rem)] max-w-[366px] -translate-x-1/2 rounded-lg border border-emerald-500/25 bg-[#060e0a]/92 px-3 py-1 text-center text-[11px] text-slate-300 sm:bottom-4 sm:w-auto sm:max-w-none sm:px-4 sm:py-1.5 sm:text-xs">
        <span className="sm:hidden">
          {player.level === 1
            ? 'Tap / Space: Shoot Ghosts · WASD: Move · 6+ Hits/Round'
            : 'WASD Move · Tap / Space Shoot · Keys 1–5 Switch Gear'}
        </span>
        <span className="hidden sm:inline">
          {player.level === 1
            ? 'Aim & Click (or Space) to Shoot Kodama Ghosts · WASD / Arrows Move · Min 6 Hits per Round (+1 Diamond / Hit)'
            : 'WASD Move · Click / Space Shoot Kodama Spirits · Keys 1–5 Switch Unlocked Activities & Gadgets'}
        </span>
      </div>
    </main>
  );
}
