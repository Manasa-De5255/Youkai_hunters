import express, { Express, NextFunction, Request, Response } from 'express';
import { KodamaSpawnKind } from '../data/kodamaChallenge';
import { ActivityId, Gender } from '../types/game';
import { getDatabaseStore, resolvePostgresConnectionString, YokaiStore } from './store';

const SESSION_COOKIE = 'yh_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const rawVal = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(rawVal);
    } catch {
      result[key] = rawVal;
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return req.secure || req.protocol === 'https' || forwardedProto === 'https';
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = isHttpsRequest(req);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

function getAllowedOrigins(): Set<string> | null {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw || !raw.trim()) return null;
  const set = new Set<string>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed) set.add(trimmed);
  }
  if (process.env.APP_URL) {
    set.add(process.env.APP_URL.trim().replace(/\/$/, ''));
  }
  if (process.env.VERCEL_URL) {
    set.add(`https://${process.env.VERCEL_URL.trim()}`);
  }
  return set;
}

export function createApiApp(options?: { store?: YokaiStore }): Express {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = getAllowedOrigins();

  // CORS + Preflight support for same-origin and cross-origin deployments
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!allowedOrigins || allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Return clean JSON error if request body contains malformed JSON
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    next(err);
  });

  // Normalize serverless pre-parsed Buffer/string request bodies if needed
  app.use((req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      try {
        const text = req.body.toString('utf8').trim();
        req.body = text ? JSON.parse(text) : {};
      } catch {
        res.status(400).json({ error: 'Invalid JSON request body.' });
        return;
      }
    } else if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          req.body = JSON.parse(trimmed);
        } catch {
          res.status(400).json({ error: 'Invalid JSON request body.' });
          return;
        }
      }
    }
    next();
  });

  const resolveStore = async (): Promise<YokaiStore> => {
    if (options?.store) return options.store;
    return getDatabaseStore();
  };

  const asyncRoute =
    (handler: (req: Request, res: Response, store: YokaiStore) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
      resolveStore()
        .then((store) => handler(req, res, store))
        .catch(next);
    };

  const getAuthenticatedPlayer = async (req: Request, store: YokaiStore) => {
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE];

    if (bearerToken) {
      const bearerPlayer = await store.getPlayerBySession(bearerToken);
      if (bearerPlayer) {
        return { token: bearerToken, cookieToken, player: bearerPlayer };
      }
    }

    if (cookieToken) {
      const cookiePlayer = await store.getPlayerBySession(cookieToken);
      if (cookiePlayer) {
        return { token: cookieToken, cookieToken, player: cookiePlayer };
      }
    }

    return { token: bearerToken || cookieToken, cookieToken, player: null };
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storage: resolvePostgresConnectionString() ? 'postgres' : 'sqlite',
      vercel: Boolean(process.env.VERCEL),
    });
  });

  app.get(
    '/api/auth/me',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      res.json({ player: player ?? null });
    }),
  );

  app.post(
    '/api/auth/register',
    asyncRoute(async (req, res, store) => {
      const {
        email,
        username,
        playerId,
        password,
        confirmPassword,
        gender,
        recoveryQuestion,
        recoveryAnswer,
      } = req.body ?? {};
      const result = await store.registerPlayer({
        email: typeof email === 'string' ? email : undefined,
        username: typeof username === 'string' ? username : undefined,
        playerId: typeof playerId === 'string' ? playerId : undefined,
        password: String(password ?? ''),
        confirmPassword: String(confirmPassword ?? ''),
        gender: gender as Gender | undefined,
        recoveryQuestion: typeof recoveryQuestion === 'string' ? recoveryQuestion : undefined,
        recoveryAnswer: typeof recoveryAnswer === 'string' ? recoveryAnswer : undefined,
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      setSessionCookie(req, res, result.sessionToken);
      res.status(201).json({ player: result.player, sessionToken: result.sessionToken });
    }),
  );

  app.post(
    '/api/auth/login',
    asyncRoute(async (req, res, store) => {
      const { email, username, playerId, password } = req.body ?? {};
      const result = await store.loginPlayer({
        email: typeof email === 'string' ? email : undefined,
        username: typeof username === 'string' ? username : undefined,
        playerId: typeof playerId === 'string' ? playerId : undefined,
        password: typeof password === 'string' ? password : '',
      });

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      setSessionCookie(req, res, result.sessionToken);
      res.json({ player: result.player, sessionToken: result.sessionToken });
    }),
  );

  app.post(
    '/api/auth/logout',
    asyncRoute(async (req, res, store) => {
      const { token, cookieToken } = await getAuthenticatedPlayer(req, store);
      await store.deleteSession(token);
      if (cookieToken && cookieToken !== token) {
        await store.deleteSession(cookieToken);
      }
      clearSessionCookie(req, res);
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/auth/recovery-question',
    asyncRoute(async (req, res, store) => {
      const username = String(req.query.username ?? '');
      const result = await store.getRecoveryQuestion(username);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ question: result.question });
    }),
  );

  app.post(
    '/api/auth/forgot-password',
    asyncRoute(async (req, res, store) => {
      const { username, recoveryAnswer, newPassword, confirmNewPassword } = req.body ?? {};
      const result = await store.resetPassword({
        username: String(username ?? ''),
        recoveryAnswer: String(recoveryAnswer ?? ''),
        newPassword: String(newPassword ?? ''),
        confirmNewPassword: String(confirmNewPassword ?? ''),
      });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  app.put(
    '/api/player/gender',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      if (!player) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const gender = req.body?.gender as Gender;
      const updated = await store.updatePlayerGender(player.playerId, gender);
      if (!updated) {
        res.status(400).json({ error: 'Invalid gender category.' });
        return;
      }
      res.json({ player: updated });
    }),
  );

  app.put(
    '/api/player/profile',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      if (!player) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const username = String(req.body?.username ?? '');
      const gender = req.body?.gender as Gender;
      const result = await store.updatePlayerProfile(player.playerId, { username, gender });
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ player: result.player });
    }),
  );

  app.put(
    '/api/player/customization',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      if (!player) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const gender = (req.body?.gender as Gender) || player.gender;
      const customization = req.body?.customization;
      const result = await store.updatePlayerCustomization(player.playerId, gender, customization);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({ player: result.player });
    }),
  );

  app.post(
    '/api/player/progress',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      if (!player) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const activityId = (req.body?.activityId ?? req.body?.action) as ActivityId;
      const result = await store.recordActivityProgress(player.playerId, activityId);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        player: result.player,
        leveledUp: result.leveledUp,
        newlyUnlocked: result.newlyUnlocked,
      });
    }),
  );

  app.post(
    '/api/player/kodama/hit',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      if (!player) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const kind: KodamaSpawnKind = req.body?.kind === 'crossing' ? 'crossing' : 'wall';
      const ghostKey = typeof req.body?.ghostKey === 'string' ? req.body.ghostKey : undefined;
      const result = await store.awardKodamaHit(player.playerId, kind, ghostKey);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        player: result.player,
        leveledUp: result.leveledUp,
        newlyUnlocked: result.newlyUnlocked,
        diamondAwarded: result.diamondAwarded,
        alreadyRewarded: result.alreadyRewarded,
      });
    }),
  );

  app.post(
    '/api/player/kodama/round',
    asyncRoute(async (req, res, store) => {
      const { player } = await getAuthenticatedPlayer(req, store);
      if (!player) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const round = Number(req.body?.round);
      const hits = Number(req.body?.hits);
      const result = await store.completeKodamaRound(player.playerId, round, hits);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        player: result.player,
        passed: result.passed,
        newlyCompleted: result.newlyCompleted,
        stage2JustUnlocked: result.stage2JustUnlocked,
      });
    }),
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Ensure API errors always return JSON rather than Express's default HTML error page
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api')) {
      next(err);
      return;
    }
    console.error('[Yokai Hunters API error]', err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Internal server error while processing request.';
    res.status(500).json({ error: message });
  });

  return app;
}
