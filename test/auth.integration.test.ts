// @vitest-environment node
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../backend/app.mjs';

describe('auth fallback hardening', () => {
  it('rejects unverified non-guest identity headers when strict auth is enabled', async () => {
    const app = createApp({ serveStatic: false, authStrict: true });

    const response = await request(app)
      .post('/api/me/bootstrap')
      .set('x-auth-user-id', 'google-user-1')
      .set('x-auth-provider', 'google.com')
      .send({ displayName: 'Google User', authProvider: 'google.com' })
      .expect(401);

    expect(response.body.error).toMatch(/verified firebase token is required/i);
  });

  it('keeps strict-mode guest bootstrap available without provider secrets', async () => {
    const app = createApp({ serveStatic: false, authStrict: true });

    const response = await request(app)
      .post('/api/me/bootstrap')
      .set('x-auth-user-id', 'guest-user-1')
      .set('x-auth-provider', 'guest')
      .set('x-guest-id', 'guest-user-1')
      .send({ displayName: 'Guest User', authProvider: 'guest' })
      .expect(200);

    expect(response.body.auth).toMatchObject({
      userId: 'guest-user-1',
      authProvider: 'guest',
      isGuest: true,
      tokenVerified: false,
    });
  });
});
