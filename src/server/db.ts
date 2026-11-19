import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
  getDefaultCustomization,
} from '../data/customizationCatalog';
import {
  ACTIVITY_DEFINITIONS,
  enforceCustomizationProgression,
  findLockedCustomizationError,
  getLevelFromXp,
  getUnlockedItemsForLevel,
  isActivityUnlocked,
} from '../data/progressionCatalog';
import {
  applyRoundCompletion,
  KODAMA_TOTAL_ROUNDS,
  sanitizeKodamaProgress,
} from '../data/kodamaChallenge';
import { ActivityId, CharacterCustomization, Gender, PlayerAccount } from '../types/game';
import {
  normalizePlayerId,
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
  player_id_lower?: string | null;
  username: string;
  username_lower: string;
  password_hash: string;
  recovery_question: string;
  recovery_answer_hash: string;
  gender: Gender;
  level?: number;
  xp?: number;
  orbs_cleared?: number;
  unlocked_items?: string;
  diamonds?: number;
  kodama_completed_rounds?: string;
  stage2_unlocked?: number;
  male_customization: string;
  female_customization: string;
  created_at: string;
  updated_at: string;
}

function parseUnlockedItems(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseCompletedRounds(raw: string | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => typeof item === 'number')
      : [];
  } catch {
    return [];
  }
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

  const xp = Math.max(0, Math.floor(Number(row.xp ?? 0)));
  const level = Math.max(1, getLevelFromXp(xp), Math.floor(Number(row.level ?? 1)));
  const orbsCleared = Math.max(0, Math.floor(Number(row.orbs_cleared ?? 0)));
  const unlockedItems = getUnlockedItemsForLevel(level, parseUnlockedItems(row.unlocked_items));
  const kodamaProgress = sanitizeKodamaProgress({
    diamonds: row.diamonds ?? 0,
    completedRounds: parseCompletedRounds(row.kodama_completed_rounds),
    stage2Unlocked: Boolean(row.stage2_unlocked),
  });

  return {
    playerId: row.player_id,
    username: row.username,
    gender: row.gender,
    level,
    xp,
    orbsCleared,
    unlockedItems,
    kodamaProgress,
    recoveryQuestion: row.recovery_question,
    maleCustomization: enforceCustomizationProgression(parsedMale, 'male', level, unlockedItems),
    femaleCustomization: enforceCustomizationProgression(
      parsedFemale,
      'female',
      level,
      unlockedItems,
    ),
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
        player_id_lower TEXT,
        username TEXT NOT NULL,
        username_lower TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        recovery_question TEXT NOT NULL,
        recovery_answer_hash TEXT NOT NULL,
        gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        orbs_cleared INTEGER NOT NULL DEFAULT 0,
        unlocked_items TEXT NOT NULL DEFAULT '[]',
        diamonds INTEGER NOT NULL DEFAULT 0,
        kodama_completed_rounds TEXT NOT NULL DEFAULT '[]',
        stage2_unlocked INTEGER NOT NULL DEFAULT 0,
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

    const columns = this.db.prepare('PRAGMA table_info(players)').all() as { name: string }[];
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('player_id_lower')) {
      this.db.exec('ALTER TABLE players ADD COLUMN player_id_lower TEXT;');
    }
    if (!colNames.has('level')) {
      this.db.exec('ALTER TABLE players ADD COLUMN level INTEGER NOT NULL DEFAULT 1;');
    }
    if (!colNames.has('xp')) {
      this.db.exec('ALTER TABLE players ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;');
    }
    if (!colNames.has('orbs_cleared')) {
      this.db.exec('ALTER TABLE players ADD COLUMN orbs_cleared INTEGER NOT NULL DEFAULT 0;');
    }
    if (!colNames.has('unlocked_items')) {
      this.db.exec("ALTER TABLE players ADD COLUMN unlocked_items TEXT NOT NULL DEFAULT '[]';");
    }
    if (!colNames.has('diamonds')) {
      this.db.exec('ALTER TABLE players ADD COLUMN diamonds INTEGER NOT NULL DEFAULT 0;');
    }
    if (!colNames.has('kodama_completed_rounds')) {
      this.db.exec(
        "ALTER TABLE players ADD COLUMN kodama_completed_rounds TEXT NOT NULL DEFAULT '[]';",
      );
    }
    if (!colNames.has('stage2_unlocked')) {
      this.db.exec('ALTER TABLE players ADD COLUMN stage2_unlocked INTEGER NOT NULL DEFAULT 0;');
    }

    this.db.exec(`
      UPDATE players
      SET player_id_lower = LOWER(TRIM(player_id))
      WHERE player_id_lower IS NULL OR player_id_lower = '';
    `);

    this.db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_players_player_id_lower ON players(player_id_lower);',
    );
  }

  close(): void {
    this.db.close();
  }

  registerPlayer(input: {
    username: string;
    playerId?: string;
    password: string;
    confirmPassword: string;
    gender: Gender;
    recoveryQuestion?: string;
    recoveryAnswer: string;
  }):
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number } {
    const requestedPlayerId = input.playerId ? normalizePlayerId(input.playerId) : '';
    const validation = validateRegistrationInput({
      username: input.username,
      playerId: requestedPlayerId || undefined,
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

    const existingUsername = this.db
      .prepare('SELECT player_id FROM players WHERE username_lower = ?')
      .get(usernameLower);
    if (existingUsername) {
      return {
        ok: false,
        error: 'That username is already claimed by another hunter. Choose a unique username.',
        status: 409,
      };
    }

    if (requestedPlayerId) {
      const requestedLower = requestedPlayerId.toLowerCase();
      const existingPlayerId = this.db
        .prepare(
          'SELECT player_id FROM players WHERE player_id_lower = ? OR LOWER(TRIM(player_id)) = ?',
        )
        .get(requestedLower, requestedLower);
      if (existingPlayerId) {
        return {
          ok: false,
          error: 'That Player ID is already registered to another hunter. Choose a unique Player ID.',
          status: 409,
        };
      }
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
    const starterUnlockedJson = JSON.stringify(getUnlockedItemsForLevel(1));

    const tempId = `YH-PENDING-${crypto.randomUUID()}`;
    const insert = this.db.prepare(`
      INSERT INTO players (
        player_id, player_id_lower, username, username_lower, password_hash,
        recovery_question, recovery_answer_hash, gender,
        level, xp, orbs_cleared, unlocked_items,
        male_customization, female_customization, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      const initialId = requestedPlayerId || tempId;
      const info = insert.run(
        initialId,
        initialId.toLowerCase(),
        username,
        usernameLower,
        passwordHash,
        recoveryQuestion,
        recoveryAnswerHash,
        input.gender,
        1,
        0,
        0,
        starterUnlockedJson,
        maleJson,
        femaleJson,
        now,
        now,
      );

      if (requestedPlayerId) {
        return requestedPlayerId;
      }

      const numericId = Number(info.lastInsertRowid);
      let candidateNum = 10000 + numericId;
      let assignedId = `YH-${candidateNum}`;
      while (
        this.db
          .prepare('SELECT 1 FROM players WHERE player_id_lower = ?')
          .get(assignedId.toLowerCase())
      ) {
        candidateNum += 1;
        assignedId = `YH-${candidateNum}`;
      }
      this.db
        .prepare('UPDATE players SET player_id = ?, player_id_lower = ? WHERE id = ?')
        .run(assignedId, assignedId.toLowerCase(), numericId);
      return assignedId;
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
    playerId?: string;
    password?: string;
  }):
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number } {
    const usernameLower = normalizeUsername(input.username ?? '').toLowerCase();
    const cleanPlayerId = normalizePlayerId(input.playerId ?? '');
    const cleanPassword = typeof input.password === 'string' ? input.password : '';

    if (!usernameLower || (!cleanPlayerId && !cleanPassword)) {
      return {
        ok: false,
        error: 'Enter your username along with your Player ID or password.',
        status: 400,
      };
    }

    const row = (this.db
      .prepare('SELECT * FROM players WHERE username_lower = ?')
      .get(usernameLower) ??
      this.db
        .prepare('SELECT * FROM players WHERE LOWER(TRIM(username)) = ?')
        .get(usernameLower)) as PlayerRow | undefined;

    if (!row) {
      return {
        ok: false,
        error: 'No hunter account found with those credentials.',
        status: 401,
      };
    }

    if (cleanPlayerId && row.player_id.trim().toLowerCase() !== cleanPlayerId.toLowerCase()) {
      return {
        ok: false,
        error: 'Player ID does not match the registered hunter username.',
        status: 401,
      };
    }

    if (cleanPassword && !verifySecret(cleanPassword, row.password_hash)) {
      return {
        ok: false,
        error: 'Invalid username or password.',
        status: 401,
      };
    }

    const sessionToken = this.createSession(row.player_id);
    return { ok: true, player: rowToPlayerAccount(row), sessionToken };
  }

  getRecoveryQuestion(
    username: string,
  ): { ok: true; question: string } | { ok: false; error: string; status: number } {
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
  ):
    | { ok: true; player: PlayerAccount }
    | { ok: false; error: string; status: number } {
    if (gender !== 'male' && gender !== 'female') {
      return { ok: false, error: 'Invalid gender category.', status: 400 };
    }
    if (!customization || typeof customization !== 'object') {
      return { ok: false, error: 'Invalid customization payload.', status: 400 };
    }

    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined;
    if (!row) {
      return { ok: false, error: 'Player account not found.', status: 404 };
    }

    const account = rowToPlayerAccount(row);
    const currentCustom =
      gender === 'male' ? account.maleCustomization : account.femaleCustomization;

    const lockedError = findLockedCustomizationError(
      customization,
      currentCustom,
      account.level,
      account.unlockedItems,
    );
    if (lockedError) {
      return { ok: false, error: lockedError, status: 403 };
    }

    const clean = enforceCustomizationProgression(
      customization,
      gender,
      account.level,
      account.unlockedItems,
    );
    const now = new Date().toISOString();
    const col = gender === 'male' ? 'male_customization' : 'female_customization';
    this.db
      .prepare(`UPDATE players SET gender = ?, ${col} = ?, updated_at = ? WHERE player_id = ?`)
      .run(gender, JSON.stringify(clean), now, playerId);

    const updated = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow;
    return { ok: true, player: rowToPlayerAccount(updated) };
  }

  recordActivityProgress(
    playerId: string,
    activityId: ActivityId,
  ):
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
      }
    | { ok: false; error: string; status: number } {
    const activity = ACTIVITY_DEFINITIONS.find((a) => a.id === activityId);
    if (!activity) {
      return { ok: false, error: 'Unknown gameplay activity.', status: 400 };
    }

    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined;
    if (!row) {
      return { ok: false, error: 'Player account not found.', status: 404 };
    }

    const currentXp = Math.max(0, Math.floor(Number(row.xp ?? 0)));
    const currentLevel = Math.max(1, getLevelFromXp(currentXp), Math.floor(Number(row.level ?? 1)));

    if (!isActivityUnlocked(currentLevel, activityId)) {
      return {
        ok: false,
        error: `${activity.name} is locked. Unlock at Level ${activity.requiredLevel}.`,
        status: 403,
      };
    }

    const existingUnlocked = getUnlockedItemsForLevel(
      currentLevel,
      parseUnlockedItems(row.unlocked_items),
    );
    const nextXp = currentXp + activity.xpPerHit;
    const nextLevel = Math.max(currentLevel, getLevelFromXp(nextXp));
    const nextOrbsCleared = Math.max(0, Math.floor(Number(row.orbs_cleared ?? 0))) + 1;
    const nextUnlocked = getUnlockedItemsForLevel(nextLevel, existingUnlocked);

    const existingSet = new Set(existingUnlocked);
    const newlyUnlocked = nextUnlocked.filter((item) => !existingSet.has(item));
    const leveledUp = nextLevel > currentLevel;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE players
         SET level = ?, xp = ?, orbs_cleared = ?, unlocked_items = ?, updated_at = ?
         WHERE player_id = ?`,
      )
      .run(nextLevel, nextXp, nextOrbsCleared, JSON.stringify(nextUnlocked), now, playerId);

    const updated = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow;
    return {
      ok: true,
      player: rowToPlayerAccount(updated),
      leveledUp,
      newlyUnlocked,
    };
  }

  awardKodamaHit(playerId: string):
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
      }
    | { ok: false; error: string; status: number } {
    const archeryDef = ACTIVITY_DEFINITIONS.find((a) => a.id === 'archery')!;
    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined;
    if (!row) {
      return { ok: false, error: 'Player account not found.', status: 404 };
    }

    const currentXp = Math.max(0, Math.floor(Number(row.xp ?? 0)));
    const currentLevel = Math.max(1, getLevelFromXp(currentXp), Math.floor(Number(row.level ?? 1)));
    const existingUnlocked = getUnlockedItemsForLevel(
      currentLevel,
      parseUnlockedItems(row.unlocked_items),
    );
    const nextXp = currentXp + archeryDef.xpPerHit;
    const nextLevel = Math.max(currentLevel, getLevelFromXp(nextXp));
    const nextOrbsCleared = Math.max(0, Math.floor(Number(row.orbs_cleared ?? 0))) + 1;
    const nextDiamonds = Math.max(0, Math.floor(Number(row.diamonds ?? 0))) + 1;
    const nextUnlocked = getUnlockedItemsForLevel(nextLevel, existingUnlocked);

    const existingSet = new Set(existingUnlocked);
    const newlyUnlocked = nextUnlocked.filter((item) => !existingSet.has(item));
    const leveledUp = nextLevel > currentLevel;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE players
         SET level = ?, xp = ?, orbs_cleared = ?, unlocked_items = ?, diamonds = ?, updated_at = ?
         WHERE player_id = ?`,
      )
      .run(
        nextLevel,
        nextXp,
        nextOrbsCleared,
        JSON.stringify(nextUnlocked),
        nextDiamonds,
        now,
        playerId,
      );

    const updated = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow;
    return {
      ok: true,
      player: rowToPlayerAccount(updated),
      leveledUp,
      newlyUnlocked,
    };
  }

  completeKodamaRound(
    playerId: string,
    round: number,
    hits: number,
  ):
    | {
        ok: true;
        player: PlayerAccount;
        passed: boolean;
        newlyCompleted: boolean;
        stage2JustUnlocked: boolean;
      }
    | { ok: false; error: string; status: number } {
    if (
      typeof round !== 'number' ||
      !Number.isFinite(round) ||
      round < 1 ||
      round > KODAMA_TOTAL_ROUNDS
    ) {
      return { ok: false, error: 'Invalid Kodama challenge round.', status: 400 };
    }
    if (typeof hits !== 'number' || !Number.isFinite(hits) || hits < 0) {
      return { ok: false, error: 'Invalid hit count.', status: 400 };
    }

    const row = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow | undefined;
    if (!row) {
      return { ok: false, error: 'Player account not found.', status: 404 };
    }

    const currentProgress = sanitizeKodamaProgress({
      diamonds: row.diamonds ?? 0,
      completedRounds: parseCompletedRounds(row.kodama_completed_rounds),
      stage2Unlocked: Boolean(row.stage2_unlocked),
    });

    const outcome = applyRoundCompletion(currentProgress, Math.floor(round), Math.floor(hits));
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE players
         SET kodama_completed_rounds = ?, stage2_unlocked = ?, updated_at = ?
         WHERE player_id = ?`,
      )
      .run(
        JSON.stringify(outcome.progress.completedRounds),
        outcome.progress.stage2Unlocked ? 1 : 0,
        now,
        playerId,
      );

    const updated = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow;
    return {
      ok: true,
      player: rowToPlayerAccount(updated),
      passed: outcome.passed,
      newlyCompleted: outcome.newlyCompleted,
      stage2JustUnlocked: outcome.stage2JustUnlocked,
    };
  }
}
