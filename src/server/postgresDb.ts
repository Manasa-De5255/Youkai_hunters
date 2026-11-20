import crypto from 'node:crypto';
import { Pool } from 'pg';
import { getDefaultCustomization } from '../data/customizationCatalog';
import {
  applyRoundCompletion,
  getDiamondRewardForGhost,
  KODAMA_TOTAL_ROUNDS,
  KodamaSpawnKind,
  sanitizeKodamaProgress,
} from '../data/kodamaChallenge';
import {
  ACTIVITY_DEFINITIONS,
  enforceCustomizationProgression,
  findLockedCustomizationError,
  getLevelFromXp,
  getUnlockedItemsForLevel,
  isActivityUnlocked,
} from '../data/progressionCatalog';
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

export class PostgresYokaiDatabase implements YokaiStore {
  private pool: Pool;
  private initialized = false;

  constructor(connectionString: string) {
    const isLocal =
      connectionString.includes('localhost') ||
      connectionString.includes('127.0.0.1') ||
      connectionString.includes('sslmode=disable');

    this.pool = new Pool({
      connectionString,
      max: 5,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        player_id TEXT NOT NULL UNIQUE,
        player_id_lower TEXT UNIQUE,
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

      ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS email_lower TEXT;
      ALTER TABLE players ADD COLUMN IF NOT EXISTS profile_completed INTEGER NOT NULL DEFAULT 1;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email_lower
        ON players(email_lower)
        WHERE email_lower IS NOT NULL AND email_lower != '';

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
    this.initialized = true;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async registerPlayer(input: {
    email?: string;
    username?: string;
    playerId?: string;
    password: string;
    confirmPassword: string;
    gender?: Gender;
    recoveryQuestion?: string;
    recoveryAnswer?: string;
  }): Promise<
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number }
  > {
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
      const existingEmail = await this.pool.query(
        'SELECT player_id FROM players WHERE email_lower = $1',
        [requestedEmail],
      );
      if (existingEmail.rows.length > 0) {
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
      while (true) {
        const dup = await this.pool.query(
          'SELECT player_id FROM players WHERE username_lower = $1',
          [username.toLowerCase()],
        );
        if (dup.rows.length === 0) break;
        username = `Hunter-${crypto.randomBytes(3).toString('hex')}`;
      }
    } else {
      const existingUsername = await this.pool.query(
        'SELECT player_id FROM players WHERE username_lower = $1',
        [username.toLowerCase()],
      );
      if (existingUsername.rows.length > 0) {
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
      const existingPlayerId = await this.pool.query(
        'SELECT player_id FROM players WHERE player_id_lower = $1 OR LOWER(TRIM(player_id)) = $2',
        [requestedLower, requestedLower],
      );
      if (existingPlayerId.rows.length > 0) {
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

    const client = await this.pool.connect();
    let assignedPlayerId = requestedPlayerId;
    try {
      await client.query('BEGIN');
      const initialId = requestedPlayerId || `YH-PENDING-${crypto.randomUUID()}`;
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO players (
          player_id, player_id_lower, email, email_lower, username, username_lower, password_hash,
          recovery_question, recovery_answer_hash, gender, profile_completed,
          level, xp, orbs_cleared, unlocked_items,
          male_customization, female_customization, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        RETURNING id`,
        [
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
        ],
      );

      if (!requestedPlayerId) {
        const numericId = Number(inserted.rows[0].id);
        let candidateNum = 10000 + numericId;
        let candidateId = `YH-${candidateNum}`;
        while (true) {
          const dup = await client.query(
            'SELECT 1 FROM players WHERE player_id_lower = $1',
            [candidateId.toLowerCase()],
          );
          if (dup.rows.length === 0) break;
          candidateNum += 1;
          candidateId = `YH-${candidateNum}`;
        }
        await client.query(
          'UPDATE players SET player_id = $1, player_id_lower = $2 WHERE id = $3',
          [candidateId, candidateId.toLowerCase(), numericId],
        );
        assignedPlayerId = candidateId;
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    const rowRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [assignedPlayerId],
    );
    const sessionToken = await this.createSession(assignedPlayerId);
    return { ok: true, player: rowToPlayerAccount(rowRes.rows[0]), sessionToken };
  }

  async loginPlayer(input: {
    email?: string;
    username?: string;
    playerId?: string;
    password?: string;
  }): Promise<
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number }
  > {
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
      const emailRes = await this.pool.query<PlayerRow>(
        'SELECT * FROM players WHERE email_lower = $1 LIMIT 1',
        [identifierLower],
      );
      row = emailRes.rows[0];
    }
    if (!row) {
      const res = await this.pool.query<PlayerRow>(
        'SELECT * FROM players WHERE username_lower = $1 OR LOWER(TRIM(username)) = $1 OR email_lower = $1 LIMIT 1',
        [identifierLower],
      );
      row = res.rows[0];
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

    const sessionToken = await this.createSession(row.player_id);
    return { ok: true, player: rowToPlayerAccount(row), sessionToken };
  }

  async getRecoveryQuestion(
    identifier: string,
  ): Promise<{ ok: true; question: string } | { ok: false; error: string; status: number }> {
    const cleanLower = normalizeUsername(identifier).toLowerCase();
    if (!cleanLower) {
      return { ok: false, error: 'Enter your email or username first.', status: 400 };
    }
    const res = await this.pool.query<{ recovery_question: string }>(
      'SELECT recovery_question FROM players WHERE email_lower = $1 OR username_lower = $1 OR LOWER(TRIM(username)) = $1 LIMIT 1',
      [cleanLower],
    );
    const row = res.rows[0];
    if (!row) {
      return { ok: false, error: 'No hunter account found with that email or username.', status: 404 };
    }
    return { ok: true, question: row.recovery_question };
  }

  async resetPassword(input: {
    username: string;
    recoveryAnswer: string;
    newPassword: string;
    confirmNewPassword: string;
  }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
    const check = validatePasswordResetInput(input);
    if (!check.valid) {
      return { ok: false, error: check.error || 'Invalid reset details.', status: 400 };
    }

    const cleanLower = normalizeUsername(input.username).toLowerCase();
    const res = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE email_lower = $1 OR username_lower = $1 OR LOWER(TRIM(username)) = $1 LIMIT 1',
      [cleanLower],
    );
    const row = res.rows[0];
    if (!row) {
      return { ok: false, error: 'No hunter account found with that email or username.', status: 404 };
    }

    const normalizedAnswer = input.recoveryAnswer.trim().toLowerCase();
    if (!verifySecret(normalizedAnswer, row.recovery_answer_hash)) {
      return { ok: false, error: 'Recovery answer is incorrect.', status: 403 };
    }

    const nextHash = hashSecret(input.newPassword);
    const now = new Date().toISOString();
    await this.pool.query(
      'UPDATE players SET password_hash = $1, updated_at = $2 WHERE player_id = $3',
      [nextHash, now, row.player_id],
    );
    await this.pool.query('DELETE FROM sessions WHERE player_id = $1', [row.player_id]);
    return { ok: true };
  }

  async createSession(playerId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const now = new Date();
    const expires = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14);
    await this.pool.query(
      'INSERT INTO sessions (token_hash, player_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
      [tokenHash, playerId, now.toISOString(), expires.toISOString()],
    );
    return token;
  }

  async getPlayerBySession(token: string | undefined): Promise<PlayerAccount | null> {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const sessionRes = await this.pool.query<{ player_id: string; expires_at: string }>(
      'SELECT player_id, expires_at FROM sessions WHERE token_hash = $1',
      [tokenHash],
    );
    const session = sessionRes.rows[0];
    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
      return null;
    }

    const rowRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [session.player_id],
    );
    const row = rowRes.rows[0];
    return row ? rowToPlayerAccount(row) : null;
  }

  async deleteSession(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }

  async updatePlayerGender(playerId: string, gender: Gender): Promise<PlayerAccount | null> {
    if (gender !== 'male' && gender !== 'female') return null;
    const now = new Date().toISOString();
    await this.pool.query(
      'UPDATE players SET gender = $1, updated_at = $2 WHERE player_id = $3',
      [gender, now, playerId],
    );
    const rowRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    return rowRes.rows[0] ? rowToPlayerAccount(rowRes.rows[0]) : null;
  }

  async updatePlayerProfile(
    playerId: string,
    input: { username: string; gender: Gender },
  ): Promise<
    | { ok: true; player: PlayerAccount }
    | { ok: false; error: string; status: number }
  > {
    const nameCheck = validatePlayerName(input.username ?? '');
    if (!nameCheck.valid) {
      return { ok: false, error: nameCheck.error || 'Invalid player name.', status: 400 };
    }
    if (input.gender !== 'male' && input.gender !== 'female') {
      return { ok: false, error: 'Please choose Male or Female.', status: 400 };
    }

    const cleanName = normalizePlayerName(input.username);
    const cleanLower = cleanName.toLowerCase();

    const conflict = await this.pool.query(
      'SELECT player_id FROM players WHERE username_lower = $1 AND player_id != $2',
      [cleanLower, playerId],
    );
    if (conflict.rows.length > 0) {
      return {
        ok: false,
        error: 'That player name is already claimed by another hunter. Choose another name.',
        status: 409,
      };
    }

    const now = new Date().toISOString();
    const upd = await this.pool.query<PlayerRow>(
      'UPDATE players SET username = $1, username_lower = $2, gender = $3, profile_completed = 1, updated_at = $4 WHERE player_id = $5 RETURNING *',
      [cleanName, cleanLower, input.gender, now, playerId],
    );
    if (upd.rows.length === 0) {
      return { ok: false, error: 'Player account not found.', status: 404 };
    }
    return { ok: true, player: rowToPlayerAccount(upd.rows[0]) };
  }

  async updatePlayerCustomization(
    playerId: string,
    gender: Gender,
    customization: Partial<CharacterCustomization>,
  ): Promise<
    | { ok: true; player: PlayerAccount }
    | { ok: false; error: string; status: number }
  > {
    if (gender !== 'male' && gender !== 'female') {
      return { ok: false, error: 'Invalid gender category.', status: 400 };
    }
    if (!customization || typeof customization !== 'object') {
      return { ok: false, error: 'Invalid customization payload.', status: 400 };
    }

    const rowRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    const row = rowRes.rows[0];
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
    await this.pool.query(
      `UPDATE players SET gender = $1, ${col} = $2, updated_at = $3 WHERE player_id = $4`,
      [gender, JSON.stringify(clean), now, playerId],
    );

    const updatedRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    return { ok: true, player: rowToPlayerAccount(updatedRes.rows[0]) };
  }

  async recordActivityProgress(
    playerId: string,
    activityId: ActivityId,
  ): Promise<
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
      }
    | { ok: false; error: string; status: number }
  > {
    const activity = ACTIVITY_DEFINITIONS.find((a) => a.id === activityId);
    if (!activity) {
      return { ok: false, error: 'Unknown gameplay activity.', status: 400 };
    }

    const rowRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    const row = rowRes.rows[0];
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

    await this.pool.query(
      `UPDATE players
       SET level = $1, xp = $2, orbs_cleared = $3, unlocked_items = $4, updated_at = $5
       WHERE player_id = $6`,
      [nextLevel, nextXp, nextOrbsCleared, JSON.stringify(nextUnlocked), now, playerId],
    );

    const updatedRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    return {
      ok: true,
      player: rowToPlayerAccount(updatedRes.rows[0]),
      leveledUp,
      newlyUnlocked,
    };
  }

  async awardKodamaHit(
    playerId: string,
    kind: KodamaSpawnKind = 'wall',
    ghostKey?: string,
  ): Promise<
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
        diamondAwarded: number;
        alreadyRewarded: boolean;
      }
    | { ok: false; error: string; status: number }
  > {
    const archeryDef = ACTIVITY_DEFINITIONS.find((a) => a.id === 'archery')!;
    const cleanKey = ghostKey && ghostKey.trim() ? ghostKey.trim().slice(0, 128) : '';

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const rowRes = await client.query<PlayerRow>(
        'SELECT * FROM players WHERE player_id = $1 FOR UPDATE',
        [playerId],
      );
      const row = rowRes.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return { ok: false, error: 'Player account not found.', status: 404 };
      }

      const now = new Date().toISOString();
      const baseDiamondGain = getDiamondRewardForGhost(kind);
      let alreadyRewarded = false;
      let diamondGain = baseDiamondGain;

      if (cleanKey) {
        const ins = await client.query(
          'INSERT INTO rewarded_ghosts (player_id, ghost_key, created_at) VALUES ($1, $2, $3) ON CONFLICT (player_id, ghost_key) DO NOTHING',
          [playerId, cleanKey, now],
        );
        if ((ins.rowCount ?? 0) === 0) {
          alreadyRewarded = true;
          diamondGain = 0;
          await client.query('COMMIT');
          return {
            ok: true,
            player: rowToPlayerAccount(row),
            leveledUp: false,
            newlyUnlocked: [],
            diamondAwarded: 0,
            alreadyRewarded: true,
          };
        }
      } else if (baseDiamondGain > 0) {
        await client.query(
          'INSERT INTO rewarded_ghosts (player_id, ghost_key, created_at) VALUES ($1, $2, $3) ON CONFLICT (player_id, ghost_key) DO NOTHING',
          [playerId, `anon:${crypto.randomUUID()}`, now],
        );
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

      const updatedRes = await client.query<PlayerRow>(
        `UPDATE players
         SET level = $1, xp = $2, orbs_cleared = $3, unlocked_items = $4, diamonds = $5, updated_at = $6
         WHERE player_id = $7
         RETURNING *`,
        [
          nextLevel,
          nextXp,
          nextOrbsCleared,
          JSON.stringify(nextUnlocked),
          nextDiamonds,
          now,
          playerId,
        ],
      );

      await client.query('COMMIT');
      return {
        ok: true,
        player: rowToPlayerAccount(updatedRes.rows[0]),
        leveledUp,
        newlyUnlocked,
        diamondAwarded: diamondGain,
        alreadyRewarded,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async completeKodamaRound(
    playerId: string,
    round: number,
    hits: number,
  ): Promise<
    | {
        ok: true;
        player: PlayerAccount;
        passed: boolean;
        newlyCompleted: boolean;
        stage2JustUnlocked: boolean;
      }
    | { ok: false; error: string; status: number }
  > {
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

    const rowRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    const row = rowRes.rows[0];
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

    await this.pool.query(
      `UPDATE players
       SET kodama_completed_rounds = $1, stage2_unlocked = $2, updated_at = $3
       WHERE player_id = $4`,
      [
        JSON.stringify(outcome.progress.completedRounds),
        outcome.progress.stage2Unlocked ? 1 : 0,
        now,
        playerId,
      ],
    );

    const updatedRes = await this.pool.query<PlayerRow>(
      'SELECT * FROM players WHERE player_id = $1',
      [playerId],
    );
    return {
      ok: true,
      player: rowToPlayerAccount(updatedRes.rows[0]),
      passed: outcome.passed,
      newlyCompleted: outcome.newlyCompleted,
      stage2JustUnlocked: outcome.stage2JustUnlocked,
    };
  }
}
