import crypto from 'node:crypto';
import { enforceCustomizationProgression } from '../data/progressionCatalog';
import { getLevelFromXp, getUnlockedItemsForLevel } from '../data/progressionCatalog';
import { KodamaSpawnKind, sanitizeKodamaProgress } from '../data/kodamaChallenge';
import { ActivityId, CharacterCustomization, Gender, PlayerAccount } from '../types/game';

export interface PlayerRow {
  id: number;
  player_id: string;
  player_id_lower?: string | null;
  email?: string | null;
  email_lower?: string | null;
  username: string;
  username_lower: string;
  password_hash: string;
  recovery_question: string;
  recovery_answer_hash: string;
  gender: Gender;
  profile_completed?: number | boolean;
  level?: number;
  xp?: number;
  orbs_cleared?: number;
  unlocked_items?: string;
  diamonds?: number;
  kodama_completed_rounds?: string;
  stage2_unlocked?: number | boolean;
  male_customization: string;
  female_customization: string;
  created_at: string;
  updated_at: string;
}

export type MaybePromise<T> = T | Promise<T>;

export interface YokaiStore {
  registerPlayer(input: {
    email?: string;
    username?: string;
    playerId?: string;
    password: string;
    confirmPassword: string;
    gender?: Gender;
    recoveryQuestion?: string;
    recoveryAnswer?: string;
  }): MaybePromise<
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number }
  >;

  loginPlayer(input: {
    email?: string;
    username?: string;
    playerId?: string;
    password?: string;
  }): MaybePromise<
    | { ok: true; player: PlayerAccount; sessionToken: string }
    | { ok: false; error: string; status: number }
  >;

  getRecoveryQuestion(
    identifier: string,
  ): MaybePromise<{ ok: true; question: string } | { ok: false; error: string; status: number }>;

  resetPassword(input: {
    username: string;
    recoveryAnswer: string;
    newPassword: string;
    confirmNewPassword: string;
  }): MaybePromise<{ ok: true } | { ok: false; error: string; status: number }>;

  getPlayerBySession(token: string | undefined): MaybePromise<PlayerAccount | null>;

  deleteSession(token: string | undefined): MaybePromise<void>;

  updatePlayerGender(playerId: string, gender: Gender): MaybePromise<PlayerAccount | null>;

  updatePlayerProfile(
    playerId: string,
    input: { username: string; gender: Gender },
  ): MaybePromise<
    | { ok: true; player: PlayerAccount }
    | { ok: false; error: string; status: number }
  >;

  updatePlayerCustomization(
    playerId: string,
    gender: Gender,
    customization: Partial<CharacterCustomization>,
  ): MaybePromise<
    | { ok: true; player: PlayerAccount }
    | { ok: false; error: string; status: number }
  >;

  recordActivityProgress(
    playerId: string,
    activityId: ActivityId,
  ): MaybePromise<
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
      }
    | { ok: false; error: string; status: number }
  >;

  awardKodamaHit(
    playerId: string,
    kind?: KodamaSpawnKind,
    ghostKey?: string,
  ): MaybePromise<
    | {
        ok: true;
        player: PlayerAccount;
        leveledUp: boolean;
        newlyUnlocked: string[];
        diamondAwarded: number;
        alreadyRewarded: boolean;
      }
    | { ok: false; error: string; status: number }
  >;

  completeKodamaRound(
    playerId: string,
    round: number,
    hits: number,
  ): MaybePromise<
    | {
        ok: true;
        player: PlayerAccount;
        passed: boolean;
        newlyCompleted: boolean;
        stage2JustUnlocked: boolean;
      }
    | { ok: false; error: string; status: number }
  >;
}

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifySecret(secret: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHex] = parts;
  const derived = crypto.scryptSync(secret, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseUnlockedItems(raw: string | undefined): string[] {
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

export function parseCompletedRounds(raw: string | undefined): number[] {
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

export function rowToPlayerAccount(row: PlayerRow): PlayerAccount {
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
    email: row.email ?? null,
    username: row.username,
    gender: row.gender,
    profileCompleted:
      row.profile_completed === undefined ? true : Boolean(row.profile_completed),
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

export function resolvePostgresConnectionString(): string | null {
  const candidates = [
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.NEON_DATABASE_URL,
    process.env.STORAGE_POSTGRES_URL,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

let cachedStorePromise: Promise<YokaiStore> | null = null;

export function getDatabaseStore(): Promise<YokaiStore> {
  if (!cachedStorePromise) {
    cachedStorePromise = (async () => {
      const pgUrl = resolvePostgresConnectionString();
      if (pgUrl) {
        const { PostgresYokaiDatabase } = await import('./postgresDb');
        const store = new PostgresYokaiDatabase(pgUrl);
        await store.init();
        return store;
      }

      if (process.env.VERCEL) {
        console.warn(
          '[Yokai Hunters] Running on Vercel without DATABASE_URL/POSTGRES_URL. Falling back to ephemeral /tmp SQLite storage; configure POSTGRES_URL or DATABASE_URL in Vercel Environment Variables for cross-instance persistence.',
        );
      }

      const { YokaiDatabase } = await import('./db');
      return new YokaiDatabase();
    })().catch((err) => {
      cachedStorePromise = null;
      throw err;
    });
  }
  return cachedStorePromise;
}
