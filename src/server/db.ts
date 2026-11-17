import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  getDefaultCustomization,
  sanitizeCustomization,
} from '../data/customizationCatalog';
import { CharacterCustomization, Gender, PlayerAccount } from '../types/game';
import {
  normalizeUsername,
  validatePasswordResetInput,
  validateRegistrationInput,
} from '../utils/authValidation';

function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifySecret(secret: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHex] = parts;
  const derived = crypto.scryptSync(secret, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

interface PlayerRow {
  id: number;
  player_id: string;
  username: string;
  username_lower: string;
  password_hash: string;
  recovery_question: string;
  recovery_answer_hash: string;
  gender: Gender;
  male_customization: string;
  female_customization: string;
  created_at: string;
  updated_at: string;
}

function rowToPlayerAccount(row: PlayerRow): PlayerAccount {
  let parsedMale: Partial<CharacterCustomization> = {};
  let parsedFemale: Partial<CharacterCustomization> = {};
  try {
    parsedMale = JSON.parse(row.male_customization);
  } catch {
    parsedMale = {};
  }
  try {
    parsedFemale = JSON.parse(row.female_customization);
  } catch {
    parsedFemale = {};
  }

  return {
    playerId: row.player_id,
    username: row.username,
    gender: row.gender,
    recoveryQuestion: row.recovery_question,
    maleCustomization: sanitizeCustomization(parsedMale, 'male'),
    femaleCustomization: sanitizeCustomization(parsedFemale, 'female'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class YokaiDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolved = dbPath ?? path.resolve(process.cwd(), 'data', 'yokai_hunters.db');
    if (resolved !== ':memory:') {
      fs.mkdirSync(path.dirname(resolved), { recursive: true });
    }
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        username_lower TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        recovery_question TEXT NOT NULL,
        recovery_answer_hash TEXT NOT NULL,
        gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
        male_customization TEXT NOT NULL,
        female_customization TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  registerPlayer(input: {
    username: string;
    password: string;
    confirmPassword: string;
    gender: Gender;
    recoveryQuestion?: string;
    recoveryAnswer: string;
  }): { ok: true; player: PlayerAccount; sessionToken: string } | { ok: false; error: string; status: number } {
    const validation = validateRegistrationInput({
      username: input.username,
      password: input.password,
      confirmPassword: input.confirmPassword,
      gender: input.gender,
      recoveryAnswer: input.recoveryAnswer,
    });
    if (!validation.valid) {
      return { ok: false, error: validation.error || 'Invalid registration data.', status: 400 };
    }

    const username = normalizeUsername(input.username);
    const usernameLower = username.toLowerCase();

    const existing = this.db
      .prepare('SELECT player_id FROM players WHERE username_lower = ?')
      .get(usernameLower);
    if (existing) {
      return {
        ok: false,
        error: 'That username is already claimed by another hunter. Choose a unique username.',
        status: 409,
      };
    }

    const now = new Date().toISOString();
    const passwordHash = hashSecret(input.password);
    const recoveryQuestion =
      input.recoveryQuestion && input.recoveryQuestion.trim().length > 0
        ? input.recoveryQuestion.trim()
        : 'Guardian Spirit Secret Word';
    const recoveryAnswerHash = hashSecret(input.recoveryAnswer.trim().toLowerCase());
    const maleJson = JSON.stringify(getDefaultCustomization('male'));
    const femaleJson = JSON.stringify(getDefaultCustomization('female'));

    const tempId = `YH-PENDING-${crypto.randomUUID()}`;
    const insert = this.db.prepare(`
      INSERT INTO players (
        player_id, username, username_lower, password_hash,
        recovery_question, recovery_answer_hash, gender,
        male_customization, female_customization, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      const info = insert.run(
        tempId,
        username,
        usernameLower,
        passwordHash,
        recoveryQuestion,
        recoveryAnswerHash,
        input.gender,
        maleJson,
        femaleJson,
        now,
        now,
      );
      const numericId = Number(info.lastInsertRowid);
      const playerId = `YH-${String(10000 + numericId)}`;
      this.db.prepare('UPDATE players SET player_id = ? WHERE id = ?').run(playerId, numericId);
      return playerId;
    });

    const playerId = tx();
    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow;
    const sessionToken = this.createSession(playerId);

    return { ok: true, player: rowToPlayerAccount(row), sessionToken };
  }

  loginPlayer(input: {
    username: string;
    password: string;
  }): { ok: true; player: PlayerAccount; sessionToken: string } | { ok: false; error: string; status: number } {
    const usernameLower = normalizeUsername(input.username).toLowerCase();
    if (!usernameLower || !input.password) {
      return { ok: false, error: 'Username and password are required.', status: 400 };
    }

    const row = this.db
      .prepare('SELECT * FROM players WHERE username_lower = ?')
      .get(usernameLower) as PlayerRow | undefined;

    if (!row || !verifySecret(input.password, row.password_hash)) {
      return { ok: false, error: 'Invalid username or password.', status: 401 };
    }

    const sessionToken = this.createSession(row.player_id);
    return { ok: true, player: rowToPlayerAccount(row), sessionToken };
  }

  getRecoveryQuestion(username: string): { ok: true; question: string } | { ok: false; error: string; status: number } {
    const usernameLower = normalizeUsername(username).toLowerCase();
    if (!usernameLower) {
      return { ok: false, error: 'Enter your username first.', status: 400 };
    }
    const row = this.db
      .prepare('SELECT recovery_question FROM players WHERE username_lower = ?')
      .get(usernameLower) as { recovery_question: string } | undefined;
    if (!row) {
      return { ok: false, error: 'No hunter account found with that username.', status: 404 };
    }
    return { ok: true, question: row.recovery_question };
  }

  resetPassword(input: {
    username: string;
    recoveryAnswer: string;
    newPassword: string;
    confirmNewPassword: string;
  }): { ok: true } | { ok: false; error: string; status: number } {
    const check = validatePasswordResetInput(input);
    if (!check.valid) {
      return { ok: false, error: check.error || 'Invalid reset details.', status: 400 };
    }

    const usernameLower = normalizeUsername(input.username).toLowerCase();
    const row = this.db
      .prepare('SELECT * FROM players WHERE username_lower = ?')
      .get(usernameLower) as PlayerRow | undefined;

    if (!row) {
      return { ok: false, error: 'No hunter account found with that username.', status: 404 };
    }

    const normalizedAnswer = input.recoveryAnswer.trim().toLowerCase();
    if (!verifySecret(normalizedAnswer, row.recovery_answer_hash)) {
      return { ok: false, error: 'Recovery answer is incorrect.', status: 403 };
    }

    const nextHash = hashSecret(input.newPassword);
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE players SET password_hash = ?, updated_at = ? WHERE player_id = ?')
      .run(nextHash, now, row.player_id);
    this.db.prepare('DELETE FROM sessions WHERE player_id = ?').run(row.player_id);

    return { ok: true };
  }

  createSession(playerId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
    this.db
      .prepare(
        'INSERT INTO sessions (token_hash, player_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .run(tokenHash, playerId, now.toISOString(), expires.toISOString());
    return token;
  }

  getPlayerBySession(token: string | undefined): PlayerAccount | null {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = this.db
      .prepare('SELECT player_id, expires_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { player_id: string; expires_at: string } | undefined;
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }

    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(session.player_id) as PlayerRow | undefined;
    return row ? rowToPlayerAccount(row) : null;
  }

  deleteSession(token: string | undefined): void {
    if (!token) return;
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  updatePlayerGender(playerId: string, gender: Gender): PlayerAccount | null {
    if (gender !== 'male' && gender !== 'female') return null;
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE players SET gender = ?, updated_at = ? WHERE player_id = ?')
      .run(gender, now, playerId);
    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined;
    return row ? rowToPlayerAccount(row) : null;
  }

  updatePlayerCustomization(
    playerId: string,
    gender: Gender,
    customization: Partial<CharacterCustomization>,
  ): PlayerAccount | null {
    if (gender !== 'male' && gender !== 'female') return null;
    const clean = sanitizeCustomization(customization, gender);
    const now = new Date().toISOString();
    const col = gender === 'male' ? 'male_customization' : 'female_customization';
    this.db
      .prepare(`UPDATE players SET gender = ?, ${col} = ?, updated_at = ? WHERE player_id = ?`)
      .run(gender, JSON.stringify(clean), now, playerId);

    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined;
    return row ? rowToPlayerAccount(row) : null;
  }
}
