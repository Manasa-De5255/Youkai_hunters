import { Gender } from '../types/game';

export interface RegistrationValidationInput {
  username: string;
  password: string;
  confirmPassword: string;
  gender: Gender | '';
  recoveryAnswer: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function normalizeUsername(raw: string): string {
  return raw.trim();
}

export function normalizePlayerId(raw: string): string {
  return raw.trim();
}

export function validatePlayerId(raw: string): ValidationResult {
  const pid = normalizePlayerId(raw);
  if (pid.length < 2 || pid.length > 24) {
    return { valid: false, error: 'Player ID must be between 2 and 24 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(pid)) {
    return {
      valid: false,
      error: 'Player ID may only contain letters, numbers, underscores, and hyphens.',
    };
  }
  return { valid: true };
}

export function validateUsername(raw: string): ValidationResult {
  const username = normalizeUsername(raw);
  if (username.length < 3 || username.length > 24) {
    return { valid: false, error: 'Username must be between 3 and 24 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid: false,
      error: 'Username may only contain letters, numbers, underscores, and hyphens.',
    };
  }
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters long.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long.' };
  }
  return { valid: true };
}

export function validateRegistrationInput(
  input: RegistrationValidationInput & { playerId?: string },
): ValidationResult {
  const userCheck = validateUsername(input.username);
  if (!userCheck.valid) return userCheck;

  if (input.playerId && normalizePlayerId(input.playerId).length > 0) {
    const pidCheck = validatePlayerId(input.playerId);
    if (!pidCheck.valid) return pidCheck;
  }

  const passCheck = validatePassword(input.password);
  if (!passCheck.valid) return passCheck;

  if (input.password !== input.confirmPassword) {
    return { valid: false, error: 'Password and Confirm Password do not match.' };
  }

  if (input.gender !== 'male' && input.gender !== 'female') {
    return { valid: false, error: 'Please select a Male or Female character category.' };
  }

  if (input.recoveryAnswer.trim().length < 2) {
    return {
      valid: false,
      error: 'Please enter a recovery answer (at least 2 characters) for password recovery.',
    };
  }

  return { valid: true };
}

export function validatePasswordResetInput(input: {
  username: string;
  recoveryAnswer: string;
  newPassword: string;
  confirmNewPassword: string;
}): ValidationResult {
  const userCheck = validateUsername(input.username);
  if (!userCheck.valid) return userCheck;

  if (input.recoveryAnswer.trim().length < 2) {
    return { valid: false, error: 'Please enter your recovery answer.' };
  }

  const passCheck = validatePassword(input.newPassword);
  if (!passCheck.valid) return passCheck;

  if (input.newPassword !== input.confirmNewPassword) {
    return { valid: false, error: 'New passwords do not match.' };
  }

  return { valid: true };
}
