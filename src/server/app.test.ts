import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApiApp } from './app';
import { YokaiDatabase } from './db';

async function withTestServer(
  run: (baseUrl: string, db: YokaiDatabase) => Promise<void>,
): Promise<void> {
  const db = new YokaiDatabase(':memory:');
  const app = createApiApp({ store: db });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl, db);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
}

test('API app handles registration, login, recovery, CORS preflight, and malformed JSON errors cleanly', async () => {
  await withTestServer(async (baseUrl) => {
    // 1. Health endpoint reports storage mode
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { ok: boolean; storage: string };
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.storage, 'sqlite');

    // 2. CORS preflight OPTIONS works with credentials
    const preflightRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://yokai-hunters.vercel.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(preflightRes.status, 204);
    assert.equal(
      preflightRes.headers.get('access-control-allow-origin'),
      'https://yokai-hunters.vercel.app',
    );
    assert.equal(preflightRes.headers.get('access-control-allow-credentials'), 'true');

    // 3. Malformed JSON returns structured JSON 400 (never HTML)
    const badJsonRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"username":',
    });
    assert.equal(badJsonRes.status, 400);
    const badJsonBody = (await badJsonRes.json()) as { error?: string };
    assert.equal(typeof badJsonBody.error, 'string');

    // 4. Register account via /api/auth/register
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'VercelHunter',
        password: 'Password123',
        confirmPassword: 'Password123',
        gender: 'female',
        recoveryQuestion: 'Secret Shrine',
        recoveryAnswer: 'sakura',
      }),
    });
    assert.equal(regRes.status, 201);
    const regJson = (await regRes.json()) as {
      player: { playerId: string; username: string; gender: string };
      sessionToken: string;
    };
    assert.equal(regJson.player.username, 'VercelHunter');
    assert.equal(regJson.player.gender, 'female');
    assert.ok(regJson.sessionToken.length > 20);

    // 5. Session check works with Bearer token
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${regJson.sessionToken}` },
    });
    assert.equal(meRes.status, 200);
    const meJson = (await meRes.json()) as { player: { playerId: string } | null };
    assert.equal(meJson.player?.playerId, regJson.player.playerId);

    // 6. Login works with Username + Player ID
    const loginIdRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'VercelHunter',
        playerId: regJson.player.playerId,
      }),
    });
    assert.equal(loginIdRes.status, 200);
    const loginIdJson = (await loginIdRes.json()) as { player: { playerId: string } };
    assert.equal(loginIdJson.player.playerId, regJson.player.playerId);

    // 7. Account recovery question + password reset + new password login
    const recQRes = await fetch(
      `${baseUrl}/api/auth/recovery-question?username=${encodeURIComponent('VercelHunter')}`,
    );
    assert.equal(recQRes.status, 200);
    const recQJson = (await recQRes.json()) as { question: string };
    assert.equal(recQJson.question, 'Secret Shrine');

    const resetRes = await fetch(`${baseUrl}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'VercelHunter',
        recoveryAnswer: 'sakura',
        newPassword: 'NewPassword456',
        confirmNewPassword: 'NewPassword456',
      }),
    });
    assert.equal(resetRes.status, 200);

    const loginNewPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'VercelHunter',
        password: 'NewPassword456',
      }),
    });
    assert.equal(loginNewPassRes.status, 200);
  });
});
