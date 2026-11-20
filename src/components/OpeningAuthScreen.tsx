import { FormEvent, useState } from 'react';
import { Eye, EyeOff, KeyRound, Mail, ShieldAlert, UserCheck, UserPlus } from 'lucide-react';
import { UPLOADED_ASSETS } from '../data/customizationCatalog';
import { PlayerAccount } from '../types/game';
import {
  fetchRecoveryQuestion,
  loginPlayerAccount,
  registerPlayerAccount,
  resetPlayerPassword,
} from '../utils/apiClient';
import {
  validateEmail,
  validatePasswordResetInput,
  validateRegistrationInput,
} from '../utils/authValidation';

interface OpeningAuthScreenProps {
  onAuthenticated: (player: PlayerAccount) => void;
}

type AuthTab = 'login' | 'register' | 'forgot';

export default function OpeningAuthScreen({ onAuthenticated }: OpeningAuthScreenProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Login form state (Email-first, supports legacy Hunter name / Player ID toggle)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginPlayerId, setLoginPlayerId] = useState('');
  const [useLegacyPlayerId, setUseLegacyPlayerId] = useState(false);
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register form state (Email + Password only; Name & Gender asked on First Login)
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regRecoveryAnswer, setRegRecoveryAnswer] = useState('');

  // Forgot password state
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [loadedQuestion, setLoadedQuestion] = useState<string | null>(null);
  const [forgotAnswer, setForgotAnswer] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const switchTab = (next: AuthTab) => {
    setTab(next);
    setError(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const identifier = loginEmail.trim();
    if (!identifier) {
      setError('Enter your email address.');
      return;
    }

    if (useLegacyPlayerId) {
      if (!loginPlayerId.trim() && !loginPass) {
        setError('Enter your Player ID or password to sign in.');
        return;
      }
    } else if (!loginPass) {
      setError('Enter your password to sign in.');
      return;
    }

    setLoading(true);
    try {
      const player = await loginPlayerAccount(
        identifier.includes('@')
          ? {
              email: identifier.toLowerCase(),
              playerId: useLegacyPlayerId ? loginPlayerId.trim() || undefined : undefined,
              password: loginPass || undefined,
            }
          : {
              username: identifier,
              playerId: useLegacyPlayerId ? loginPlayerId.trim() || undefined : undefined,
              password: loginPass || undefined,
            },
      );
      onAuthenticated(player);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const emailCheck = validateEmail(regEmail);
    if (!emailCheck.valid) {
      setError(emailCheck.error || 'Please enter a valid email address.');
      return;
    }

    const check = validateRegistrationInput({
      email: regEmail.trim(),
      password: regPass,
      confirmPassword: regConfirmPass,
      recoveryAnswer: regRecoveryAnswer.trim() || undefined,
    });

    if (!check.valid) {
      setError(check.error || 'Please check your registration details.');
      return;
    }

    setLoading(true);
    try {
      const player = await registerPlayerAccount({
        email: regEmail.trim().toLowerCase(),
        password: regPass,
        confirmPassword: regConfirmPass,
        recoveryQuestion: 'Guardian Spirit Secret Word',
        recoveryAnswer: regRecoveryAnswer.trim() || undefined,
      });
      onAuthenticated(player);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupQuestion = async () => {
    setError(null);
    setSuccessMsg(null);
    if (!forgotIdentifier.trim()) {
      setError('Enter your email or username to locate your recovery prompt.');
      return;
    }
    setLoading(true);
    try {
      const q = await fetchRecoveryQuestion(forgotIdentifier.trim());
      setLoadedQuestion(q);
    } catch (err) {
      setLoadedQuestion(null);
      setError(err instanceof Error ? err.message : 'Account lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const check = validatePasswordResetInput({
      username: forgotIdentifier,
      recoveryAnswer: forgotAnswer,
      newPassword: newPass,
      confirmNewPassword: confirmNewPass,
    });
    if (!check.valid) {
      setError(check.error || 'Check password reset fields.');
      return;
    }

    setLoading(true);
    try {
      await resetPlayerPassword({
        username: forgotIdentifier.trim(),
        recoveryAnswer: forgotAnswer.trim(),
        newPassword: newPass,
        confirmNewPassword: confirmNewPass,
      });
      setSuccessMsg('Password updated. Sign in with your new password.');
      setLoginEmail(forgotIdentifier.trim());
      setLoginPass('');
      setForgotAnswer('');
      setNewPass('');
      setConfirmNewPass('');
      setLoadedQuestion(null);
      setTab('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const showQuickRegisterHint =
    tab === 'login' &&
    error?.toLowerCase().includes('no hunter account found') &&
    loginEmail.includes('@');

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#040712]">
      {/* Exact uploaded opening artwork preserved cleanly */}
      <img
        src={UPLOADED_ASSETS.openingBg}
        alt="Yokai Hunters moonlit forest opening artwork"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover object-center select-none"
      />

      {/* Subtle bottom-edge gradient only for legibility without altering the artwork */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#030610]/75 via-[#030610]/25 to-transparent"
        aria-hidden="true"
      />

      {panelCollapsed ? (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
          <button
            type="button"
            onClick={() => setPanelCollapsed(false)}
            className="rounded-lg border border-cyan-400/40 bg-[#060b1a]/88 px-5 py-2.5 text-sm font-semibold tracking-wide text-cyan-100 shadow-[0_0_24px_rgba(6,182,212,0.22)] transition hover:border-cyan-300 hover:bg-[#0a132c]"
          >
            Hunter Account Login
          </button>
        </div>
      ) : (
        <section
          aria-label="Hunter Authentication"
          className="absolute bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-xl border border-cyan-400/25 bg-[#060b18]/90 p-4 text-slate-100 shadow-[0_18px_50px_rgba(0,0,0,0.72),0_0_28px_rgba(34,211,238,0.12)]"
        >
          {/* Tab Switcher + Minimize */}
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-cyan-500/15 pb-2.5">
            <div className="flex items-center gap-1" role="tablist" aria-label="Account actions">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                onClick={() => switchTab('login')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  tab === 'login'
                    ? 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Login
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                onClick={() => switchTab('register')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  tab === 'register'
                    ? 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Register
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'forgot'}
                onClick={() => switchTab('forgot')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  tab === 'forgot'
                    ? 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Recovery
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPanelCollapsed(true)}
              aria-label="Minimize authentication panel to view artwork"
              className="rounded px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            >
              Hide
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs text-rose-200"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden="true" />
                <span>{error}</span>
              </div>
              {showQuickRegisterHint && (
                <button
                  type="button"
                  onClick={() => {
                    setRegEmail(loginEmail.trim());
                    switchTab('register');
                  }}
                  className="mt-1.5 text-[11px] font-semibold text-cyan-300 underline hover:text-cyan-200"
                >
                  Create a new account with {loginEmail.trim()} →
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-xs text-emerald-200"
            >
              {successMsg}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-2.5">
              <div>
                <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    data-testid="login-email"
                    type="text"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="hunter@example.com"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchTab('forgot')}
                    className="text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    data-testid="login-password"
                    type={showLoginPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-2 pr-9 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass((v) => !v)}
                    aria-label={showLoginPass ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {useLegacyPlayerId && (
                <div>
                  <label htmlFor="login-player-id" className="mb-1 block text-xs font-medium text-slate-300">
                    Player ID <span className="text-slate-500">(Legacy accounts)</span>
                  </label>
                  <input
                    id="login-player-id"
                    type="text"
                    value={loginPlayerId}
                    onChange={(e) => setLoginPlayerId(e.target.value)}
                    placeholder="e.g. YH-10001"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Sign in with your email and password.</span>
                <button
                  type="button"
                  onClick={() => setUseLegacyPlayerId((v) => !v)}
                  className="text-cyan-300/90 hover:text-cyan-200"
                >
                  {useLegacyPlayerId ? 'Hide Player ID' : 'Use Player ID'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full rounded-lg border border-cyan-400/50 bg-cyan-600/90 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(8,145,178,0.35)] transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-2.5">
              <div>
                <label htmlFor="reg-email" className="mb-1 block text-xs font-medium text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="reg-email"
                    data-testid="reg-email"
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="hunter@example.com"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] py-1.5 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <input
                    id="reg-password"
                    data-testid="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reg-confirm-password"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="reg-confirm-password"
                    data-testid="reg-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={regConfirmPass}
                    onChange={(e) => setRegConfirmPass(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-recovery-a" className="mb-1 block text-xs font-medium text-slate-300">
                  Secret Recovery Word <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  id="reg-recovery-a"
                  type="text"
                  value={regRecoveryAnswer}
                  onChange={(e) => setRegRecoveryAnswer(e.target.value)}
                  placeholder="Optional backup word for password reset"
                  className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                After your first sign in, you will choose your Player Name and Gender.
              </p>

              <button
                type="submit"
                disabled={loading}
                data-testid="register-submit-btn"
                className="w-full rounded-lg border border-cyan-400/50 bg-cyan-600/90 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(8,145,178,0.35)] transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-2.5">
              <div>
                <label htmlFor="forgot-username" className="mb-1 block text-xs font-medium text-slate-300">
                  Account Email or Hunter Name
                </label>
                <div className="flex gap-2">
                  <input
                    id="forgot-username"
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="hunter@example.com"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleLookupQuestion}
                    disabled={loading}
                    className="rounded-lg border border-cyan-400/40 bg-[#0f1c38] px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-900/40 whitespace-nowrap shrink-0"
                  >
                    Find Account
                  </button>
                </div>
              </div>

              {loadedQuestion && (
                <p className="rounded-md border border-cyan-500/25 bg-[#0a1428] px-2.5 py-1.5 text-xs text-cyan-200">
                  Prompt: {loadedQuestion}
                </p>
              )}

              <div>
                <label htmlFor="forgot-answer" className="mb-1 block text-xs font-medium text-slate-300">
                  Recovery Answer
                </label>
                <input
                  id="forgot-answer"
                  type="text"
                  value={forgotAnswer}
                  onChange={(e) => setForgotAnswer(e.target.value)}
                  placeholder="Enter your secret recovery answer"
                  className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="forgot-new-pass" className="mb-1 block text-xs font-medium text-slate-300">
                    New Password
                  </label>
                  <input
                    id="forgot-new-pass"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="forgot-confirm-pass"
                    className="mb-1 block text-xs font-medium text-slate-300"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="forgot-confirm-pass"
                    type="password"
                    value={confirmNewPass}
                    onChange={(e) => setConfirmNewPass(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full rounded-lg border border-slate-700/80 bg-[#0b1326] px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg border border-cyan-400/50 bg-cyan-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
