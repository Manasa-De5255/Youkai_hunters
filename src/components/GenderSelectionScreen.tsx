import { useState } from 'react';
import { LogOut, ArrowRight } from 'lucide-react';
import { UPLOADED_ASSETS } from '../data/customizationCatalog';
import { Gender, PlayerAccount } from '../types/game';

interface GenderSelectionScreenProps {
  player: PlayerAccount;
  onSelectGender: (gender: Gender) => Promise<void>;
  onProceedToCustomize: () => void;
  onLogout: () => void;
}

export default function GenderSelectionScreen({
  player,
  onSelectGender,
  onProceedToCustomize,
  onLogout,
}: GenderSelectionScreenProps) {
  const [savingGender, setSavingGender] = useState<Gender | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChoose = async (gender: Gender) => {
    setError(null);
    setSavingGender(gender);
    try {
      await onSelectGender(gender);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save warrior category.');
    } finally {
      setSavingGender(null);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full flex-col justify-between overflow-x-hidden bg-[#050812] text-slate-100">
      {/* Subtle dark atmospheric backdrop */}
      <img
        src={UPLOADED_ASSETS.customizationBg}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-35"
      />
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#040712]/85 via-[#050918]/75 to-[#040712]/95"
        aria-hidden="true"
      />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-8 border-b border-cyan-500/20 bg-[#060b18]/85 px-6 py-3.5">
        <div className="font-display text-lg font-bold tracking-wider text-cyan-100 whitespace-nowrap shrink-0">
          YOKAI HUNTERS
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <span className="font-mono-id text-cyan-300">{player.playerId}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-white">{player.username}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#0b1326] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-white whitespace-nowrap shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Logout
        </button>
      </header>

      {/* Main Selection Area */}
      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="mb-7 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide text-white sm:text-4xl">
            Select Your Hunter Category
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Choose Male or Female to enter the 3D Customization Sanctuary. Each category retains its own saved gear.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-rose-500/40 bg-rose-950/70 px-4 py-2 text-xs text-rose-200"
          >
            {error}
          </div>
        )}

        <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* MALE CARD */}
          <button
            type="button"
            onClick={() => handleChoose('male')}
            aria-pressed={player.gender === 'male'}
            data-testid="select-gender-male"
            className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
              player.gender === 'male'
                ? 'border-cyan-400 bg-[#081226]/92 shadow-[0_0_32px_rgba(34,211,238,0.22)]'
                : 'border-slate-700/70 bg-[#070c1a]/82 hover:border-cyan-400/50'
            }`}
          >
            <div className="relative flex h-[370px] w-full items-center justify-center overflow-hidden bg-[#eceef2] p-3">
              <img
                src={UPLOADED_ASSETS.maleCharacter}
                alt="Male Yokai Hunter Warrior"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div
                className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(6,11,24,0.35)]"
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center justify-between border-t border-cyan-500/20 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-bold tracking-wider text-white">MALE</h2>
                <p className="mt-0.5 text-xs text-slate-300">
                  Shadow Dragon Coat · Broad Armored Pauldrons
                </p>
              </div>
              <span
                className={`text-xs font-semibold tracking-wide ${
                  player.gender === 'male' ? 'text-cyan-300' : 'text-slate-400'
                }`}
              >
                {savingGender === 'male'
                  ? 'Saving...'
                  : player.gender === 'male'
                    ? 'Selected'
                    : 'Choose'}
              </span>
            </div>
          </button>

          {/* FEMALE CARD */}
          <button
            type="button"
            onClick={() => handleChoose('female')}
            aria-pressed={player.gender === 'female'}
            data-testid="select-gender-female"
            className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
              player.gender === 'female'
                ? 'border-cyan-400 bg-[#081226]/92 shadow-[0_0_32px_rgba(34,211,238,0.22)]'
                : 'border-slate-700/70 bg-[#070c1a]/82 hover:border-cyan-400/50'
            }`}
          >
            <div className="relative flex h-[370px] w-full items-center justify-center overflow-hidden bg-[#eceef2] p-3">
              <img
                src={UPLOADED_ASSETS.femaleCharacter}
                alt="Female Yokai Hunter Warrior"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div
                className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(6,11,24,0.35)]"
                aria-hidden="true"
              />
            </div>
            <div className="flex items-center justify-between border-t border-cyan-500/20 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-bold tracking-wider text-white">FEMALE</h2>
                <p className="mt-0.5 text-xs text-slate-300">
                  Crimson Phoenix Mantle · High Crown Ponytail
                </p>
              </div>
              <span
                className={`text-xs font-semibold tracking-wide ${
                  player.gender === 'female' ? 'text-cyan-300' : 'text-slate-400'
                }`}
              >
                {savingGender === 'female'
                  ? 'Saving...'
                  : player.gender === 'female'
                    ? 'Selected'
                    : 'Choose'}
              </span>
            </div>
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={onProceedToCustomize}
            data-testid="enter-customization-btn"
            className="flex items-center gap-2.5 rounded-lg border border-cyan-400/60 bg-cyan-600/90 px-7 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_0_26px_rgba(6,182,212,0.35)] transition hover:bg-cyan-500"
          >
            Customize {player.gender === 'male' ? 'Male' : 'Female'} Warrior
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
