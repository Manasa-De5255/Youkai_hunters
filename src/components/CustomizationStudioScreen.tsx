import { useState } from 'react';
import { BookOpen, Lock, LogOut, Play, RotateCcw, RotateCw, Users } from 'lucide-react';
import {
  ARCHERY_OPTIONS,
  COSTUME_OPTIONS,
  CUSTOMIZATION_CATEGORIES,
  HAIR_COLOR_OPTIONS,
  HAIR_STYLE_OPTIONS,
  SKIN_TONE_OPTIONS,
  SUPERPOWER_OPTIONS,
  SWORD_OPTIONS,
  UPLOADED_ASSETS,
} from '../data/customizationCatalog';
import {
  CATEGORY_UNLOCK_LEVELS,
  getLevelTitle,
  getNextLevelThreshold,
  getRequiredLevelForItem,
  isCategoryUnlocked,
  isItemUnlocked,
} from '../data/progressionCatalog';
import CharacterStageCanvas from '../three/CharacterStageCanvas';
import {
  CharacterCustomization,
  CustomizationCategoryKey,
  PlayerAccount,
} from '../types/game';
import { FantasyCategoryIcon } from './FantasyIcons';

interface CustomizationStudioScreenProps {
  player: PlayerAccount;
  customization: CharacterCustomization;
  onChangeCustomization: (next: CharacterCustomization) => void;
  onSwitchGenderScreen: () => void;
  onSaveAndStartGame: () => Promise<void>;
  onLogout: () => void;
}

