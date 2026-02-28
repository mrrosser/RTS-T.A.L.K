// @vitest-environment node
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../backend/app.mjs';

const settings = {
  topic: 'Hard conversations',
  totalRounds: 3,
  turnDuration: 60,
  isPublic: false,
} as const;

const createPlayer = (id: string, name: string) => ({
  id,
  name,
  role: null,
  violations: { red: 0, yellow: 0, green: 0 },
});

describe('gameplay gap closure behaviors', () => {
  it('keeps private question banks hidden from non-owner until reveal', async () => {
    const app = createApp({ serveStatic: false });
    const host = createPlayer('p1', 'Con One');
    const guest = createPlayer('p2', 'Con Two');

    const created = await request(app)
      .post('/api/lobbies')
      .set('x-idempotency-key', 'qbank-create-1')
      .send({ settings, host })
      .expect(201);
    const code = created.body.code as string;

    await request(app).post(`/api/lobbies/${code}/join-player`).send({ player: guest }).expect(200);
    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: host.id, role: 'Conversationalist' }).expect(200);
    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: guest.id, role: 'Conversationalist' }).expect(200);

    await request(app)
      .post(`/api/lobbies/${code}/question-bank`)
      .set('x-player-id', host.id)
      .send({
        playerId: host.id,
        questions: ['What is your direct answer?', 'What evidence supports that?'],
      })
      .expect(200);

    const hostView = await request(app)
      .get(`/api/lobbies/${code}`)
      .set('x-player-id', host.id)
      .expect(200);
    const guestView = await request(app)
      .get(`/api/lobbies/${code}`)
      .set('x-player-id', guest.id)
      .expect(200);

    const hostQuestions = hostView.body.gameState.players.find((p: { id: string }) => p.id === host.id).questionBank;
    const guestQuestions = guestView.body.gameState.players.find((p: { id: string }) => p.id === host.id).questionBank;
    expect(hostQuestions[0].text).toBe('What is your direct answer?');
    expect(guestQuestions[0].text).not.toBe('What is your direct answer?');
  });

  it('enforces per-round lifeline limits and yellow-indicator usage', async () => {
    const app = createApp({ serveStatic: false });
    const host = createPlayer('con-1', 'Con One');

    const created = await request(app)
      .post('/api/lobbies')
      .set('x-idempotency-key', 'lifeline-create-1')
      .send({ settings, host })
      .expect(201);
    const code = created.body.code as string;

    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: host.id, role: 'Conversationalist' }).expect(200);

    await request(app)
      .post(`/api/lobbies/${code}/lifeline`)
      .send({ playerId: host.id, type: 'AudienceOpinion' })
      .expect(200);
    await request(app)
      .post(`/api/lobbies/${code}/lifeline`)
      .send({ playerId: host.id, type: 'TrustedSourcing', selectedSource: 'https://www.reuters.com' })
      .expect(200);
    await request(app)
      .post(`/api/lobbies/${code}/lifeline`)
      .send({ playerId: host.id, type: 'RefsChoice' })
      .expect(200);

    await request(app)
      .post(`/api/lobbies/${code}/lifeline`)
      .send({ playerId: host.id, type: 'AudienceOpinion' })
      .expect(400);
  });

  it('computes winner with reply-efficiency as a scoring factor', async () => {
    const app = createApp({ serveStatic: false });
    const con1 = createPlayer('con-1', 'Con One');
    const con2 = createPlayer('con-2', 'Con Two');

    const created = await request(app)
      .post('/api/lobbies')
      .set('x-idempotency-key', 'score-create-1')
      .send({ settings, host: con1 })
      .expect(201);
    const code = created.body.code as string;

    await request(app).post(`/api/lobbies/${code}/join-player`).send({ player: con2 }).expect(200);
    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: con1.id, role: 'Conversationalist' }).expect(200);
    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: con2.id, role: 'Conversationalist' }).expect(200);

    await request(app).post(`/api/lobbies/${code}/timeline`).send({ event: { type: 'Answer', text: 'Direct answer', playerId: con1.id } }).expect(200);
    await request(app).post(`/api/lobbies/${code}/timeline`).send({ event: { type: 'Answer', text: 'Reply 1', playerId: con2.id } }).expect(200);
    await request(app).post(`/api/lobbies/${code}/timeline`).send({ event: { type: 'Answer', text: 'Reply 2', playerId: con2.id } }).expect(200);
    await request(app).post(`/api/lobbies/${code}/timeline`).send({ event: { type: 'Answer', text: 'Reply 3', playerId: con2.id } }).expect(200);

    await request(app)
      .post(`/api/lobbies/${code}/score/award`)
      .send({ playerId: con1.id, points: 1, reason: 'Verified and acknowledged', assignerId: 'ref-1' })
      .expect(200);
    await request(app)
      .post(`/api/lobbies/${code}/score/award`)
      .send({ playerId: con2.id, points: 1, reason: 'Verified and acknowledged', assignerId: 'ref-1' })
      .expect(200);

    const ended = await request(app)
      .post(`/api/lobbies/${code}/game/end`)
      .send({ reason: 'Manual end for scoring test' })
      .expect(200);

    expect(ended.body.gameState.gamePhase).toBe('GAME_OVER');
    expect(ended.body.gameState.winner?.playerId).toBe(con1.id);
  });

  it('learns from approved audio drafts and provides hints on subsequent drafts', async () => {
    const app = createApp({ serveStatic: false });
    const con = createPlayer('con-1', 'Con One');
    const ref = createPlayer('ref-1', 'Ref');

    const created = await request(app)
      .post('/api/lobbies')
      .set('x-idempotency-key', 'audio-learn-create-1')
      .send({ settings, host: con })
      .expect(201);
    const code = created.body.code as string;

    await request(app).post(`/api/lobbies/${code}/join-player`).send({ player: ref }).expect(200);
    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: con.id, role: 'Conversationalist' }).expect(200);
    await request(app).post(`/api/lobbies/${code}/role`).send({ playerId: ref.id, role: 'Referee' }).expect(200);

    const firstDraft = await request(app)
      .post(`/api/lobbies/${code}/audio-draft`)
      .send({ playerId: con.id, transcript: 'I hear your point and this is my direct answer.' })
      .expect(200);

    const draftId = firstDraft.body.gameState.audioDrafts[0].id as string;
    await request(app)
      .post(`/api/lobbies/${code}/audio-draft/review`)
      .send({ reviewerId: ref.id, draftId, status: 'approved' })
      .expect(200);

    const secondDraft = await request(app)
      .post(`/api/lobbies/${code}/audio-draft`)
      .send({ playerId: con.id, transcript: 'My second direct answer is this one.' })
      .expect(200);

    const latestDraft = secondDraft.body.gameState.audioDrafts.at(-1);
    expect(latestDraft.learningHint).toBeTruthy();
  });
});
