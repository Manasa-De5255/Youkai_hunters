import { CharacterCustomization, Gender, PlayerAccount } from '../types/game';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed.');
  }
  return data as T;
}

export async function fetchCurrentPlayer(): Promise<PlayerAccount | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.player ?? null;
  } catch {
    return null;
  }
}

export async function registerPlayerAccount(payload: {
  username: string;
  password: string;
  confirmPassword: string;
  gender: Gender;
  recoveryQuestion: string;
  recoveryAnswer: string;
}): Promise<PlayerAccount> {
  const data = await requestJson<{ player: PlayerAccount }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.player;
}

export async function loginPlayerAccount(payload: {
  username: string;
  password: string;
}): Promise<PlayerAccount> {
  const data = await requestJson<{ player: PlayerAccount }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.player;
}

export async function logoutPlayerAccount(): Promise<void> {
  await requestJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function fetchRecoveryQuestion(username: string): Promise<string> {
  const data = await requestJson<{ question: string }>(
    `/api/auth/recovery-question?username=${encodeURIComponent(username)}`,
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
