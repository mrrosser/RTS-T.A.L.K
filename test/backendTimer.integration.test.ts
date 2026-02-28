// @vitest-environment node
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../backend/app.mjs';

const host = {
  id: 'host-1',
  name: 'Host',
  role: 'Time Keeper',
  violations: { red: 0, yellow: 0, green: 0 },
} as const;

const settings = {
  topic: 'Testing timers',
  totalRounds: 3,
  turnDuration: 60,
  isPublic: false,
} as const;

describe('backend timer flow', () => {
  it('preserves remaining time on pause and resumes from that value', async () => {
    const app = createApp({ serveStatic: false });

    const created = await request(app)
      .post('/api/lobbies')
      .set('x-idempotency-key', 'create-lobby-1')
      .send({ settings, host })
      .expect(201);

    const code = created.body.code as string;
    await request(app).post(`/api/lobbies/${code}/turn/start`).send({ speakerId: host.id }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await request(app).post(`/api/lobbies/${code}/turn/pause`).send({ pause: true }).expect(200);

    const pausedState = await request(app).get(`/api/lobbies/${code}`).expect(200);
    expect(pausedState.body.gameState.isTimerRunning).toBe(false);
    expect(pausedState.body.gameState.turnRemainingSeconds).toBeLessThan(60);
    expect(pausedState.body.gameState.turnRemainingSeconds).toBeGreaterThan(58);

    const resumed = await request(app).post(`/api/lobbies/${code}/turn/pause`).send({ pause: false }).expect(200);
    expect(resumed.body.gameState.isTimerRunning).toBe(true);
    expect(resumed.body.gameState.turnStartTime).not.toBeNull();
  });
});
