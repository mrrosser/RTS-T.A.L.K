import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { createTalkRepository } from './repository.mjs';
import { createAuthResolver } from './auth.mjs';
import { createIcebreakerService, createMediaService, createUploadService } from './providers.mjs';
import { createCorrelationId, logEvent } from './logger.mjs';
import {
  addBot,
  addModerationNote,
  addTimelineEvent,
  advanceRound,
  assignViolation,
  awardScore,
  buildSessionSummary,
  castAudienceChallengeVote,
  castVote,
  createLobbyCode,
  createLobbyState,
  endGame,
  endTurn,
  highlightTimelineEvent,
  joinPlayer,
  joinViewer,
  pauseTurn,
  removePlayer,
  revealQuestion,
  reviewAudioDraft,
  sendMessage,
  setBackdropAsset,
  setRole,
  setTrustedSources,
  startGame,
  startTurn,
  submitAudienceChallenge,
  submitAudioDraft,
  setRefereeMuteState,
  updateMicState,
  updatePromptCards,
  updateQuestionBank,
  updateTimelineSectionSummary,
  useGreenIndicator,
  useLifeline,
} from './game-domain-v2.mjs';

const playerRoleSchema = z.enum(['Conversationalist', 'Referee', 'Time Keeper']);
const flagTypeSchema = z.enum(['red', 'yellow']);
const lifelineTypeSchema = z.enum(['AudienceOpinion', 'TrustedSourcing', 'RefsChoice']);
const promptCardKindSchema = z.enum(['question', 'statement']);
const authProviderSchema = z.enum(['guest', 'google.com', 'apple.com', 'phone', 'anonymous']);

const violationCountSchema = z.object({
  red: z.number().int().nonnegative(),
  yellow: z.number().int().nonnegative(),
  green: z.number().int().nonnegative(),
});

const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: playerRoleSchema.nullable(),
  violations: violationCountSchema,
}).passthrough();

const viewerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
}).passthrough();

const gameSettingsSchema = z.object({
  topic: z.string().min(1).max(200),
  totalRounds: z.number().int().min(1).max(10),
  turnDuration: z.number().int().min(15).max(300),
  isPublic: z.boolean(),
});

