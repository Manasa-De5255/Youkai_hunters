import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { YokaiDatabase } from './src/server/db';
import { ActivityId, Gender } from './src/types/game';

const PORT = Number(process.env.PORT || 3000);
const SESSION_COOKIE = 'yh_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 14,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

function clearSessionCookie(req: Request, res: Response): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    path: '/',
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
  });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  const db = new YokaiDatabase();

  const getAuthenticatedPlayer = (req: Request) => {
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : undefined;
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE];

    if (bearerToken) {
      const bearerPlayer = db.getPlayerBySession(bearerToken);
      if (bearerPlayer) {
        return { token: bearerToken, cookieToken, player: bearerPlayer };
      }
    }

    if (cookieToken) {
      const cookiePlayer = db.getPlayerBySession(cookieToken);
      if (cookiePlayer) {
        return { token: cookieToken, cookieToken, player: cookiePlayer };
      }
    }

    return { token: bearerToken || cookieToken, cookieToken, player: null };
  };

  app.get('/api/auth/me', (req, res) => {
    const { player } = getAuthenticatedPlayer(req);
    res.json({ player: player ?? null });
  });

  app.post('/api/auth/register', (req, res) => {
    const {
      username,
      playerId,
      password,
      confirmPassword,
      gender,
      recoveryQuestion,
      recoveryAnswer,
    } = req.body ?? {};
    const result = db.registerPlayer({
      username: String(username ?? ''),
      playerId: typeof playerId === 'string' ? playerId : undefined,
      password: String(password ?? ''),
      confirmPassword: String(confirmPassword ?? ''),
      gender: gender as Gender,
      recoveryQuestion: typeof recoveryQuestion === 'string' ? recoveryQuestion : undefined,
      recoveryAnswer: String(recoveryAnswer ?? ''),
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    setSessionCookie(req, res, result.sessionToken);
    res.status(201).json({ player: result.player, sessionToken: result.sessionToken });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, playerId, password } = req.body ?? {};
    const result = db.loginPlayer({
      username: String(username ?? ''),
      playerId: typeof playerId === 'string' ? playerId : undefined,
      password: typeof password === 'string' ? password : '',
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    setSessionCookie(req, res, result.sessionToken);
    res.json({ player: result.player, sessionToken: result.sessionToken });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { token, cookieToken } = getAuthenticatedPlayer(req);
    db.deleteSession(token);
    if (cookieToken && cookieToken !== token) {
      db.deleteSession(cookieToken);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/recovery-question', (req, res) => {
    const username = String(req.query.username ?? '');
    const result = db.getRecoveryQuestion(username);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ question: result.question });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { username, recoveryAnswer, newPassword, confirmNewPassword } = req.body ?? {};
    const result = db.resetPassword({
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
  });

  app.put('/api/player/gender', (req, res) => {
    const { player } = getAuthenticatedPlayer(req);
    if (!player) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const gender = req.body?.gender as Gender;
    const updated = db.updatePlayerGender(player.playerId, gender);
    if (!updated) {
      res.status(400).json({ error: 'Invalid gender category.' });
      return;
    }
    res.json({ player: updated });
  });

  app.put('/api/player/customization', (req, res) => {
    const { player } = getAuthenticatedPlayer(req);
    if (!player) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const gender = (req.body?.gender as Gender) || player.gender;
    const customization = req.body?.customization;
    const result = db.updatePlayerCustomization(player.playerId, gender, customization);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ player: result.player });
  });

  app.post('/api/player/progress', (req, res) => {
    const { player } = getAuthenticatedPlayer(req);
    if (!player) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const activityId = (req.body?.activityId ?? req.body?.action) as ActivityId;
    const result = db.recordActivityProgress(player.playerId, activityId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      player: result.player,
      leveledUp: result.leveledUp,
      newlyUnlocked: result.newlyUnlocked,
    });
  });

  app.post('/api/player/kodama/hit', (req, res) => {
    const { player } = getAuthenticatedPlayer(req);
    if (!player) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const result = db.awardKodamaHit(player.playerId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({
      player: result.player,
      leveledUp: result.leveledUp,
      newlyUnlocked: result.newlyUnlocked,
    });
  });

  app.post('/api/player/kodama/round', (req, res) => {
    const { player } = getAuthenticatedPlayer(req);
    if (!player) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const round = Number(req.body?.round);
    const hits = Number(req.body?.hits);
    const result = db.completeKodamaRound(player.playerId, round, hits);
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
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Yokai Hunters server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
