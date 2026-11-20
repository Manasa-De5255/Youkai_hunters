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
  getDiamondRewardForGhost,
  KODAMA_TOTAL_ROUNDS,
  KodamaSpawnKind,
  sanitizeKodamaProgress,
} from '../data/kodamaChallenge';
import { ActivityId, CharacterCustomization, Gender, PlayerAccount } from '../types/game';
import {
  normalizeEmail,
  normalizePlayerId,
  normalizePlayerName,
  normalizeUsername,
  validatePasswordResetInput,
  validatePlayerName,
  validateRegistrationInput,
} from '../utils/authValidation';
import {
  hashSecret,
  hashToken,
  parseCompletedRounds,
  parseUnlockedItems,
  PlayerRow,
  rowToPlayerAccount,
  verifySecret,
  YokaiStore,
} from './store';

function resolveDefaultSqlitePath(): string {
  if (process.env.SQLITE_DB_PATH && process.env.SQLITE_DB_PATH.trim()) {
    return process.env.SQLITE_DB_PATH.trim();
  }
  if (process.env.VERCEL) {
    return path.join('/tmp', 'yokai_hunters.db');
  }
  return path.resolve(process.cwd(), 'data', 'yokai_hunters.db');
}

export class YokaiDatabase implements YokaiStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    let resolved = dbPath ?? resolveDefaultSqlitePath();
    if (resolved !== ':memory:') {
      try {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
      } catch (err) {
        if (!dbPath) {
          resolved = path.join('/tmp', 'yokai_hunters.db');
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
        } else {
          throw err;
        }
      }
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
        email TEXT,
        email_lower TEXT,
        username TEXT NOT NULL,
        username_lower TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        recovery_question TEXT NOT NULL,
        recovery_answer_hash TEXT NOT NULL,
        gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
        profile_completed INTEGER NOT NULL DEFAULT 1,
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

      CREATE TABLE IF NOT EXISTS rewarded_ghosts (
        player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        ghost_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (player_id, ghost_key)
      );
    `);

    const columns = this.db.prepare('PRAGMA table_info(players)').all() as { name: string }[];
    const colNames = new Set(columns.map((c) => c.name));

    if (!colNames.has('player_id_lower')) {
      this.db.exec('ALTER TABLE players ADD COLUMN player_id_lower TEXT;');
    }
    if (!colNames.has('email')) {
      this.db.exec('ALTER TABLE players ADD COLUMN email TEXT;');
    }
    if (!colNames.has('email_lower')) {
      this.db.exec('ALTER TABLE players ADD COLUMN email_lower TEXT;');
    }
    if (!colNames.has('profile_completed')) {
      this.db.exec('ALTER TABLE players ADD COLUMN profile_completed INTEGER NOT NULL DEFAULT 1;');
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
    this.db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email_lower ON players(email_lower) WHERE email_lower IS NOT NULL AND email_lower != '';",
    );
  }

  close(): void {
    this.db.close();
  }

  registerPlayer(input: {
    email?: string;
    username?: string;
    playerId?: string;
    password: string;
    confirmPassword: string;
    gender?: Gender;
    recoveryQuestion?: string;
    recoveryAnswer?: string;
  }):
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number } {
    const requestedEmail = input.email ? normalizeEmail(input.email) : '';
    const requestedPlayerId = input.playerId ? normalizePlayerId(input.playerId) : '';
    const requestedUsername = input.username ? normalizePlayerName(input.username) : '';

    const validation = validateRegistrationInput({
      email: requestedEmail || undefined,
      username: requestedUsername || undefined,
      playerId: requestedPlayerId || undefined,
      password: input.password,
      confirmPassword: input.confirmPassword,
      gender: input.gender,
      recoveryAnswer: input.recoveryAnswer,
    });
    if (!validation.valid) {
      return { ok: false, error: validation.error || 'Invalid registration data.', status: 400 };
    }

    if (requestedEmail) {
      const existingEmail = this.db
        .prepare('SELECT player_id FROM players WHERE email_lower = ?')
        .get(requestedEmail);
      if (existingEmail) {
        return {
          ok: false,
          error: 'An account with that email address already exists. Please sign in instead.',
          status: 409,
        };
      }
    }

    const explicitProfileProvided =
      Boolean(requestedUsername) && (input.gender === 'male' || input.gender === 'female');

    let username = requestedUsername;
    if (!username) {
      username = `Hunter-${crypto.randomBytes(3).toString('hex')}`;
      while (
        this.db
          .prepare('SELECT player_id FROM players WHERE username_lower = ?')
          .get(username.toLowerCase())
      ) {
        username = `Hunter-${crypto.randomBytes(3).toString('hex')}`;
      }
    } else {
      const existingUsername = this.db
        .prepare('SELECT player_id FROM players WHERE username_lower = ?')
        .get(username.toLowerCase());
      if (existingUsername) {
        return {
          ok: false,
          error: 'That player name is already claimed by another hunter. Choose a unique name.',
          status: 409,
        };
      }
    }
    const usernameLower = username.toLowerCase();

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
    const hasCustomRecovery = Boolean(input.recoveryAnswer && input.recoveryAnswer.trim().length >= 2);
    const recoveryQuestion = hasCustomRecovery
      ? input.recoveryQuestion && input.recoveryQuestion.trim().length > 0
        ? input.recoveryQuestion.trim()
        : 'Guardian Spirit Secret Word'
      : 'Guardian Spirit Secret Word';
    const recoveryAnswerHash = hashSecret(
      hasCustomRecovery
        ? input.recoveryAnswer!.trim().toLowerCase()
        : crypto.randomUUID(),
    );
    const assignedGender: Gender = input.gender === 'female' ? 'female' : 'male';
    const profileCompleted = explicitProfileProvided ? 1 : 0;
    const maleJson = JSON.stringify(getDefaultCustomization('male'));
    const femaleJson = JSON.stringify(getDefaultCustomization('female'));
    const starterUnlockedJson = JSON.stringify(getUnlockedItemsForLevel(1));

    const tempId = `YH-PENDING-${crypto.randomUUID()}`;
    const insert = this.db.prepare(`
      INSERT INTO players (
        player_id, player_id_lower, email, email_lower, username, username_lower, password_hash,
        recovery_question, recovery_answer_hash, gender, profile_completed,
        level, xp, orbs_cleared, unlocked_items,
        male_customization, female_customization, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction(() => {
      const initialId = requestedPlayerId || tempId;
      const info = insert.run(
        initialId,
        initialId.toLowerCase(),
        requestedEmail || null,
        requestedEmail || null,
        username,
        usernameLower,
        passwordHash,
        recoveryQuestion,
        recoveryAnswerHash,
        assignedGender,
        profileCompleted,
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
    email?: string;
    username?: string;
    playerId?: string;
    password?: string;
  }):
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number } {
    const rawIdentifier = (input.email || input.username || '').trim();
    const identifierLower = rawIdentifier.toLowerCase();
    const cleanPlayerId = normalizePlayerId(input.playerId ?? '');
    const cleanPassword = typeof input.password === 'string' ? input.password : '';

    if (!identifierLower || (!cleanPlayerId && !cleanPassword)) {
      return {
        ok: false,
        error: 'Enter your email (or hunter name) along with your password or Player ID.',
        status: 400,
      };
    }

    let row: PlayerRow | undefined;
    if (input.email || identifierLower.includes('@')) {
      row = this.db
        .prepare('SELECT * FROM players WHERE email_lower = ?')
        .get(identifierLower) as PlayerRow | undefined;
    }
    if (!row) {
      row = (this.db
        .prepare('SELECT * FROM players WHERE username_lower = ?')
        .get(identifierLower) ??
        this.db
          .prepare('SELECT * FROM players WHERE LOWER(TRIM(username)) = ?')
          .get(identifierLower) ??
        this.db
          .prepare('SELECT * FROM players WHERE email_lower = ?')
          .get(identifierLower)) as PlayerRow | undefined;
    }

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
        error: 'Player ID does not match the registered hunter account.',
        status: 401,
      };
    }

    if (cleanPassword && !verifySecret(cleanPassword, row.password_hash)) {
      return {
        ok: false,
        error: 'Invalid email/username or password.',
        status: 401,
      };
    }

    const sessionToken = this.createSession(row.player_id);
    return { ok: true, player: rowToPlayerAccount(row), sessionToken };
  }

  getRecoveryQuestion(
    identifier: string,
  ): { ok: true; question: string } | { ok: false; error: string; status: number } {
    const cleanLower = normalizeUsername(identifier).toLowerCase();
    if (!cleanLower) {
      return { ok: false, error: 'Enter your email or username first.', status: 400 };
    }
    const row = (this.db
      .prepare('SELECT recovery_question FROM players WHERE email_lower = ? OR username_lower = ?')
      .get(cleanLower, cleanLower) ??
      this.db
        .prepare('SELECT recovery_question FROM players WHERE LOWER(TRIM(username)) = ?')
        .get(cleanLower)) as { recovery_question: string } | undefined;
    if (!row) {
      return { ok: false, error: 'No hunter account found with that email or username.', status: 404 };
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

    const cleanLower = normalizeUsername(input.username).toLowerCase();
    const row = (this.db
      .prepare('SELECT * FROM players WHERE email_lower = ? OR username_lower = ?')
      .get(cleanLower, cleanLower) ??
      this.db
        .prepare('SELECT * FROM players WHERE LOWER(TRIM(username)) = ?')
        .get(cleanLower)) as PlayerRow | undefined;

    if (!row) {
      return { ok: false, error: 'No hunter account found with that email or username.', status: 404 };
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

  updatePlayerProfile(
    playerId: string,
    input: { username: string; gender: Gender },
  ):
    | { ok: true; player: PlayerAccount }
    | { ok: false; error: string; status: number } {
    const nameCheck = validatePlayerName(input.username ?? '');
    if (!nameCheck.valid) {
      return { ok: false, error: nameCheck.error || 'Invalid player name.', status: 400 };
    }
    if (input.gender !== 'male' && input.gender !== 'female') {
      return { ok: false, error: 'Please choose Male or Female.', status: 400 };
    }

    const cleanName = normalizePlayerName(input.username);
    const cleanLower = cleanName.toLowerCase();

    const conflict = this.db
      .prepare('SELECT player_id FROM players WHERE username_lower = ? AND player_id != ?')
      .get(cleanLower, playerId);
    if (conflict) {
      return {
        ok: false,
        error: 'That player name is already claimed by another hunter. Choose another name.',
        status: 409,
      };
    }

    const now = new Date().toISOString();
    const res = this.db
      .prepare(
        'UPDATE players SET username = ?, username_lower = ?, gender = ?, profile_completed = 1, updated_at = ? WHERE player_id = ?',
      )
      .run(cleanName, cleanLower, input.gender, now, playerId);
    if (res.changes === 0) {
      return { ok: false, error: 'Player account not found.', status: 404 };
    }

    const updated = this.db
      .prepare('SELECT * FROM players WHERE player_id = ?')
      .get(playerId) as PlayerRow;
    return { ok: true, player: rowToPlayerAccount(updated) };
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

  awardKodamaHit(
    playerId: string,
    kind: KodamaSpawnKind = 'wall',
    ghostKey?: string,
  ):
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
        diamondAwarded: number;
        alreadyRewarded: boolean;
      }
    | { ok: false; error: string; status: number } {
    const archeryDef = ACTIVITY_DEFINITIONS.find((a) => a.id === 'archery')!;
    const cleanKey = ghostKey && ghostKey.trim() ? ghostKey.trim().slice(0, 128) : '';

    const tx = this.db.transaction(() => {
      const row = this.db
        .prepare('SELECT * FROM players WHERE player_id = ?')
        .get(playerId) as PlayerRow | undefined;
      if (!row) {
        return { ok: false as const, error: 'Player account not found.', status: 404 };
      }

      const now = new Date().toISOString();
      const baseDiamondGain = getDiamondRewardForGhost(kind);
      let alreadyRewarded = false;
      let diamondGain = baseDiamondGain;

      if (cleanKey) {
        const insertReward = this.db
          .prepare(
            'INSERT OR IGNORE INTO rewarded_ghosts (player_id, ghost_key, created_at) VALUES (?, ?, ?)',
          )
          .run(playerId, cleanKey, now);
        if (insertReward.changes === 0) {
          alreadyRewarded = true;
          diamondGain = 0;
          return {
            ok: true as const,
            player: rowToPlayerAccount(row),
            leveledUp: false,
            newlyUnlocked: [],
            diamondAwarded: 0,
            alreadyRewarded: true,
          };
        }
      } else if (baseDiamondGain > 0) {
        this.db
          .prepare(
            'INSERT OR IGNORE INTO rewarded_ghosts (player_id, ghost_key, created_at) VALUES (?, ?, ?)',
          )
          .run(playerId, `anon:${crypto.randomUUID()}`, now);
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
      const nextDiamonds = Math.max(0, Math.floor(Number(row.diamonds ?? 0))) + diamondGain;
      const nextUnlocked = getUnlockedItemsForLevel(nextLevel, existingUnlocked);

      const existingSet = new Set(existingUnlocked);
      const newlyUnlocked = nextUnlocked.filter((item) => !existingSet.has(item));
      const leveledUp = nextLevel > currentLevel;

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
        ok: true as const,
        player: rowToPlayerAccount(updated),
        leveledUp,
        newlyUnlocked,
        diamondAwarded: diamondGain,
        alreadyRewarded,
      };
    });

    return tx();
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
