import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Crosshair,
  Flame,
  Gem,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Sliders,
  Sparkles,
  Swords,
  Trophy,
  UserCog,
  X,
} from 'lucide-react';
import {
  ARCHERY_OPTIONS,
  COSTUME_OPTIONS,
  SUPERPOWER_OPTIONS,
  SWORD_OPTIONS,
} from '../data/customizationCatalog';
import {
  getRoundConfig,
  KODAMA_ROUND_CONFIGS,
  KODAMA_TOTAL_ROUNDS,
  KodamaRoundHudSnapshot,
  KodamaRoundOutcome,
  KodamaSpawnKind,
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
import { ActivityId, CharacterCustomization, GadgetId, Gender, PlayerAccount } from '../types/game';
import ProfileSettingsModal from './ProfileSettingsModal';

interface GameWorldScreenProps {
  player: PlayerAccount;
  customization: CharacterCustomization;
  onRecordActivity: (activityId: ActivityId) => Promise<{
    leveledUp: boolean;
    newLevel: number;
    newlyUnlocked: string[];
  }>;
  onKodamaHit: (
    kind: KodamaSpawnKind,
    ghostKey: string,
  ) => Promise<{
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
  onUpdateProfile: (username: string, gender: Gender) => Promise<void>;
  onReturnToCustomize: () => void;
  onExitToMenu: () => Promise<void> | void;
  onLogout: () => void;
}

export default function GameWorldScreen({
  player,
  customization,
  onRecordActivity,
  onKodamaHit,
  onKodamaRoundComplete,
  onUpdateProfile,
  onReturnToCustomize,
  onExitToMenu,
  onLogout,
}: GameWorldScreenProps) {
  const [activeActivity, setActiveActivity] = useState<ActivityId>('archery');
  const [talismanActive, setTalismanActive] = useState(false);
  const [radarActive, setRadarActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [exitingMenu, setExitingMenu] = useState(false);
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

  const effectivePaused = paused || profileSettingsOpen;
  const pausedRef = useRef(effectivePaused);
  pausedRef.current = effectivePaused;

  const initialRoundCfg = getRoundConfig(currentRound);
  const [roundHud, setRoundHud] = useState<KodamaRoundHudSnapshot>({
    round: currentRound,
    stage: 1,
    totalGhosts: initialRoundCfg.totalGhosts,
    spawnedCount: 0,
    activeCount: 0,
    hits: 0,
    minRequiredHits: initialRoundCfg.minHits,
    remainingGhosts: initialRoundCfg.totalGhosts,
    completed: false,
    passed: false,
  });

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
    const timer = window.setTimeout(() => setBannerMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  useEffect(() => {
    const onPauseKey = (e: KeyboardEvent) => {
      if (profileSettingsOpen) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setProfileSettingsOpen(false);
        }
        return;
      }
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;
      if (roundOutcome || showStage2Modal) return;
      e.preventDefault();
      if (paused && confirmExitOpen && e.code === 'Escape') {
        setConfirmExitOpen(false);
        return;
      }
      setConfirmExitOpen(false);
      setSidebarOpen(false);
      setPaused((prev) => !prev);
    };
    window.addEventListener('keydown', onPauseKey);
    return () => window.removeEventListener('keydown', onPauseKey);
  }, [paused, profileSettingsOpen, confirmExitOpen, roundOutcome, showStage2Modal]);

  const openPauseMenu = () => {
    if (paused || roundOutcome || showStage2Modal || profileSettingsOpen) return;
    setSidebarOpen(false);
    setConfirmExitOpen(false);
    setPaused(true);
  };

  const handleSelectActivity = (id: ActivityId) => {
    if (pausedRef.current) return;
    const def = ACTIVITY_DEFINITIONS.find((a) => a.id === id);
    if (!def) return;
    if (!isActivityUnlocked(player.level, id)) {
      setBannerTone('locked');
      setBannerMessage(`${def.name} unlocks at Level ${def.requiredLevel}.`);
      return;
    }
    setActiveActivity(id);
  };

  const handleGadgetAction = (id: GadgetId) => {
    if (pausedRef.current) return;
    const def = GADGET_DEFINITIONS.find((g) => g.id === id);
    if (!def) return;
    if (!isGadgetUnlocked(player.level, id)) {
      setBannerTone('locked');
      setBannerMessage(`${def.name} unlocks at Level ${def.requiredLevel}.`);
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
      if (pausedRef.current) return;
      try {
        const res = await onRecordActivity(activityId);
        if (res.leveledUp) {
          setBannerTone('unlock');
          setBannerMessage(
            `Level Up! Reached Level ${res.newLevel} (${getLevelTitle(res.newLevel)})!`,
          );
        }
      } catch (err) {
        setBannerTone('locked');
        setBannerMessage(err instanceof Error ? err.message : 'Unable to record activity.');
      }
    },
    [onRecordActivity],
  );

  const handleKodamaHit = useCallback(
    async (kind: KodamaSpawnKind, ghostKey: string) => {
      if (pausedRef.current) return;
      try {
        const res = await onKodamaHit(kind, ghostKey);
        if (res.leveledUp) {
          setBannerTone('unlock');
          setBannerMessage(
            `Level Up! Reached Level ${res.newLevel} (${getLevelTitle(res.newLevel)})!`,
          );
        }
      } catch (err) {
        setBannerTone('locked');
        setBannerMessage(err instanceof Error ? err.message : 'Unable to record diamond reward.');
      }
    },
    [onKodamaHit],
  );

  const handleRoundFinished = useCallback(
    async (outcome: KodamaRoundOutcome) => {
      setPaused(false);
      setConfirmExitOpen(false);
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
    setPaused(false);
    setConfirmExitOpen(false);
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
      setBannerMessage('Stage 2 unlocks after completing all 5 Stage 1 rounds.');
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
    : roundHud.hits >= roundHud.minRequiredHits
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
    <main className="relative flex h-screen w-screen overflow-hidden bg-[#050a07] text-slate-100">
      {/* Collapsible Sidebar (Levels, Profile, Round Telemetry, & Gear — Closed by default during play; closing expands desktop canvas width) */}
      <aside
        id="hunter-gameplay-sidebar"
        data-testid="hunter-sidebar"
        data-open={sidebarOpen ? 'true' : 'false'}
        aria-hidden={!sidebarOpen}
        aria-label="Levels and Hunter Information Sidebar"
        className={`fixed inset-y-0 left-0 z-30 flex h-full flex-col border-emerald-500/25 bg-[#060d09] transition-all duration-300 ease-out md:relative md:inset-auto md:z-20 md:shrink-0 ${
          sidebarOpen
            ? 'w-[min(86vw,300px)] translate-x-0 border-r shadow-[8px_0_32px_rgba(0,0,0,0.85)] md:w-[300px] md:shadow-none'
            : 'pointer-events-none w-[min(86vw,300px)] -translate-x-full border-r-0 md:w-0 md:translate-x-0 md:overflow-hidden'
        }`}
      >
        <div className="flex w-[min(86vw,300px)] shrink-0 items-center justify-between border-b border-emerald-500/20 px-4 py-3 md:w-[300px]">
          <span className="font-display text-xs font-bold tracking-widest text-emerald-200">
            LEVELS &amp; HUNTER INFO
          </span>
          <button
            type="button"
            data-testid="sidebar-close-btn"
            tabIndex={sidebarOpen ? 0 : -1}
            aria-label="Close sidebar"
            onClick={(e) => {
              e.currentTarget.blur();
              setSidebarOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#0b1510] px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-emerald-400/60 hover:text-white"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Close
          </button>
        </div>

        <div className="yh-scroll flex w-[min(86vw,300px)] flex-1 flex-col gap-3 overflow-y-auto p-3.5 md:w-[300px]">
          {/* Hunter Profile + Level Progression Card */}
          <section className="rounded-xl border border-emerald-500/25 bg-[#09120d] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div data-testid="game-username" className="truncate text-sm font-bold text-white">
                  {player.username}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span data-testid="game-gender" className="uppercase text-emerald-300">
                    {player.gender}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span data-testid="game-player-id" className="font-mono-id">
                    {player.playerId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                tabIndex={sidebarOpen ? 0 : -1}
                data-testid="sidebar-profile-settings-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setProfileSettingsOpen(true);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/35 bg-[#0d1c14] px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:border-emerald-400 hover:text-white"
              >
                <UserCog className="h-3.5 w-3.5" aria-hidden="true" />
                Profile
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-xs">
              <span
                data-testid="game-level"
                className="font-mono-id font-bold text-amber-300"
              >
                Lv.{player.level} · {getLevelTitle(player.level)}
              </span>
              <span data-testid="game-orbs-cleared" className="font-mono-id text-[11px] text-emerald-300">
                {player.orbsCleared} Eliminated
              </span>
            </div>

            <div className="mt-1.5">
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>XP Progress</span>
                <span data-testid="game-xp" className="font-mono-id text-slate-200">
                  {player.xp}
                  {nextThreshold ? ` / ${nextThreshold.minXp}` : ' (MAX)'}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>

            <div className="mt-2 border-t border-emerald-500/15 pt-1.5 text-[11px] text-slate-300">
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

          {/* Kodama Challenge Round & Stage Controls */}
          <section
            aria-label="Kodama Challenge Status"
            className="rounded-xl border border-rose-500/30 bg-[#09100c] p-3"
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
                    : roundHud.hits >= roundHud.minRequiredHits
                      ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-200'
                      : 'border-amber-400/40 bg-amber-950/50 text-amber-200'
                }`}
              >
                {roundStatusLabel}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between rounded bg-[#0d1712] px-2 py-1">
                <span className="text-slate-400">Appeared</span>
                <span data-testid="kodama-appearing" className="font-mono-id font-semibold text-white">
                  {roundHud.spawnedCount} / {roundHud.totalGhosts}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-[#0d1712] px-2 py-1">
                <span className="text-slate-400">Hits</span>
                <span data-testid="kodama-hits" className="font-mono-id font-semibold text-cyan-300">
                  {roundHud.hits}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-[#0d1712] px-2 py-1">
                <span className="text-slate-400">Min Hits</span>
                <span data-testid="kodama-min-hits" className="font-mono-id font-semibold text-amber-300">
                  {roundHud.minRequiredHits}
                </span>
              </div>
              <div className="flex items-center justify-between rounded bg-[#0d1712] px-2 py-1">
                <span className="text-slate-400">Remaining</span>
                <span data-testid="kodama-remaining" className="font-mono-id font-semibold text-rose-300">
                  {roundHud.remainingGhosts}
                </span>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-cyan-200/90">
              2 cyan running ghosts appear each round (+1 Diamond each).
            </p>

            {/* Round Selector & Replay Controls */}
            <div className="mt-2 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1">
                {KODAMA_ROUND_CONFIGS.map((cfg) => {
                  const isDone = completedRoundsSet.has(cfg.round);
                  const isCurrent = currentRound === cfg.round;
                  return (
                    <button
                      key={cfg.round}
                      type="button"
                      tabIndex={sidebarOpen ? 0 : -1}
                      data-testid={`select-round-${cfg.round}`}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        startRoundRun(cfg.round, stage);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded border text-[11px] font-bold transition ${
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
                tabIndex={sidebarOpen ? 0 : -1}
                data-testid="kodama-restart-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startRoundRun(currentRound, stage);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-600 bg-[#0e1913] px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Restart
              </button>
            </div>

            {/* Stage Switcher */}
            <div className="mt-2 flex items-center gap-1.5 border-t border-emerald-500/15 pt-2">
              <button
                type="button"
                tabIndex={sidebarOpen ? 0 : -1}
                data-testid="stage-1-btn"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSelectStage(1);
                }}
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
                tabIndex={sidebarOpen ? 0 : -1}
                data-testid="stage-2-btn"
                aria-disabled={!player.kodamaProgress.stage2Unlocked}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSelectStage(2);
                }}
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

          {/* Activities */}
          <section className="rounded-xl border border-emerald-500/20 bg-[#09120d] p-3">
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

            <div className="mt-3 border-b border-emerald-500/20 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
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
                Compass: {roundHud.activeCount} active Kodama spirit(s) along the wall.
              </div>
            )}
          </section>

          {/* Bottom Sidebar Actions */}
          <div className="mt-auto flex items-center gap-2 pt-1">
            <button
              type="button"
              tabIndex={sidebarOpen ? 0 : -1}
              onClick={(e) => {
                e.currentTarget.blur();
                onReturnToCustomize();
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-[#0a1610] px-2.5 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-950/70"
            >
              <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
              Customize Gear
            </button>
            <button
              type="button"
              tabIndex={sidebarOpen ? 0 : -1}
              aria-label="Logout"
              onClick={(e) => {
                e.currentTarget.blur();
                onLogout();
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0a120e] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-rose-400/50 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Game Widget Container (expands cleanly when sidebar closes) */}
      <div className="relative h-full min-w-0 flex-1" data-testid="game-widget-area">
        <SanctuaryGameCanvas
          gender={player.gender}
          customization={customization}
          playerLevel={player.level}
          activeActivity={activeActivity}
          talismanActive={talismanActive}
          round={currentRound}
          stage={stage}
          roundRunKey={roundRunKey}
          paused={effectivePaused}
          onKodamaHit={handleKodamaHit}
          onRoundStatsChange={setRoundHud}
          onRoundFinished={handleRoundFinished}
          onActivityHit={handleActivityHit}
          onSelectActivity={handleSelectActivity}
          onToggleTalisman={() => handleGadgetAction('spirit_talisman')}
          onToggleRadar={() => handleGadgetAction('yokai_radar')}
          onLockedAttempt={handleLockedAttempt}
        />

        {/* Top-Left Perimeter Control: Open/Close Sidebar + Ultra-Compact Round Readout */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-2 sm:left-4 sm:top-4">
          <button
            type="button"
            data-testid="sidebar-toggle-btn"
            aria-expanded={sidebarOpen}
            aria-controls="hunter-gameplay-sidebar"
            aria-label={sidebarOpen ? 'Close levels sidebar' : 'Open levels sidebar'}
            onClick={(e) => {
              e.currentTarget.blur();
              setSidebarOpen((prev) => !prev);
            }}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-[#060e0a]/95 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 shadow-lg transition hover:border-emerald-400 hover:bg-emerald-950/85 sm:px-3"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            )}
            <span>{sidebarOpen ? 'Hide Sidebar' : 'Levels & Info'}</span>
          </button>

          <div
            data-testid="compact-round-pill"
            className="pointer-events-none hidden items-center gap-2 rounded-lg border border-emerald-500/25 bg-[#060e0a]/90 px-2.5 py-1.5 font-mono-id text-[11px] font-semibold text-slate-200 sm:inline-flex"
          >
            <span className="text-rose-300">R{roundHud.round}</span>
            <span aria-hidden="true">·</span>
            <span>
              Hits {roundHud.hits}/{roundHud.minRequiredHits}
            </span>
          </div>
        </div>

        {/* Top-Right Perimeter Cluster: Always-Visible Diamond Counter + Profile Settings + Pause */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-4 sm:top-4">
          {/* Permanent Diamond Counter beside the game widget */}
          <div
            data-testid="kodama-diamonds"
            aria-label={`Diamonds: ${player.kodamaProgress.diamonds}`}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/55 bg-[#061218]/95 px-2.5 py-1.5 font-mono-id text-xs font-bold text-cyan-100 shadow-[0_6px_20px_rgba(0,0,0,0.75)] sm:px-3 sm:text-sm"
          >
            <Gem className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
            <span className="tabular-nums">{player.kodamaProgress.diamonds}</span>
          </div>

          <button
            type="button"
            data-testid="open-profile-settings-btn"
            aria-label="Profile Settings"
            title="Profile Settings"
            onClick={(e) => {
              e.currentTarget.blur();
              setProfileSettingsOpen(true);
            }}
            className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-[#060e0a]/95 px-2.5 text-xs font-semibold text-emerald-100 shadow-md transition hover:border-emerald-400 hover:bg-emerald-950/80"
          >
            <UserCog className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
            <span className="hidden sm:inline">{player.username}</span>
          </button>

          <button
            type="button"
            data-testid="pause-btn"
            aria-label="Pause game"
            title="Pause Game (Esc / P)"
            disabled={Boolean(roundOutcome || showStage2Modal)}
            onClick={(e) => {
              e.currentTarget.blur();
              openPauseMenu();
            }}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/45 bg-[#090f0c]/95 text-rose-200 shadow-md transition-all duration-150 hover:scale-105 hover:border-rose-400 hover:bg-rose-950/80 hover:text-white active:scale-95 disabled:opacity-45"
          >
            <Pause className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Transient Bottom Toast (never covers center play area) */}
        {bannerMessage && (
          <div
            role="status"
            data-testid="game-banner"
            className={`pointer-events-none absolute bottom-10 left-1/2 z-30 -translate-x-1/2 rounded-lg border px-3.5 py-1.5 text-xs font-semibold shadow-lg ${
              bannerTone === 'unlock'
                ? 'border-amber-400/60 bg-amber-950/95 text-amber-100'
                : 'border-rose-400/60 bg-rose-950/95 text-rose-100'
            }`}
          >
            {bannerMessage}
          </div>
        )}

        {/* Slim Bottom Control Hint */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#050b08]/80 px-3 py-1 text-[11px] text-slate-300">
          <span className="sm:hidden">Tap / Space Shoot · WASD Move · Cyan Ghosts = +1 Diamond</span>
          <span className="hidden sm:inline">
            Click / Space Shoot · WASD Move · Cyan Running Ghosts = +1 Diamond · Esc Pause
          </span>
        </div>

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

        {/* Stage 2 Completion Modal */}
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

        {/* Pause Menu Overlay */}
        {paused && !roundOutcome && !showStage2Modal && !profileSettingsOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Game Paused"
            data-testid="pause-menu"
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 px-4 transition-opacity duration-200"
          >
            <div className="w-full max-w-sm rounded-2xl border border-rose-500/45 bg-[#070d0a] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.92)]">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-300">
                  Stage {stage} · Round {roundHud.round} / {KODAMA_TOTAL_ROUNDS}
                </div>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-wider text-white">
                  {confirmExitOpen ? 'LEAVE CHALLENGE?' : 'GAME PAUSED'}
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  {confirmExitOpen
                    ? 'Are you sure you want to leave this game?'
                    : `Hits: ${roundHud.hits} / ${roundHud.minRequiredHits} required · Diamonds: ${player.kodamaProgress.diamonds}`}
                </p>
              </div>

              {!confirmExitOpen ? (
                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    data-testid="pause-resume-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setConfirmExitOpen(false);
                      setPaused(false);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-900/75 px-4 py-2.5 text-sm font-bold tracking-wider text-white transition-all duration-150 hover:scale-[1.01] hover:border-emerald-300 hover:bg-emerald-800 active:scale-[0.98]"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    RESUME
                  </button>
                  <button
                    type="button"
                    data-testid="pause-restart-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      startRoundRun(currentRound, stage);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/45 bg-[#111c16] px-4 py-2.5 text-sm font-bold tracking-wider text-amber-100 transition-all duration-150 hover:scale-[1.01] hover:border-amber-300 hover:bg-[#16271e] active:scale-[0.98]"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    RESTART
                  </button>
                  <button
                    type="button"
                    data-testid="pause-exit-btn"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setConfirmExitOpen(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/45 bg-rose-950/55 px-4 py-2.5 text-sm font-bold tracking-wider text-rose-100 transition-all duration-150 hover:scale-[1.01] hover:border-rose-400 hover:bg-rose-900/75 active:scale-[0.98]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    EXIT
                  </button>
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="exit-confirm-cancel"
                    disabled={exitingMenu}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setConfirmExitOpen(false);
                    }}
                    className="flex-1 rounded-xl border border-slate-600 bg-[#0e1913] px-4 py-2.5 text-xs font-bold tracking-wider text-slate-200 transition-all duration-150 hover:scale-[1.01] hover:border-emerald-400 hover:text-white active:scale-[0.98]"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    data-testid="exit-confirm-yes"
                    disabled={exitingMenu}
                    onClick={async (e) => {
                      e.currentTarget.blur();
                      setExitingMenu(true);
                      try {
                        await onExitToMenu();
                      } finally {
                        setExitingMenu(false);
                      }
                    }}
                    className="flex-1 rounded-xl border border-rose-400/70 bg-rose-800/85 px-4 py-2.5 text-xs font-bold tracking-wider text-white transition-all duration-150 hover:scale-[1.01] hover:bg-rose-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    {exitingMenu ? 'SAVING...' : 'YES'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {profileSettingsOpen && (
        <ProfileSettingsModal
          player={player}
          onSaveProfile={onUpdateProfile}
          onClose={() => setProfileSettingsOpen(false)}
        />
      )}
    </main>
  );
}
