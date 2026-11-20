import { FormEvent, useState } from 'react';
import { ArrowRight, LogOut, ShieldAlert, User } from 'lucide-react';
import { UPLOADED_ASSETS } from '../data/customizationCatalog';
import { Gender, PlayerAccount } from '../types/game';
import { validatePlayerName } from '../utils/authValidation';

interface ProfileSetupScreenProps {
  player: PlayerAccount;
  onCompleteProfile: (username: string, gender: Gender) => Promise<void>;
  onLogout: () => void;
}

export default function ProfileSetupScreen({
  player,
  onCompleteProfile,
  onLogout,
}: ProfileSetupScreenProps) {
  const initialName = /^Hunter-[0-9a-f]{6}$/i.test(player.username) ? '' : player.username;
  const [playerName, setPlayerName] = useState(initialName);
  const [selectedGender, setSelectedGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameCheck = validatePlayerName(playerName);
    if (!nameCheck.valid) {
      setError(nameCheck.error || 'Please enter a valid player name.');
      return;
    }

    if (selectedGender !== 'male' && selectedGender !== 'female') {
      setError('Please select Male or Female to continue.');
      return;
    }

    setSaving(true);
    try {
      await onCompleteProfile(playerName.trim(), selectedGender);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your hunter profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full flex-col justify-between overflow-x-hidden bg-[#050812] text-slate-100">
      <img
        src={UPLOADED_ASSETS.customizationBg}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover opacity-35"
      />
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#040712]/85 via-[#050918]/78 to-[#040712]/95"
        aria-hidden="true"
      />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-cyan-500/20 bg-[#060b18]/90 px-4 py-3 sm:px-6">
        <div className="font-display text-base font-bold tracking-wider text-cyan-100 sm:text-lg whitespace-nowrap shrink-0">
          YOKAI HUNTERS
        </div>
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-300">
          {player.email && (
            <span className="hidden truncate text-cyan-200 sm:inline">{player.email}</span>
          )}
          <span className="font-mono-id text-cyan-400 shrink-0">{player.playerId}</span>
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

      {/* First-Login Profile Setup Form */}
      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6">
        <div className="mb-5 text-center">
          <h1 className="font-display text-2xl font-bold tracking-wide text-white sm:text-4xl">
            Create Your Hunter Profile
          </h1>
          <p className="mt-1.5 text-xs text-slate-300 sm:text-sm">
            Enter your Player Name and choose Male or Female. Your choice is saved to your account and can be updated anytime in Profile Settings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {error && (
            <div
              role="alert"
              className="mx-auto flex max-w-xl items-center gap-2 rounded-lg border border-rose-500/45 bg-rose-950/75 px-4 py-2.5 text-xs text-rose-200"
            >
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Player Name Input */}
          <div className="mx-auto max-w-md rounded-xl border border-cyan-500/30 bg-[#070d1c]/90 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.6)]">
            <label
              htmlFor="setup-player-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-cyan-200"
            >
              Player Name
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="setup-player-name"
                data-testid="setup-player-name"
                type="text"
                maxLength={24}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your hunter name (2–24 chars)"
                className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] py-2.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Gender Cards */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSelectedGender('male')}
              aria-pressed={selectedGender === 'male'}
              data-testid="select-gender-male"
              className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
                selectedGender === 'male'
                  ? 'border-cyan-400 bg-[#081226]/95 shadow-[0_0_32px_rgba(34,211,238,0.28)]'
                  : 'border-slate-700/75 bg-[#070c1a]/85 hover:border-cyan-400/50'
              }`}
            >
              <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden bg-[#eceef2] p-3 sm:h-[320px]">
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
              <div className="flex items-center justify-between border-t border-cyan-500/20 px-5 py-3.5">
                <div>
                  <h2 className="font-display text-lg font-bold tracking-wider text-white sm:text-xl">
                    MALE
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Shadow Dragon Coat · Broad Armored Pauldrons
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold tracking-wide ${
                    selectedGender === 'male' ? 'text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  {selectedGender === 'male' ? 'Selected' : 'Select'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGender('female')}
              aria-pressed={selectedGender === 'female'}
              data-testid="select-gender-female"
              className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
                selectedGender === 'female'
                  ? 'border-cyan-400 bg-[#081226]/95 shadow-[0_0_32px_rgba(34,211,238,0.28)]'
                  : 'border-slate-700/75 bg-[#070c1a]/85 hover:border-cyan-400/50'
              }`}
            >
              <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden bg-[#eceef2] p-3 sm:h-[320px]">
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
              <div className="flex items-center justify-between border-t border-cyan-500/20 px-5 py-3.5">
                <div>
                  <h2 className="font-display text-lg font-bold tracking-wider text-white sm:text-xl">
                    FEMALE
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Crimson Phoenix Mantle · High Crown Ponytail
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold tracking-wide ${
                    selectedGender === 'female' ? 'text-cyan-300' : 'text-slate-400'
                  }`}
                >
                  {selectedGender === 'female' ? 'Selected' : 'Select'}
                </span>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-center pt-1">
            <button
              type="submit"
              disabled={saving}
              data-testid="save-profile-setup-btn"
              className="flex items-center gap-2.5 rounded-lg border border-cyan-400/60 bg-cyan-600/90 px-8 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_0_26px_rgba(6,182,212,0.35)] transition hover:bg-cyan-500 disabled:opacity-60"
            >
              {saving ? 'Saving Profile...' : 'Save Profile & Enter Game'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