const timelineEventInputSchema = z.object({
  type: z.enum([
    'Topic',
    'Question',
    'Summary',
    'Answer',
    'FactCheck',
    'Violation',
    'RoundStart',
    'TurnStart',
    'TurnEnd',
    'GameEnd',
    'Lifeline',
    'ModerationNote',
    'Highlight',
    'ScoreAward',
    'AudioDraft',
    'AudioApproved',
    'AudioRejected',
    'Indicator',
  ]),
  text: z.string().min(1).max(4000),
  playerId: z.string().min(1),
  violation: z
    .object({
      type: flagTypeSchema,
      targetPlayerId: z.string().min(1),
    })
    .optional(),
  factCheckVotes: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const promptCardInputSchema = z.object({
  text: z.string().min(1).max(400),
  kind: promptCardKindSchema,
});

const createLobbyBodySchema = z.object({
  settings: gameSettingsSchema,
  host: playerSchema,
});

const joinPlayerBodySchema = z.object({
  player: playerSchema,
});

const joinViewerBodySchema = z.object({
  viewer: viewerSchema,
});

const setRoleBodySchema = z.object({
  playerId: z.string().min(1),
  role: playerRoleSchema.nullable(),
});

const addBotBodySchema = z.object({
  role: playerRoleSchema,
});

const removePlayerBodySchema = z.object({
  playerId: z.string().min(1),
});

const addTimelineBodySchema = z.object({
  event: timelineEventInputSchema,
});

const assignViolationBodySchema = z.object({
  violation: z.object({
    targetPlayerId: z.string().min(1),
    type: flagTypeSchema,
    reason: z.string().min(1).max(800),
    assignerId: z.string().min(1),
  }),
});

const sendMessageBodySchema = z.object({
  message: z.object({
    senderId: z.string().min(1),
    text: z.string().min(1).max(2000),
    recipientId: z.string().min(1).optional(),
    recipientLabel: z.string().min(1).max(120).optional(),
  }),
});

const startTurnBodySchema = z.object({
  speakerId: z.string().min(1),
});

const endTurnBodySchema = z.object({
  endedBy: z.string().min(1).optional(),
  reasonCodes: z.array(z.string().min(1).max(80)).max(6).optional(),
}).partial();

const pauseTurnBodySchema = z.object({
  pause: z.boolean(),
});

const castVoteBodySchema = z.object({
  eventId: z.string().min(1),
  viewerId: z.string().min(1),
});

const factCheckBodySchema = z.object({
  statement: z.string().min(1).max(2000),
});

const trustedSourcesBodySchema = z.object({
  playerId: z.string().min(1),
  sources: z.array(z.string().min(1).max(400)).min(3).max(12),
});

const questionBankBodySchema = z.object({
  playerId: z.string().min(1),
  questions: z.array(z.string().min(1).max(400)).min(1).max(10),
});

const promptCardsBodySchema = z.object({
  playerId: z.string().min(1),
  cards: z.array(promptCardInputSchema).min(1).max(10),
});

const revealQuestionBodySchema = z.object({
  playerId: z.string().min(1),
  questionId: z.string().min(1),
});

const useLifelineBodySchema = z.object({
  playerId: z.string().min(1),
  type: lifelineTypeSchema,
  selectedSource: z.string().min(1).max(400).optional(),
  details: z.string().max(1000).optional(),
});

const useGreenIndicatorBodySchema = z.object({
  playerId: z.string().min(1),
  reason: z.string().max(1000).optional(),
});

const micStateBodySchema = z.object({
  playerId: z.string().min(1),
  micLive: z.boolean(),
  videoEnabled: z.boolean().optional(),
});

const refereeMuteBodySchema = z.object({
  refereeId: z.string().min(1),
  targetPlayerId: z.string().min(1),
  muted: z.boolean(),
});

const moderationNoteBodySchema = z.object({
  refereeId: z.string().min(1),
  text: z.string().min(1).max(1000),
  shortcutKey: z.string().min(1).max(120).optional(),
});

const highlightBodySchema = z.object({
  timeKeeperId: z.string().min(1),
  eventId: z.string().min(1),
  label: z.string().min(1).max(200),
});

const sectionSummaryBodySchema = z.object({
  timeKeeperId: z.string().min(1),
  sectionId: z.string().min(1),
  summary: z.string().max(800),
});

const awardScoreBodySchema = z.object({
  playerId: z.string().min(1),
  points: z.number().int().min(1).max(20),
  reason: z.string().min(1).max(600),
  assignerId: z.string().min(1),
});

const advanceRoundBodySchema = z.object({
  timeKeeperId: z.string().min(1),
});

const endGameBodySchema = z.object({
  requestedBy: z.string().min(1).optional(),
  reason: z.string().max(600).optional(),
  reasonCodes: z.array(z.string().min(1).max(80)).max(6).optional(),
}).partial();

const submitAudioDraftBodySchema = z.object({
  playerId: z.string().min(1),
  transcript: z.string().min(1).max(4000),
  audioBase64: z.string().max(2_000_000).optional(),
});

const reviewAudioDraftBodySchema = z.object({
  reviewerId: z.string().min(1),
  draftId: z.string().min(1),
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().max(1000).optional(),
});

const bootstrapBodySchema = z.object({
  displayName: z.string().max(120).optional(),
  authProvider: authProviderSchema.optional(),
}).partial();

const mediaTokenBodySchema = z.object({
  lobbyCode: z.string().min(1),
  participantId: z.string().min(1),
  participantName: z.string().min(1),
  role: playerRoleSchema,
});

const backdropUploadBodySchema = z.object({
  lobbyCode: z.string().min(1),
  playerId: z.string().min(1),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(120),
});

const backdropAssetBodySchema = z.object({
  playerId: z.string().min(1),
  assetUrl: z.string().url(),
});

const icebreakerBodySchema = z.object({
  topic: z.string().min(1).max(200),
});

const transcriptAssistBodySchema = z.object({
  transcript: z.string().min(1).max(4000),
  mode: z.enum(['tighten']).default('tighten'),
});

const transcriptAssistResultSchema = z.object({
  transcript: z.string().min(1).max(4000),
  note: z.string().min(1).max(280),
});

const submitChallengeBodySchema = z.object({
  challengerId: z.string().min(1),
  actionId: z.string().min(1),
  note: z.string().max(400).optional(),
});

const castChallengeVoteBodySchema = z.object({
  challengeId: z.string().min(1),
  viewerId: z.string().min(1),
  vote: z.enum(['justified', 'unjust']),
});

const parseOrRespond = (schema, req, res) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request payload.',
      details: parsed.error.flatten(),
    });
    return null;
  }
  return parsed.data;
};