export default function CustomizationStudioScreen({
  player,
  customization,
  onChangeCustomization,
  onSwitchGenderScreen,
  onSaveAndStartGame,
  onLogout,
}: CustomizationStudioScreenProps) {
  const [activeCategory, setActiveCategory] = useState<CustomizationCategoryKey>(
    player.level >= 2 ? 'costume' : 'archery',
  );
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [flourishSignal, setFlourishSignal] = useState(0);
  const [resetViewSignal, setResetViewSignal] = useState(0);
  const [rotateStepSignal, setRotateStepSignal] = useState({ seq: 0, deltaRad: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const propToItemType = {
    costume: 'costume',
    hairStyle: 'hairStyle',
    hairColor: 'hairColor',
    sword: 'sword',
    archery: 'archery',
    superpower: 'superpower',
    skinTone: 'skinTone',
  } as const;

  const updateField = <K extends keyof CharacterCustomization>(
    key: K,
    value: CharacterCustomization[K],
    triggerFlourish = false,
  ) => {
    const itemType = propToItemType[key];
    if (!isItemUnlocked(player.level, player.unlockedItems, itemType, String(value))) {
      return;
    }
    onChangeCustomization({
      ...customization,
      [key]: value,
    });
    if (triggerFlourish) {
      setFlourishSignal((n) => n + 1);
    }
  };

  const handleIconClick = (cat: CustomizationCategoryKey) => {
    if (activeCategory === cat) {
      setDrawerOpen((open) => !open);
    } else {
      setActiveCategory(cat);
      setDrawerOpen(true);
    }
  };

  const handleStartClick = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await onSaveAndStartGame();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save customization.');
    } finally {
      setSaving(false);
    }
  };

  const activeCategoryMeta = CUSTOMIZATION_CATEGORIES.find((c) => c.key === activeCategory)!;
  const nextThreshold = getNextLevelThreshold(player.level);
  const currentThresholdMin =
    player.level === 1 ? 0 : getNextLevelThreshold(player.level - 1)?.minXp ?? 0;
  const xpProgressPct = nextThreshold
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((player.xp - currentThresholdMin) /
              Math.max(1, nextThreshold.minXp - currentThresholdMin)) *
              100,
          ),
        ),
      )
    : 100;

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#06040a] text-slate-100 select-none">
      {/* Uploaded Customization Background */}
      <img
        src={UPLOADED_ASSETS.customizationBg}
        alt="Yokai Hunters sanctuary backdrop"
        referrerPolicy="no-referrer"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* Subtle dark vignette for UI legibility without hiding the crimson sanctuary */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#040712]/65 via-transparent to-[#040712]/70"
        aria-hidden="true"
      />

      {/* CENTER: Full-viewport 3D WebGL stage keeping character medium-sized in exact center */}
      <div className="absolute inset-0 z-10">
        <CharacterStageCanvas
          gender={player.gender}
          customization={customization}
          playerLevel={player.level}
          flourishSignal={flourishSignal}
          resetViewSignal={resetViewSignal}
          rotateStepSignal={rotateStepSignal}
        />
      </div>

      {/* TOP LEFT CORNER: Player Info + Separate MANUAL Box */}
      <aside
        aria-label="Player Information and Manual"
        className="pointer-events-none absolute left-5 top-5 z-20 flex w-[256px] flex-col gap-3"
      >
        {/* Player Information Card */}
        <div className="pointer-events-auto rounded-xl border border-cyan-400/25 bg-[#060b18]/88 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
            <span className="font-display text-xs font-bold tracking-widest text-cyan-300">
              HUNTER PROFILE
            </span>
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3 w-3" aria-hidden="true" />
              Logout
            </button>
          </div>

          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Player ID</dt>
              <dd data-testid="hud-player-id" className="font-mono-id font-semibold text-cyan-300">
                {player.playerId}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Username</dt>
              <dd data-testid="hud-username" className="font-semibold text-white">
                {player.username}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Category</dt>
              <dd data-testid="hud-gender" className="font-semibold uppercase tracking-wider text-cyan-200">
                {player.gender}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-400">Level</dt>
              <dd data-testid="hud-level" className="font-mono-id font-semibold text-amber-300">
                Lv.{player.level} · {getLevelTitle(player.level)}
              </dd>
            </div>
          </dl>

          {/* XP Progression Bar */}
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
              <span>Progression XP</span>
              <span className="font-mono-id text-cyan-200">
                {nextThreshold ? `${player.xp} / ${nextThreshold.minXp} XP` : `${player.xp} XP (MAX)`}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400 transition-all duration-300"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onSwitchGenderScreen}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0b1326] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-100"
          >
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Switch Gender Category
          </button>
        </div>

        {/* Separate MANUAL Box */}
        <div className="pointer-events-auto rounded-xl border border-cyan-400/20 bg-[#060b18]/86 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-2">
            <BookOpen className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
            <h2 className="font-display text-xs font-bold tracking-widest text-cyan-200">MANUAL</h2>
          </div>
          <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-slate-300">
            <li>1. Drag across the warrior to rotate 360° and inspect details.</li>
            <li>2. Scroll the mouse wheel to zoom closer or wider.</li>
            <li>3. At Level 1, Archery gear is unlocked. Earn XP in the Sanctuary to unlock Level 2+ blades, armor, and powers.</li>
            <li>4. Click START GAME at bottom right to save and enter the realm.</li>
          </ul>
        </div>
      </aside>

      {/* BOTTOM CENTER: 360 rotation controls + Reset camera */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-cyan-500/25 bg-[#060b18]/88 px-3.5 py-1.5 text-xs text-slate-300">
          <span>Drag 360°</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() =>
              setRotateStepSignal((s) => ({ seq: s.seq + 1, deltaRad: -Math.PI / 4 }))
            }
            aria-label="Rotate Left 45 degrees"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-cyan-300 transition hover:bg-white/10 hover:text-cyan-100"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            -45°
          </button>
          <button
            type="button"
            onClick={() =>
              setRotateStepSignal((s) => ({ seq: s.seq + 1, deltaRad: Math.PI / 4 }))
            }
            aria-label="Rotate Right 45 degrees"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-cyan-300 transition hover:bg-white/10 hover:text-cyan-100"
          >
            +45°
            <RotateCw className="h-3 w-3" aria-hidden="true" />
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setResetViewSignal((n) => n + 1)}
            className="font-medium text-cyan-200 transition hover:text-white"
          >
            Reset View
          </button>
        </div>
      </div>

      {/* RIGHT SIDE: Organized Icon Rail + Compact Single Selection Drawer */}
      <div className="pointer-events-none absolute right-5 top-5 z-20 flex items-start gap-3">
        {/* Compact Side Drawer for Active Icon */}
        {drawerOpen && (
          <section
            aria-label={`${activeCategoryMeta.label} customization options`}
            data-testid={`panel-${activeCategory}`}
            className="pointer-events-auto flex max-h-[calc(100vh-128px)] w-[304px] flex-col rounded-xl border border-cyan-400/28 bg-[#060b18]/90 shadow-[0_16px_44px_rgba(0,0,0,0.75)]"
          >
            <div className="border-b border-cyan-500/20 px-4 py-3">
              <h2 className="font-display text-sm font-bold tracking-wider text-white">
                {activeCategoryMeta.label}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{activeCategoryMeta.shortDesc}</p>
              {!isCategoryUnlocked(player.level, activeCategory) && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Unlock at Level {CATEGORY_UNLOCK_LEVELS[activeCategory]}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3 yh-scroll">
              {activeCategory === 'costume' &&
                COSTUME_OPTIONS.map((opt) => {
                  const selected = customization.costume === opt.id;
                  const unlocked = isItemUnlocked(
                    player.level,
                    player.unlockedItems,
                    'costume',
                    opt.id,
                  );
                  const reqLevel = getRequiredLevelForItem('costume', opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!unlocked}
                      aria-disabled={!unlocked}
                      onClick={() => updateField('costume', opt.id)}
                      aria-pressed={selected}
                      data-testid={`option-costume-${opt.id}`}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        !unlocked
                          ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 opacity-65'
                          : selected
                            ? 'border-cyan-400 bg-cyan-950/55 shadow-[0_0_16px_rgba(34,211,238,0.18)]'
                            : 'border-slate-700/70 bg-[#0b1326]/90 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          {!unlocked && (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                          )}
                          <span>{player.gender === 'male' ? opt.maleTitle : opt.femaleTitle}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <span
                            className="h-3 w-3 rounded-sm border border-white/25"
                            style={{ backgroundColor: opt.primaryHex }}
                          />
                          <span
                            className="h-3 w-3 rounded-sm border border-white/25"
                            style={{ backgroundColor: opt.secondaryHex }}
                          />
                          <span
                            className="h-3 w-3 rounded-sm border border-white/25"
                            style={{ backgroundColor: opt.trimHex }}
                          />
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">{opt.subtitle}</p>
                      {!unlocked && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Unlock at Level {reqLevel}
                        </p>
                      )}
                    </button>
                  );
                })}

              {activeCategory === 'hair' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                      Hairstyle
                    </div>
                    {HAIR_STYLE_OPTIONS.map((opt) => {
                      const selected = customization.hairStyle === opt.id;
                      const unlocked = isItemUnlocked(
                        player.level,
                        player.unlockedItems,
                        'hairStyle',
                        opt.id,
                      );
                      const reqLevel = getRequiredLevelForItem('hairStyle', opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!unlocked}
                          aria-disabled={!unlocked}
                          onClick={() => updateField('hairStyle', opt.id)}
                          aria-pressed={selected}
                          data-testid={`option-hairStyle-${opt.id}`}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            !unlocked
                              ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 opacity-65'
                              : selected
                                ? 'border-cyan-400 bg-cyan-950/55'
                                : 'border-slate-700/70 bg-[#0b1326]/90 hover:border-cyan-400/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                              {!unlocked && (
                                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                              )}
                              <span>{opt.name}</span>
                            </span>
                            {!unlocked && (
                              <span className="text-[10px] font-semibold text-amber-300">
                                Unlock at Level {reqLevel}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {player.gender === 'male' ? opt.maleDesc : opt.femaleDesc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                      Hair Color
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {HAIR_COLOR_OPTIONS.map((col) => {
                        const selected = customization.hairColor === col.id;
                        const unlocked = isItemUnlocked(
                          player.level,
                          player.unlockedItems,
                          'hairColor',
                          col.id,
                        );
                        const reqLevel = getRequiredLevelForItem('hairColor', col.id);
                        return (
                          <button
                            key={col.id}
                            type="button"
                            disabled={!unlocked}
                            aria-disabled={!unlocked}
                            title={unlocked ? col.name : `Unlock at Level ${reqLevel}`}
                            onClick={() => updateField('hairColor', col.id)}
                            aria-pressed={selected}
                            data-testid={`option-hairColor-${col.id}`}
                            className={`flex flex-col items-start gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
                              !unlocked
                                ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 text-slate-400 opacity-65'
                                : selected
                                  ? 'border-cyan-400 bg-cyan-950/55 text-white'
                                  : 'border-slate-700/70 bg-[#0b1326]/90 text-slate-300 hover:border-cyan-400/40'
                            }`}
                          >
                            <div className="flex w-full items-center gap-1.5">
                              <span
                                className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/30"
                                style={{ backgroundColor: col.hex }}
                              />
                              <span className="truncate">{col.name.split(' ')[0]}</span>
                            </div>
                            {!unlocked && (
                              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-amber-300">
                                <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                                Unlock at Lv.{reqLevel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeCategory === 'sword' &&
                SWORD_OPTIONS.map((opt) => {
                  const selected = customization.sword === opt.id;
                  const unlocked = isItemUnlocked(
                    player.level,
                    player.unlockedItems,
                    'sword',
                    opt.id,
                  );
                  const reqLevel = getRequiredLevelForItem('sword', opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!unlocked}
                      aria-disabled={!unlocked}
                      onClick={() => updateField('sword', opt.id, true)}
                      aria-pressed={selected}
                      data-testid={`option-sword-${opt.id}`}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        !unlocked
                          ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 opacity-65'
                          : selected
                            ? 'border-cyan-400 bg-cyan-950/55'
                            : 'border-slate-700/70 bg-[#0b1326]/90 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          {!unlocked && (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                          )}
                          <span>{opt.name}</span>
                        </span>
                        <span
                          className="h-2.5 w-5 rounded-sm border border-white/25"
                          style={{ backgroundColor: opt.glowHex }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{opt.description}</p>
                      {!unlocked && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Unlock at Level {reqLevel}
                        </p>
                      )}
                    </button>
                  );
                })}

              {activeCategory === 'archery' &&
                ARCHERY_OPTIONS.map((opt) => {
                  const selected = customization.archery === opt.id;
                  const unlocked = isItemUnlocked(
                    player.level,
                    player.unlockedItems,
                    'archery',
                    opt.id,
                  );
                  const reqLevel = getRequiredLevelForItem('archery', opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!unlocked}
                      aria-disabled={!unlocked}
                      onClick={() => updateField('archery', opt.id, true)}
                      aria-pressed={selected}
                      data-testid={`option-archery-${opt.id}`}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        !unlocked
                          ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 opacity-65'
                          : selected
                            ? 'border-cyan-400 bg-cyan-950/55'
                            : 'border-slate-700/70 bg-[#0b1326]/90 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          {!unlocked && (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                          )}
                          <span>{opt.name}</span>
                        </span>
                        <span
                          className="h-2.5 w-5 rounded-sm border border-white/25"
                          style={{ backgroundColor: opt.glowHex }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{opt.description}</p>
                      {!unlocked && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Unlock at Level {reqLevel}
                        </p>
                      )}
                    </button>
                  );
                })}

              {activeCategory === 'superpower' &&
                SUPERPOWER_OPTIONS.map((opt) => {
                  const selected = customization.superpower === opt.id;
                  const unlocked = isItemUnlocked(
                    player.level,
                    player.unlockedItems,
                    'superpower',
                    opt.id,
                  );
                  const reqLevel = getRequiredLevelForItem('superpower', opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!unlocked}
                      aria-disabled={!unlocked}
                      onClick={() => updateField('superpower', opt.id, true)}
                      aria-pressed={selected}
                      data-testid={`option-superpower-${opt.id}`}
                      className={`w-full rounded-lg border p-2.5 text-left transition ${
                        !unlocked
                          ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 opacity-65'
                          : selected
                            ? 'border-cyan-400 bg-cyan-950/55'
                            : 'border-slate-700/70 bg-[#0b1326]/90 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                          {!unlocked && (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                          )}
                          <span>{opt.name}</span>
                        </span>
                        <span
                          className="h-3 w-3 rounded-full border border-white/30"
                          style={{ backgroundColor: opt.primaryHex }}
                        />
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-cyan-300">{opt.element}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{opt.description}</p>
                      {!unlocked && (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Unlock at Level {reqLevel}
                        </p>
                      )}
                    </button>
                  );
                })}

              {activeCategory === 'skinTone' &&
                SKIN_TONE_OPTIONS.map((opt) => {
                  const selected = customization.skinTone === opt.id;
                  const unlocked = isItemUnlocked(
                    player.level,
                    player.unlockedItems,
                    'skinTone',
                    opt.id,
                  );
                  const reqLevel = getRequiredLevelForItem('skinTone', opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!unlocked}
                      aria-disabled={!unlocked}
                      onClick={() => updateField('skinTone', opt.id)}
                      aria-pressed={selected}
                      data-testid={`option-skinTone-${opt.id}`}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition ${
                        !unlocked
                          ? 'cursor-not-allowed border-slate-800/90 bg-[#080d1b]/75 opacity-65'
                          : selected
                            ? 'border-cyan-400 bg-cyan-950/55'
                            : 'border-slate-700/70 bg-[#0b1326]/90 hover:border-cyan-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-7 w-7 shrink-0 rounded-full border border-white/30"
                          style={{ backgroundColor: opt.hex }}
                        />
                        <div>
                          <span className="block text-xs font-semibold text-white">{opt.name}</span>
                          {!unlocked && (
                            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-amber-300">
                              <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                              Unlock at Level {reqLevel}
                            </span>
                          )}
                        </div>
                      </div>
                      {!unlocked && (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
            </div>
          </section>
        )}

        {/* Vertical Icon Rail (6 Categories with tooltips and lock indicators) */}
        <nav
          aria-label="Customization Categories"
          className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-cyan-400/25 bg-[#060b18]/90 p-2 shadow-[0_14px_36px_rgba(0,0,0,0.7)]"
        >
          {CUSTOMIZATION_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key && drawerOpen;
            const catUnlocked = isCategoryUnlocked(player.level, cat.key);
            const catReqLevel = CATEGORY_UNLOCK_LEVELS[cat.key];
            return (
              <div key={cat.key} className="group relative">
                <button
                  type="button"
                  onClick={() => handleIconClick(cat.key)}
                  aria-label={catUnlocked ? cat.label : `${cat.label} (Unlock at Level ${catReqLevel})`}
                  aria-pressed={isActive}
                  title={catUnlocked ? cat.label : `${cat.label} · Unlock at Level ${catReqLevel}`}
                  data-testid={`icon-tab-${cat.key}`}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-lg border transition ${
                    isActive
                      ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.28)]'
                      : catUnlocked
                        ? 'border-slate-700/60 bg-[#0b1326] text-slate-300 hover:border-cyan-400/50 hover:text-white'
                        : 'border-slate-800 bg-[#070b15] text-slate-500 hover:border-amber-400/45 hover:text-slate-300'
                  }`}
                >
                  <FantasyCategoryIcon category={cat.key} className="h-5 w-5" />
                  {!catUnlocked && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-400/50 bg-[#0b1326] text-amber-300"
                    >
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  )}
                </button>

                {/* Hover Tooltip (hidden for already-active open drawer to prevent header overlap) */}
                {!isActive && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute right-14 top-1/2 z-30 -translate-y-1/2 whitespace-nowrap rounded-md border border-cyan-400/35 bg-[#060b18] px-2.5 py-1 text-xs font-medium text-cyan-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {catUnlocked ? cat.label : `${cat.label} · Unlock at Level ${catReqLevel}`}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* BOTTOM RIGHT CORNER: Prominent START GAME button */}
      <div className="pointer-events-none absolute bottom-5 right-5 z-20 flex flex-col items-end gap-2">
        {saveError && (
          <div className="pointer-events-auto rounded-lg border border-rose-500/40 bg-rose-950/85 px-3 py-1.5 text-xs text-rose-200">
            {saveError}
          </div>
        )}
        <button
          type="button"
          onClick={handleStartClick}
          disabled={saving}
          data-testid="start-game-btn"
          className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-cyan-300/70 bg-gradient-to-r from-cyan-600 to-blue-700 px-7 py-3.5 font-display text-base font-bold tracking-wider text-white shadow-[0_0_30px_rgba(34,211,238,0.42)] transition hover:from-cyan-500 hover:to-blue-600 disabled:opacity-60"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          {saving ? 'SAVING...' : 'START GAME'}
        </button>
      </div>
    </main>
  );
}
