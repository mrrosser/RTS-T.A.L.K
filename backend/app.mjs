import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { createIdempotencyStore } from './idempotency.mjs';
import { createCorrelationId, logEvent } from './logger.mjs';
import { createLobbyStore } from './store.mjs';
import {
  addBot,
  addModerationNote,
  addTimelineEvent,
  advanceRound,
  assignViolation,
  awardScore,
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
  setRole,
  setTrustedSources,
  startGame,
  startTurn,
  submitAudioDraft,
  updateQuestionBank,
  updateTimelineSectionSummary,
  useGreenIndicator,
  useLifeline,
} from './game-domain.mjs';

const playerRoleSchema = z.enum(['Conversationalist', 'Referee', 'Time Keeper']);
const flagTypeSchema = z.enum(['red', 'yellow']);
const lifelineTypeSchema = z.enum(['AudienceOpinion', 'TrustedSourcing', 'RefsChoice']);

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
});

const viewerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

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
  metadata: z
    .object({
      lifelineType: lifelineTypeSchema.optional(),
      shortcutKey: z.string().min(1).max(100).optional(),
      highlightId: z.string().min(1).max(100).optional(),
      audioDraftId: z.string().min(1).max(100).optional(),
      selectedSource: z.string().min(1).max(400).optional(),
    })
    .optional(),
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
  }),
});

const startTurnBodySchema = z.object({
  speakerId: z.string().min(1),
});

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
  reason: z.string().max(600).optional(),
});

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

