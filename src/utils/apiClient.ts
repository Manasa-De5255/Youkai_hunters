import { ActivityId, CharacterCustomization, Gender, PlayerAccount } from '../types/game';

const SESSION_STORAGE_KEY = 'yh_session_token';

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string | null | undefined): void {
  try {
    if (token) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction in private iframes
  }
}

function extractErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
    if (record.error && typeof record.error === 'object') {
      const nested = (record.error as Record<string, unknown>).message;
      if (typeof nested === 'string' && nested.trim()) {
        return nested;
      }
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }
  return `Request failed (HTTP ${status}).`;
}

async function requestJson<T>(
  path: string,
  options?: RequestInit & { skipAuthHeader?: boolean },
): Promise<T> {
  const { skipAuthHeader, ...fetchOptions } = options ?? {};
  const token = skipAuthHeader ? null : getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...fetchOptions,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res.status));
  }
  return data as T;
}

export async function fetchCurrentPlayer(): Promise<PlayerAccount | null> {
  try {
    const token = getStoredToken();
    const res = await fetch(apiUrl('/api/auth/me'), {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      if (res.status === 401) setStoredToken(null);
      return null;
    }
    const data = await res.json();
    if (!data.player) {
      setStoredToken(null);
      return null;
    }
    return data.player;
  } catch {
    return null;
  }
}

export async function registerPlayerAccount(payload: {
  username: string;
  playerId?: string;
  password: string;
  confirmPassword: string;
  gender: Gender;
  recoveryQuestion: string;
  recoveryAnswer: string;
}): Promise<PlayerAccount> {
  const data = await requestJson<{ player: PlayerAccount; sessionToken?: string }>(
    '/api/auth/register',
    {
      method: 'POST',
      skipAuthHeader: true,
      body: JSON.stringify(payload),
    },
  );
  if (data.sessionToken) {
    setStoredToken(data.sessionToken);
  }
  return data.player;
}

export async function loginPlayerAccount(payload: {
  username: string;
  playerId?: string;
  password?: string;
}): Promise<PlayerAccount> {
  const data = await requestJson<{ player: PlayerAccount; sessionToken?: string }>(
    '/api/auth/login',
    {
      method: 'POST',
      skipAuthHeader: true,
      body: JSON.stringify(payload),
    },
  );
  if (data.sessionToken) {
    setStoredToken(data.sessionToken);
  }
  return data.player;
}

export async function logoutPlayerAccount(): Promise<void> {
  try {
    await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  } finally {
    setStoredToken(null);
  }
}

export async function fetchRecoveryQuestion(username: string): Promise<string> {
  const data = await requestJson<{ question: string }>(
    `/api/auth/recovery-question?username=${encodeURIComponent(username)}`,
    { skipAuthHeader: true },
  );
  return data.question;
}

export async function resetPlayerPassword(payload: {
  username: string;
  recoveryAnswer: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  await requestJson<{ ok: boolean }>('/api/auth/forgot-password', {
    method: 'POST',
    skipAuthHeader: true,
    body: JSON.stringify(payload),
  });
}

export async function updatePlayerGender(gender: Gender): Promise<PlayerAccount> {
  const data = await requestJson<{ player: PlayerAccount }>('/api/player/gender', {
    method: 'PUT',
    body: JSON.stringify({ gender }),
  });
  return data.player;
}

export async function updatePlayerCustomization(
  gender: Gender,
  customization: CharacterCustomization,
): Promise<PlayerAccount> {
  const data = await requestJson<{ player: PlayerAccount }>('/api/player/customization', {
    method: 'PUT',
    body: JSON.stringify({ gender, customization }),
  });
  return data.player;
}

export async function recordPlayerProgress(activityId: ActivityId): Promise<{
  player: PlayerAccount;
  leveledUp: boolean;
  newlyUnlocked: string[];
}> {
  return requestJson<{
    player: PlayerAccount;
    leveledUp: boolean;
    newlyUnlocked: string[];
  }>('/api/player/progress', {
    method: 'POST',
    body: JSON.stringify({ activityId }),
  });
}

export async function recordKodamaHit(): Promise<{
  player: PlayerAccount;
  leveledUp: boolean;
  newlyUnlocked: string[];
}> {
  return requestJson<{
    player: PlayerAccount;
    leveledUp: boolean;
    newlyUnlocked: string[];
  }>('/api/player/kodama/hit', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function recordKodamaRound(
  round: number,
  hits: number,
): Promise<{
  player: PlayerAccount;
  passed: boolean;
  newlyCompleted: boolean;
  stage2JustUnlocked: boolean;
}> {
  return requestJson<{
    player: PlayerAccount;
    passed: boolean;
    newlyCompleted: boolean;
    stage2JustUnlocked: boolean;
  }>('/api/player/kodama/round', {
    method: 'POST',
    body: JSON.stringify({ round, hits }),
  });
}
