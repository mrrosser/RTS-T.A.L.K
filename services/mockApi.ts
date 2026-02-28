import type {
  ChatMessage,
  LifelineType,
  LobbyState,
  Player,
  PlayerRole,
  TimelineEvent,
  Viewer,
  GameSettings,
} from '../types';
import { createCorrelationId, logEvent } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

let requestPlayerId: string | null = null;

export const setRequestPlayerId = (playerId: string | null) => {
  requestPlayerId = playerId;
};

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const request = async <T>(path: string, init: RequestInit = {}, idempotent = false): Promise<T> => {
  const correlationId = createCorrelationId();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  headers.set('x-correlation-id', correlationId);
  if (requestPlayerId) headers.set('x-player-id', requestPlayerId);
  if (idempotent) headers.set('x-idempotency-key', createIdempotencyKey());

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      logEvent('warn', 'api.request.error_payload.parse_failed', {
        correlationId,
        path,
      });
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

export type { LobbyState };

export const createLobby = (settings: GameSettings, host: Player): Promise<LobbyState> =>
  request<LobbyState>(
    '/api/lobbies',
    {
      method: 'POST',
      body: JSON.stringify({ settings, host }),
    },
    true,
  );

export const joinLobby = (code: string, player: Player): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/join-player`, {
    method: 'POST',
    body: JSON.stringify({ player }),
  });

export const joinAsViewer = (code: string, viewer: Viewer): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/join-viewer`, {
    method: 'POST',
    body: JSON.stringify({ viewer }),
  });

export const getPublicLobbies = (): Promise<LobbyState[]> => request<LobbyState[]>('/api/lobbies/public');

export const getLobbyState = (code: string): Promise<LobbyState | null> =>
  request<LobbyState>(`/api/lobbies/${code}`)
    .then((lobby) => lobby)
    .catch((error) => {
      if (error instanceof Error && error.message === 'Game not found.') {
        return null;
      }
      throw error;
    });

export const startGame = (code: string): Promise<LobbyState> => request<LobbyState>(`/api/lobbies/${code}/start`, { method: 'POST' });

export const addBotToLobby = (code: string, role: PlayerRole): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/bot`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });

export const setPlayerRoleInLobby = (code: string, playerId: string, role: PlayerRole | null): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/role`, {
    method: 'POST',
    body: JSON.stringify({ playerId, role }),
  });

export const removePlayer = (code: string, playerId: string): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/remove-player`, {
    method: 'POST',
    body: JSON.stringify({ playerId }),
  });

export const addTimelineEvent = (code: string, event: Omit<TimelineEvent, 'id' | 'timestamp'>): Promise<LobbyState> =>
  request<LobbyState>(
    `/api/lobbies/${code}/timeline`,
    {
      method: 'POST',
      body: JSON.stringify({ event }),
    },
    true,
  );

export const assignViolation = (
  code: string,
  violation: { targetPlayerId: string; type: 'red' | 'yellow'; reason: string; assignerId: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/violation`, {
    method: 'POST',
    body: JSON.stringify({ violation }),
  });

export const sendMessage = (code: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<LobbyState> =>
  request<LobbyState>(
    `/api/lobbies/${code}/message`,
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    },
    true,
  );

export const startTurn = (code: string, speakerId: string): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/turn/start`, {
    method: 'POST',
    body: JSON.stringify({ speakerId }),
  });

export const endTurn = (code: string): Promise<LobbyState> => request<LobbyState>(`/api/lobbies/${code}/turn/end`, { method: 'POST' });

export const pauseTurn = (code: string, pause: boolean): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/turn/pause`, {
    method: 'POST',
    body: JSON.stringify({ pause }),
  });

export const castVote = (code: string, eventId: string, viewerId: string): Promise<LobbyState> =>
  request<LobbyState>(
    `/api/lobbies/${code}/vote`,
    {
      method: 'POST',
      body: JSON.stringify({ eventId, viewerId }),
    },
    true,
  );

export const updateTrustedSources = (code: string, playerId: string, sources: string[]): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/trusted-sources`, {
    method: 'POST',
    body: JSON.stringify({ playerId, sources }),
  });

export const updateQuestionBank = (code: string, playerId: string, questions: string[]): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/question-bank`, {
    method: 'POST',
    body: JSON.stringify({ playerId, questions }),
  });

export const revealQuestionFromBank = (code: string, playerId: string, questionId: string): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/question/reveal`, {
    method: 'POST',
    body: JSON.stringify({ playerId, questionId }),
  });

export const useLifeline = (
  code: string,
  payload: { playerId: string; type: LifelineType; selectedSource?: string; details?: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/lifeline`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const useGreenIndicator = (code: string, payload: { playerId: string; reason?: string }): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/indicator/green`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const addModerationNote = (
  code: string,
  payload: { refereeId: string; text: string; shortcutKey?: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/moderation-note`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const highlightTimelineEvent = (
  code: string,
  payload: { timeKeeperId: string; eventId: string; label: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/timeline/highlight`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateTimelineSectionSummary = (
  code: string,
  payload: { timeKeeperId: string; sectionId: string; summary: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/timeline/section-summary`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const awardScore = (
  code: string,
  payload: { playerId: string; points: number; reason: string; assignerId: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/score/award`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const advanceRound = (code: string, timeKeeperId: string): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/round/next`, {
    method: 'POST',
    body: JSON.stringify({ timeKeeperId }),
  });

export const endGame = (code: string, reason?: string): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/game/end`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

export const submitAudioDraft = (
  code: string,
  payload: { playerId: string; transcript: string; audioBase64?: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/audio-draft`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const reviewAudioDraft = (
  code: string,
  payload: { reviewerId: string; draftId: string; status: 'approved' | 'rejected'; reviewNote?: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/audio-draft/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