const parseOrRespond = (schema, req, res) => {
  const parsed = schema.safeParse(req.body);
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

const idempotencyCacheKeyFromRequest = (req) => {
  if (req.method !== 'POST') return null;
  const key = req.get('x-idempotency-key');
  if (!key) return null;
  return `${req.method}:${req.originalUrl}:${key}`;
};

const applyLobbyUpdate = (store, code, mutator) => {
  try {
    const updatedLobby = store.updateLobby(code, mutator);
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

const sanitizeLobbyForRequestor = (lobby, requestorId) => {
  const cloned = structuredClone(lobby);
  const requestor = cloned.gameState.players.find((player) => player.id === requestorId);
  const isReferee = requestor?.role === 'Referee';

  for (const player of cloned.gameState.players) {
    if (!Array.isArray(player.questionBank)) continue;
    if (player.id === requestorId || isReferee) continue;
    player.questionBank = player.questionBank.map((question) => {
      if (question.revealed) return question;
      return { ...question, text: '[Hidden until asked]' };
    });
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
  const store = options.store ?? createLobbyStore();
  const idempotencyStore = options.idempotencyStore ?? createIdempotencyStore();
  const geminiApiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;
  const geminiClient = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
  const shouldServeStatic = options.serveStatic ?? true;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));

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
      res.set('Access-Control-Allow-Headers', 'Content-Type,x-correlation-id,x-idempotency-key,x-player-id');
      res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use((req, res, next) => {
    const correlationId = req.get('x-correlation-id') || createCorrelationId();
    req.correlationId = correlationId;
    req.requestorId = req.get('x-player-id') || null;
    res.set('x-correlation-id', correlationId);

    const startedAt = Date.now();
    res.on('finish', () => {
      logEvent('info', 'api.request', {
        correlationId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });

    next();
  });

  const sendLobbyResponse = (req, res, status, lobby) => {
    res.status(status).json(sanitizeLobbyForRequestor(lobby, req.requestorId));
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      backend: 'talk-api',
      geminiConfigured: Boolean(geminiClient),
      ts: new Date().toISOString(),
    });
  });

  app.get('/api/lobbies/public', route(async (req, res) => {
    const list = store.listPublicLobbies().map((lobby) => sanitizeLobbyForRequestor(lobby, req.requestorId));
    res.json(list);
  }));

  app.get('/api/lobbies/:code', route(async (req, res) => {
    const lobby = store.getLobby(req.params.code.toUpperCase());
    if (!lobby) {
      res.status(404).json({ error: 'Game not found.' });
      return;
    }
    sendLobbyResponse(req, res, 200, lobby);
  }));

  app.post('/api/lobbies', route(async (req, res) => {
    const payload = parseOrRespond(createLobbyBodySchema, req, res);
    if (!payload) return;

    const cacheKey = idempotencyCacheKeyFromRequest(req);
    if (cacheKey) {
      const cached = idempotencyStore.get(cacheKey);
      if (cached) {
        sendLobbyResponse(req, res, cached.status, cached.body);
        return;
      }
    }

    const code = createLobbyCode(store.getLobbyCodes());
    const lobby = createLobbyState({ code, settings: payload.settings, host: payload.host });
    const createdLobby = store.setLobby(lobby);
    const status = 201;
    if (cacheKey) {
      idempotencyStore.set(cacheKey, status, createdLobby);
    }
    sendLobbyResponse(req, res, status, createdLobby);
  }));

  app.post('/api/lobbies/:code/join-player', route(async (req, res) => {
    const payload = parseOrRespond(joinPlayerBodySchema, req, res);
    if (!payload) return;

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      joinPlayer(lobby, payload.player);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/join-viewer', route(async (req, res) => {
    const payload = parseOrRespond(joinViewerBodySchema, req, res);
    if (!payload) return;

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      joinViewer(lobby, payload.viewer);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/start', route(async (req, res) => {
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const cacheKey = idempotencyCacheKeyFromRequest(req);
    if (cacheKey) {
      const cached = idempotencyStore.get(cacheKey);
      if (cached) {
        sendLobbyResponse(req, res, cached.status, cached.body);
        return;
      }
    }

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      addTimelineEvent(lobby, payload.event);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (cacheKey) {
      idempotencyStore.set(cacheKey, 200, result.lobby);
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/violation', route(async (req, res) => {
    const payload = parseOrRespond(assignViolationBodySchema, req, res);
    if (!payload) return;

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const cacheKey = idempotencyCacheKeyFromRequest(req);
    if (cacheKey) {
      const cached = idempotencyStore.get(cacheKey);
      if (cached) {
        sendLobbyResponse(req, res, cached.status, cached.body);
        return;
      }
    }

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      sendMessage(lobby, payload.message);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (cacheKey) {
      idempotencyStore.set(cacheKey, 200, result.lobby);
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/turn/start', route(async (req, res) => {
    const payload = parseOrRespond(startTurnBodySchema, req, res);
    if (!payload) return;

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      startTurn(lobby, payload.speakerId);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/turn/end', route(async (req, res) => {
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      endTurn(lobby);
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

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      pauseTurn(lobby, payload.pause);
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
    const cacheKey = idempotencyCacheKeyFromRequest(req);
    if (cacheKey) {
      const cached = idempotencyStore.get(cacheKey);
      if (cached) {
        sendLobbyResponse(req, res, cached.status, cached.body);
        return;
      }
    }

    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      castVote(lobby, payload.eventId, payload.viewerId);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    if (cacheKey) {
      idempotencyStore.set(cacheKey, 200, result.lobby);
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/trusted-sources', route(async (req, res) => {
    const payload = parseOrRespond(trustedSourcesBodySchema, req, res);
    if (!payload) return;
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      setTrustedSources(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/question-bank', route(async (req, res) => {
    const payload = parseOrRespond(questionBankBodySchema, req, res);
    if (!payload) return;
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      updateQuestionBank(lobby, payload);
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      advanceRound(lobby, payload);
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      endGame(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
  }));

  app.post('/api/lobbies/:code/audio-draft', route(async (req, res) => {
    const payload = parseOrRespond(submitAudioDraftBodySchema, req, res);
    if (!payload) return;
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
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
    const result = applyLobbyUpdate(store, req.params.code.toUpperCase(), (lobby) => {
      reviewAudioDraft(lobby, payload);
    });
    if (!result.lobby) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    sendLobbyResponse(req, res, 200, result.lobby);
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
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
          next();
          return;
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
};
