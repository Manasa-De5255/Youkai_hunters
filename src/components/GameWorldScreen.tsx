import { useState } from 'react';
import { LogOut, Sliders } from 'lucide-react';
import {
  ARCHERY_OPTIONS,
  COSTUME_OPTIONS,
  SUPERPOWER_OPTIONS,
  SWORD_OPTIONS,
} from '../data/customizationCatalog';
import SanctuaryGameCanvas from '../three/SanctuaryGameCanvas';
import { CharacterCustomization, PlayerAccount } from '../types/game';

interface GameWorldScreenProps {
  player: PlayerAccount;
  customization: CharacterCustomization;
  onReturnToCustomize: () => void;
  onLogout: () => void;
}

export default function GameWorldScreen({
  player,
  customization,
  onReturnToCustomize,
  onLogout,
}: GameWorldScreenProps) {
  const [orbsCleared, setOrbsCleared] = useState(0);

  const costume = COSTUME_OPTIONS.find((c) => c.id === customization.costume);
  const sword = SWORD_OPTIONS.find((s) => s.id === customization.sword);
  const bow = ARCHERY_OPTIONS.find((a) => a.id === customization.archery);
  const power = SUPERPOWER_OPTIONS.find((sp) => sp.id === customization.superpower);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#060b18] text-slate-100">
      <SanctuaryGameCanvas
        gender={player.gender}
        customization={customization}
        onSpiritBurst={setOrbsCleared}
      />

      {/* Top Left HUD */}
      <div className="pointer-events-none absolute left-5 top-5 z-20 rounded-xl border border-cyan-400/25 bg-[#060b18]/85 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.65)]">
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold tracking-wider text-cyan-200">
            YOKAI SANCTUARY
          </span>
          <span className="font-mono-id text-xs text-cyan-400">{player.playerId}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-300">
          <span className="font-semibold text-white">{player.username}</span>
          <span aria-hidden="true">·</span>
          <span className="uppercase">{player.gender}</span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-300">{power?.name}</span>
        </div>
        <div className="mt-2 flex items-center gap-4 border-t border-cyan-500/20 pt-2 text-[11px] text-slate-300">
          <span>
            Armor: {player.gender === 'male' ? costume?.maleTitle : costume?.femaleTitle}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Arms: {sword?.name} / {bow?.name}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-id text-cyan-300">
            Yokai Orbs Cleared: {orbsCleared}
          </span>
        </div>
      </div>

      {/* Top Right Controls */}
      <div className="pointer-events-auto absolute right-5 top-5 z-20 flex items-center gap-2.5">
        <button
          type="button"
          onClick={onReturnToCustomize}
          className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-[#060b18]/90 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-950/70"
        >
          <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
          Customize Warrior
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#060b18]/90 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Logout
        </button>
      </div>

      {/* Bottom Control Hint */}
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-cyan-500/20 bg-[#060b18]/80 px-4 py-1.5 text-xs text-slate-300">
        WASD or Arrow Keys Move · Space, F, or Click Unleash Spirit Strike
      </div>
    </main>
  );
}
