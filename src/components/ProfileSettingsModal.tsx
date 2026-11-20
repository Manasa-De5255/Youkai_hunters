import { FormEvent, useState } from 'react';
import { ShieldAlert, UserCog, X } from 'lucide-react';
import { Gender, PlayerAccount } from '../types/game';
import { validatePlayerName } from '../utils/authValidation';

interface ProfileSettingsModalProps {
  player: PlayerAccount;
  onSaveProfile: (username: string, gender: Gender) => Promise<void>;
  onClose: () => void;
}

export default function ProfileSettingsModal({
  player,
  onSaveProfile,
  onClose,
}: ProfileSettingsModalProps) {
  const [name, setName] = useState(player.username);
  const [gender, setGender] = useState<Gender>(player.gender);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const check = validatePlayerName(name);
    if (!check.valid) {
      setError(check.error || 'Enter a valid player name.');
      return;
    }

    setSaving(true);
    try {
      await onSaveProfile(name.trim(), gender);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile Settings"
      data-testid="profile-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-[#070e0b] p-5 text-slate-100 shadow-[0_24px_70px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
          <div className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold tracking-wide text-white">
              Profile Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile settings"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#0b1410] px-3 py-2 text-xs">
            <span className="text-slate-400">{player.email ? 'Account Email' : 'Player ID'}</span>
            <span className="truncate font-mono-id text-emerald-300">
              {player.email || player.playerId}
            </span>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-500/45 bg-rose-950/65 px-3 py-2 text-xs text-rose-200"
            >
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="profile-settings-name"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-emerald-200"
            >
              Player Name
            </label>
            <input
              id="profile-settings-name"
              data-testid="profile-name-input"
              type="text"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter hunter name"
              className="w-full rounded-lg border border-slate-700 bg-[#0b1511] px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-emerald-200">
              Gender
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="profile-gender-male"
                aria-pressed={gender === 'male'}
                onClick={() => setGender('male')}
                className={`rounded-lg border px-3 py-2.5 text-xs font-bold tracking-wider transition ${
                  gender === 'male'
                    ? 'border-emerald-400 bg-emerald-950/75 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.2)]'
                    : 'border-slate-700 bg-[#0b1511] text-slate-300 hover:border-slate-500'
                }`}
              >
                Male
              </button>
              <button
                type="button"
                data-testid="profile-gender-female"
                aria-pressed={gender === 'female'}
                onClick={() => setGender('female')}
                className={`rounded-lg border px-3 py-2.5 text-xs font-bold tracking-wider transition ${
                  gender === 'female'
                    ? 'border-emerald-400 bg-emerald-950/75 text-emerald-100 shadow-[0_0_14px_rgba(16,185,129,0.2)]'
                    : 'border-slate-700 bg-[#0b1511] text-slate-300 hover:border-slate-500'
                }`}
              >
                Female
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              data-testid="cancel-profile-settings-btn"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-[#0d1713] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="save-profile-settings-btn"
              className="rounded-lg border border-emerald-400/60 bg-emerald-700 px-5 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