const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    logEvent('error', 'api.route.failed', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ error: 'Unexpected server error.' });
  }
};

const parseJsonModelResponse = (text) => {
  const trimmed = String(text ?? '').trim();
  const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/i, '');
  const withoutFences = withoutFenceStart.replace(/\s*```$/u, '');
  return JSON.parse(withoutFences);
};

const idempotencyCacheKeyFromRequest = (req) => {
  if (req.method !== 'POST') return null;
  const key = req.get('x-idempotency-key');
  if (!key) return null;
  return `${req.method}:${req.originalUrl}:${key}`;
};

const sanitizeLobbyForRequestor = (lobby, requestorId) => {
  const cloned = structuredClone(lobby);
  const requestor = cloned.gameState.players.find((player) => player.id === requestorId);
  const isReferee = requestor?.role === 'Referee';

  for (const player of cloned.gameState.players) {
    if (!Array.isArray(player.promptCards)) continue;
    if (player.id === requestorId || isReferee) continue;
    player.promptCards = player.promptCards.map((card) => {
      if (card.revealed) return card;
      return { ...card, text: '[Hidden until used]' };
    });
    player.questionBank = player.promptCards.map((card) => ({
      id: card.id,
      text: card.text,
      revealed: card.revealed,
      revealedAt: card.revealedAt,
      kind: card.kind,
      used: card.used,
      usedAt: card.usedAt,
    }));
  }

  if (Array.isArray(cloned.gameState.audioDrafts)) {
    cloned.gameState.audioDrafts = cloned.gameState.audioDrafts.map((draft) => {
      if (isReferee || draft.playerId === requestorId || draft.status !== 'pending') {
        return draft;
      }
      return {
        ...draft,
        transcript: '[Pending referee review]',
        audioBase64: null,
      };
    });
  }

  return cloned;
};

export const createApp = (options = {}) => {
  const app = express();
  const repositoryPromise = options.repository
    ? Promise.resolve(options.repository)
    : createTalkRepository({ backend: options.storageBackend ?? process.env.TALK_STORAGE_BACKEND });
  const authResolverPromise = options.authResolver
    ? Promise.resolve(options.authResolver)
    : createAuthResolver({ verifyIdToken: options.verifyIdToken, strict: options.authStrict });
  const geminiApiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;
  const geminiClient = options.geminiClient ?? (geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null);
  const shouldServeStatic = options.serveStatic ?? true;
  const icebreakerService = options.icebreakerService ?? createIcebreakerService(geminiClient);
  const mediaService = options.mediaService ?? createMediaService();
  const uploadService = options.uploadService ?? createUploadService();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  const corsAllowlist = new Set(
    (process.env.CORS_ALLOWLIST || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && corsAllowlist.has(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set(
        'Access-Control-Allow-Headers',
        [
          'Content-Type',
          'Authorization',
          'x-correlation-id',
          'x-idempotency-key',
          'x-player-id',
          'x-auth-user-id',
          'x-auth-provider',
          'x-auth-display-name',
          'x-guest-id',
        ].join(','),
      );
      res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(async (req, res, next) => {
    const correlationId = req.get('x-correlation-id') || createCorrelationId();
    req.correlationId = correlationId;
    req.requestorId = req.get('x-player-id') || req.query.playerId || null;
    res.set('x-correlation-id', correlationId);

    try {
      const resolveAuth = await authResolverPromise;
      req.authContext = await resolveAuth(req);
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Authentication failed.',
      });
      return;
    }

    const startedAt = Date.now();
    res.on('finish', () => {
      logEvent('info', 'api.request', {
        correlationId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
        authProvider: req.authContext?.authProvider ?? 'guest',
      });
    });

    next();
  });

  const sendLobbyResponse = (req, res, status, lobby) => {
    res.status(status).json(sanitizeLobbyForRequestor(lobby, req.requestorId));
  };

  const applyLobbyUpdate = async (req, code, mutator) => {
    const repository = await repositoryPromise;
    try {
      const updatedLobby = await repository.updateLobby(code, (draftLobby) => {
        mutator(draftLobby);
      });
      if (!updatedLobby) {
        return { status: 404, error: 'Game not found.' };
      }
      return { status: 200, lobby: updatedLobby };
    } catch (error) {
      return {
        status: 400,
        error: error instanceof Error ? error.message : 'Invalid lobby operation.',
      };
    }
  };

  const withIdempotency = async (req, handler) => {
    const repository = await repositoryPromise;
    const cacheKey = idempotencyCacheKeyFromRequest(req);
    if (!cacheKey) return handler(null, repository);
    const cached = await repository.getIdempotencyRecord(cacheKey);
    if (cached) return { cached: true, ...cached };
    const result = await handler(cacheKey, repository);
    if (result?.status && result?.body) {
      await repository.setIdempotencyRecord(cacheKey, result.status, result.body);
    }
    return result;
  };

  app.get('/api/health', route(async (_req, res) => {
    const repository = await repositoryPromise;
    res.json({
      ok: true,
      backend: 'talk-api',
      storageBackend: repository.kind,
      geminiConfigured: Boolean(geminiClient),
      liveKitConfigured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_WS_URL),
      firebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID),
      ts: new Date().toISOString(),
    });
  }));

  app.post('/api/me/bootstrap', route(async (req, res) => {
    const payload = parseOrRespond(bootstrapBodySchema, req, res);
    if (!payload) return;
    const repository = await repositoryPromise;
    const auth = req.authContext;
    const profile = await repository.upsertUserProfile(auth.userId, (draft) => {
      draft.userId = auth.userId;
      draft.displayName = payload.displayName || auth.displayName || draft.displayName || '';
      draft.authProvider = payload.authProvider || auth.authProvider || draft.authProvider || 'guest';
      draft.lastSeenAt = Date.now();
    });
    const sessions = await repository.listUserSessions(auth.userId);
    res.json({
      auth,
      profile,
      sessions,
    });
  }));

  app.get('/api/me/history', route(async (req, res) => {
    const repository = await repositoryPromise;
    const sessions = await repository.listUserSessions(req.authContext.userId);
    res.json({ sessions });
  }));

  app.post('/api/icebreakers', route(async (req, res) => {
    const payload = parseOrRespond(icebreakerBodySchema, req, res);
    if (!payload) return;
    const questions = await icebreakerService.generate(payload.topic);
    res.json({ questions });
  }));

  app.post('/api/media/token', route(async (req, res) => {
    const payload = parseOrRespond(mediaTokenBodySchema, req, res);
    if (!payload) return;
    const token = await mediaService.createRoomToken(payload);
    res.json(token);
  }));

  app.post('/api/uploads/backdrop', route(async (req, res) => {
    const payload = parseOrRespond(backdropUploadBodySchema, req, res);
    if (!payload) return;
    const upload = await uploadService.createBackdropUpload(payload);
    res.json(upload);
  }));

  app.get('/api/lobbies/public', route(async (req, res) => {
    const repository = await repositoryPromise;
    const list = (await repository.listPublicLobbies()).map((lobby) => sanitizeLobbyForRequestor(lobby, req.requestorId));
    res.json(list);
  }));

  app.get('/api/lobbies/:code', route(async (req, res) => {
    const repository = await repositoryPromise;
    const lobby = await repository.getLobby(req.params.code.toUpperCase());
    if (!lobby) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }
    sendLobbyResponse(req, res, 200, lobby);
  }));

  app.get('/api/lobbies/:code/stream', route(async (req, res) => {
    const repository = await repositoryPromise;
    const code = req.params.code.toUpperCase();
    const lobby = await repository.getLobby(code);
    if (!lobby) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const writeLobby = (nextLobby) => {
      res.write(`event: lobby\n`);
      res.write(`data: ${JSON.stringify(sanitizeLobbyForRequestor(nextLobby, req.requestorId))}\n\n`);
    };

    writeLobby(lobby);
    const unsubscribe = repository.subscribeToLobby(code, writeLobby);
    const keepAlive = setInterval(() => {
      res.write('event: ping\ndata: {}\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
      res.end();
    });
  }));

  app.post('/api/lobbies', route(async (req, res) => {
    const payload = parseOrRespond(createLobbyBodySchema, req, res);
    if (!payload) return;

    const result = await withIdempotency(req, async (_cacheKey, repository) => {
      const code = createLobbyCode(await repository.getLobbyCodes());
      const icebreakerQuestions = await icebreakerService.generate(payload.settings.topic);
      const host = {
        ...payload.host,
        authUserId: req.authContext.userId,
        authProvider: req.authContext.authProvider,
      };
      const lobby = createLobbyState({ code, settings: payload.settings, host, icebreakerQuestions });
      const createdLobby = await repository.setLobby(lobby);
      await repository.upsertUserProfile(req.authContext.userId, (draft) => {
        draft.userId = req.authContext.userId;
        draft.displayName = payload.host.name;
        draft.authProvider = req.authContext.authProvider;
        draft.lastLobbyCode = createdLobby.code;
        draft.lastRole = payload.host.role;
      });
      return { status: 201, body: createdLobby };
    });

    if (result.cached) {
      sendLobbyResponse(req, res, result.status, result.body);
      return;
    }
    sendLobbyResponse(req, res, result.status, result.body);
  }));

  app.post('/api/lobbies/:code/join-player', route(async (req, res) => {
    const payload = parseOrRespond(joinPlayerBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      joinPlayer(lobby, {
        ...payload.player,
        authUserId: req.authContext.userId,
        authProvider: req.authContext.authProvider,
      });
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const repository = await repositoryPromise;
    await repository.upsertUserProfile(req.authContext.userId, (draft) => {
      draft.displayName = payload.player.name;
      draft.authProvider = req.authContext.authProvider;
      draft.lastLobbyCode = result.lobby.code;
      draft.lastRole = payload.player.role;
    });
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/join-viewer', route(async (req, res) => {
    const payload = parseOrRespond(joinViewerBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      joinViewer(lobby, {
        ...payload.viewer,
        authUserId: req.authContext.userId,
        authProvider: req.authContext.authProvider,
      });
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/start', route(async (req, res) => {
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      startGame(lobby);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/role', route(async (req, res) => {
    const payload = parseOrRespond(setRoleBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      setRole(lobby, payload.playerId, payload.role);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/bot', route(async (req, res) => {
    const payload = parseOrRespond(addBotBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      addBot(lobby, payload.role);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/remove-player', route(async (req, res) => {
    const payload = parseOrRespond(removePlayerBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      removePlayer(lobby, payload.playerId);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/timeline', route(async (req, res) => {
    const payload = parseOrRespond(addTimelineBodySchema, req, res);
    if (!payload) return;
    const result = await withIdempotency(req, async () => {
      const update = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
        addTimelineEvent(lobby, payload.event);
      });
      if (!update.lobby) {
        return { status: update.status, body: { error: update.error } };
      }
      return { status: 200, body: update.lobby };
    });
    if (result.body?.error) {
      res.status(result.status).json({ error: result.body.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.body);
  }));

  app.post('/api/lobbies/:code/violation', route(async (req, res) => {
    const payload = parseOrRespond(assignViolationBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      assignViolation(lobby, payload.violation);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/message', route(async (req, res) => {
    const payload = parseOrRespond(sendMessageBodySchema, req, res);
    if (!payload) return;
    const result = await withIdempotency(req, async () => {
      const update = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
        sendMessage(lobby, payload.message);
      });
      if (!update.lobby) {
        return { status: update.status, body: { error: update.error } };
      }
      return { status: 200, body: update.lobby };
    });
    if (result.body?.error) {
      res.status(result.status).json({ error: result.body.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.body);
  }));

  app.post('/api/lobbies/:code/turn/start', route(async (req, res) => {
    const payload = parseOrRespond(startTurnBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      startTurn(lobby, payload.speakerId);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/turn/end', route(async (req, res) => {
    const payload = parseOrRespond(endTurnBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      endTurn(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/turn/pause', route(async (req, res) => {
    const payload = parseOrRespond(pauseTurnBodySchema, req, res);
    if (!payload) return;

    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      pauseTurn(lobby, payload.pause);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/mic-state', route(async (req, res) => {
    const payload = parseOrRespond(micStateBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      updateMicState(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/referee/mute', route(async (req, res) => {
    const payload = parseOrRespond(refereeMuteBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      setRefereeMuteState(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/vote', route(async (req, res) => {
    const payload = parseOrRespond(castVoteBodySchema, req, res);
    if (!payload) return;
    const result = await withIdempotency(req, async () => {
      const update = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
        castVote(lobby, payload.eventId, payload.viewerId);
      });
      if (!update.lobby) {
        return { status: update.status, body: { error: update.error } };
      }
      return { status: 200, body: update.lobby };
    });
    if (result.body?.error) {
      res.status(result.status).json({ error: result.body.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.body);
  }));

  app.post('/api/lobbies/:code/trusted-sources', route(async (req, res) => {
    const payload = parseOrRespond(trustedSourcesBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      setTrustedSources(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const repository = await repositoryPromise;
    const player = result.lobby.players.find((entry) => entry.id === payload.playerId);
    if (player?.authUserId) {
      await repository.upsertUserProfile(player.authUserId, (draft) => {
        draft.displayName = player.name;
        draft.authProvider = player.authProvider || draft.authProvider;
        draft.lastLobbyCode = result.lobby.code;
        draft.lastRole = player.role;
        draft.rememberedTrustedSources = player.trustedSources;
      });
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/question-bank', route(async (req, res) => {
    const payload = parseOrRespond(questionBankBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      updateQuestionBank(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/prompt-cards', route(async (req, res) => {
    const payload = parseOrRespond(promptCardsBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      updatePromptCards(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/question/reveal', route(async (req, res) => {
    const payload = parseOrRespond(revealQuestionBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      revealQuestion(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/lifeline', route(async (req, res) => {
    const payload = parseOrRespond(useLifelineBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      useLifeline(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/indicator/green', route(async (req, res) => {
    const payload = parseOrRespond(useGreenIndicatorBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      useGreenIndicator(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/moderation-note', route(async (req, res) => {
    const payload = parseOrRespond(moderationNoteBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      addModerationNote(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/timeline/highlight', route(async (req, res) => {
    const payload = parseOrRespond(highlightBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      highlightTimelineEvent(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/timeline/section-summary', route(async (req, res) => {
    const payload = parseOrRespond(sectionSummaryBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      updateTimelineSectionSummary(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/score/award', route(async (req, res) => {
    const payload = parseOrRespond(awardScoreBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      awardScore(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/round/next', route(async (req, res) => {
    const payload = parseOrRespond(advanceRoundBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      advanceRound(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/backdrop', route(async (req, res) => {
    const payload = parseOrRespond(backdropAssetBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      setBackdropAsset(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const repository = await repositoryPromise;
    const player = result.lobby.players.find((entry) => entry.id === payload.playerId);
    if (player?.authUserId) {
      await repository.upsertUserProfile(player.authUserId, (draft) => {
        draft.displayName = player.name;
        draft.authProvider = player.authProvider || draft.authProvider;
        draft.lastLobbyCode = result.lobby.code;
        draft.lastRole = player.role;
        draft.preferredBackdrop = player.backdrop;
      });
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/audio-draft', route(async (req, res) => {
    const payload = parseOrRespond(submitAudioDraftBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      submitAudioDraft(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/audio-draft/review', route(async (req, res) => {
    const payload = parseOrRespond(reviewAudioDraftBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      reviewAudioDraft(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (payload.status === 'approved') {
      const repository = await repositoryPromise;
      const approvedDraft = result.lobby.gameState.audioDrafts?.find((entry) => entry.id === payload.draftId);
      const owner = result.lobby.players.find((entry) => entry.id === approvedDraft?.playerId);
      if (owner?.authUserId) {
        await repository.upsertUserProfile(owner.authUserId, (draft) => {
          draft.displayName = owner.name;
          draft.authProvider = owner.authProvider || draft.authProvider;
          draft.lastLobbyCode = result.lobby.code;
          draft.lastRole = owner.role;
          draft.approvedPhrases = owner.draftLearning?.approvedPhrases ?? draft.approvedPhrases ?? [];
        });
      }
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/audience-challenge', route(async (req, res) => {
    const payload = parseOrRespond(submitChallengeBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      submitAudienceChallenge(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/audience-challenge/vote', route(async (req, res) => {
    const payload = parseOrRespond(castChallengeVoteBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      castAudienceChallengeVote(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/game/end', route(async (req, res) => {
    const payload = parseOrRespond(endGameBodySchema, req, res);
    if (!payload) return;
    const result = await applyLobbyUpdate(req, req.params.code.toUpperCase(), (lobby) => {
      endGame(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const repository = await repositoryPromise;
    for (const player of result.lobby.players) {
      if (!player.authUserId) continue;
      await repository.saveSessionSummary(player.authUserId, buildSessionSummary(result.lobby, payload.requestedBy ?? null));
      await repository.upsertUserProfile(player.authUserId, (draft) => {
        draft.displayName = player.name;
        draft.authProvider = player.authProvider || draft.authProvider;
        draft.lastLobbyCode = result.lobby.code;
        draft.lastRole = player.role;
        draft.rememberedTrustedSources = player.trustedSources;
        draft.preferredBackdrop = player.backdrop;
        draft.approvedPhrases = player.draftLearning?.approvedPhrases ?? draft.approvedPhrases ?? [];
      });
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/transcript-assist', route(async (req, res) => {
    const payload = parseOrRespond(transcriptAssistBodySchema, req, res);
    if (!payload) return;

    if (!geminiClient) {
      res.status(503).json({ error: 'Transcript assist is not configured on the server.' });
      return;
    }

    const response = await geminiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        responseMimeType: 'application/json',
      },
      contents: [
        'You clean up live speech-to-text transcripts for a debate game.',
        'Return strict JSON with keys "transcript" and "note".',
        'Rules:',
        '- Preserve the speaker meaning and original order.',
        '- Remove filler words, duplicate fragments, false starts, and obvious speech-to-text noise.',
        '- Fix only obvious capitalization and punctuation issues.',
        '- Do not add facts, sources, new claims, or stronger wording.',
        '- Keep the cleaned transcript close to the speaker\'s original voice.',
        '- Keep "note" to one short sentence describing what changed.',
        `Mode: ${payload.mode}`,
        `Transcript: """${payload.transcript.trim()}"""`,
      ].join('\n'),
    });

    let parsed;
    try {
      parsed = transcriptAssistResultSchema.safeParse(parseJsonModelResponse(response.text));
    } catch (error) {
      logEvent('warn', 'transcriptAssist.parse_failed', {
        correlationId: req.correlationId,
        error: error instanceof Error ? error.message : String(error),
        rawPreview: String(response.text ?? '').slice(0, 240),
      });
      res.status(502).json({ error: 'Transcript assist returned an invalid response.' });
      return;
    }
    if (!parsed.success) {
      logEvent('warn', 'transcriptAssist.invalid_response', {
        correlationId: req.correlationId,
        issues: parsed.error.issues.map((issue) => issue.message),
        rawPreview: String(response.text ?? '').slice(0, 240),
      });
      res.status(502).json({ error: 'Transcript assist returned an invalid response.' });
      return;
    }

    res.json(parsed.data);
  }));

  app.post('/api/fact-check', route(async (req, res) => {
    const payload = parseOrRespond(factCheckBodySchema, req, res);
    if (!payload) return;

    if (!geminiClient) {
      res.status(503).json({ error: 'Fact-checking is not configured on the server.' });
      return;
    }

    const response = await geminiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Please verify the following statement. Provide a concise confirmation or correction, and if possible, a source. Statement: "${payload.statement}"`,
    });
    res.json({ result: response.text });
  }));

  if (shouldServeStatic) {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) {
          next();
          return;
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
};
