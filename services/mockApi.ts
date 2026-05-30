import type {
  AudienceChallengeVote,
  AuthContext,
  BootstrapResponse,
  ChatMessage,
  LifelineType,
  LobbyState,
  MediaTokenResponse,
  Player,
  PlayerRole,
  PromptCard,
  SessionSummary,
  TimelineEvent,
  UploadResponse,
  Viewer,
  GameSettings,
} from '../types';
import { createCorrelationId, logEvent } from '../utils/logger';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type RequestAuthSession = {
  userId: string;
  provider: string;
  displayName?: string | null;
  guestId?: string | null;
  getIdToken?: () => Promise<string | null>;
};

let requestPlayerId: string | null = null;
let requestAuthSession: RequestAuthSession | null = null;

export const setRequestPlayerId = (playerId: string | null) => {
  requestPlayerId = playerId;
};

export const setRequestAuthSession = (session: RequestAuthSession | null) => {
  requestAuthSession = session;
};

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const applyAuthHeaders = async (headers: Headers) => {
  if (!requestAuthSession) return;
  headers.set('x-auth-user-id', requestAuthSession.userId);
  headers.set('x-auth-provider', requestAuthSession.provider);
  if (requestAuthSession.displayName) headers.set('x-auth-display-name', requestAuthSession.displayName);
  if (requestAuthSession.guestId) headers.set('x-guest-id', requestAuthSession.guestId);
  if (requestAuthSession.getIdToken) {
    const token = await requestAuthSession.getIdToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
};

const request = async <T>(path: string, init: RequestInit = {}, idempotent = false): Promise<T> => {
  const correlationId = createCorrelationId();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  headers.set('x-correlation-id', correlationId);
  if (requestPlayerId) headers.set('x-player-id', requestPlayerId);
  if (idempotent) headers.set('x-idempotency-key', createIdempotencyKey());
  await applyAuthHeaders(headers);

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

export const bootstrapProfile = (payload: { displayName?: string; authProvider?: AuthContext['authProvider'] } = {}) =>
  request<BootstrapResponse>('/api/me/bootstrap', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getSessionHistory = () => request<{ sessions: SessionSummary[] }>('/api/me/history');

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

export const subscribeToLobbyStream = (
  code: string,
  onLobby: (lobby: LobbyState) => void,
  onError?: (error: Event) => void,
) => {
  if (typeof EventSource === 'undefined') {
    return () => undefined;
  }

  const params = new URLSearchParams();
  if (requestPlayerId) params.set('playerId', requestPlayerId);
  const query = params.toString();
  const eventSource = new EventSource(`${API_BASE_URL}/api/lobbies/${code}/stream${query ? `?${query}` : ''}`);
  const onLobbyEvent = (event: MessageEvent) => {
    onLobby(JSON.parse(event.data) as LobbyState);
  };
  eventSource.addEventListener('lobby', onLobbyEvent);
  if (onError) {
    eventSource.onerror = onError;
  }
  return () => {
    eventSource.removeEventListener('lobby', onLobbyEvent);
    if (onError) {
      eventSource.onerror = null;
    }
    eventSource.close();
  };
};

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

export const sendMessage = (
  code: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>,
): Promise<LobbyState> =>
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

export const endTurn = (
  code: string,
  payload: { endedBy?: string; reasonCodes?: string[] } = {},
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/turn/end`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const pauseTurn = (code: string, pause: boolean): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/turn/pause`, {
    method: 'POST',
    body: JSON.stringify({ pause }),
  });

export const updateMicState = (
  code: string,
  payload: { playerId: string; micLive: boolean; videoEnabled?: boolean },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/mic-state`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const setRefereeMuteState = (
  code: string,
  payload: { refereeId: string; targetPlayerId: string; muted: boolean },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/referee/mute`, {
    method: 'POST',
    body: JSON.stringify(payload),
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

export const updatePromptCards = (code: string, playerId: string, cards: PromptCard[]): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/prompt-cards`, {
    method: 'POST',
    body: JSON.stringify({
      playerId,
      cards: cards.map((card) => ({ text: card.text, kind: card.kind })),
    }),
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

export const requestBackdropUpload = (payload: {
  lobbyCode: string;
  playerId: string;
  filename: string;
  contentType: string;
}) =>
  request<UploadResponse>('/api/uploads/backdrop', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const setBackdropInLobby = (code: string, payload: { playerId: string; assetUrl: string }): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/backdrop`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const createMediaToken = (payload: {
  lobbyCode: string;
  participantId: string;
  participantName: string;
  role: PlayerRole;
}) =>
  request<MediaTokenResponse>('/api/media/token', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getIcebreakerQuestions = (topic: string) =>
  request<{ questions: string[] }>('/api/icebreakers', {
    method: 'POST',
    body: JSON.stringify({ topic }),
  });

export const endGame = (
  code: string,
  payload: { requestedBy?: string; reason?: string; reasonCodes?: string[] } = {},
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/game/end`, {
    method: 'POST',
    body: JSON.stringify(payload),
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

export const submitAudienceChallenge = (
  code: string,
  payload: { challengerId: string; actionId: string; note?: string },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/audience-challenge`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const castAudienceChallengeVote = (
  code: string,
  payload: { challengeId: string; viewerId: string; vote: AudienceChallengeVote },
): Promise<LobbyState> =>
  request<LobbyState>(`/api/lobbies/${code}/audience-challenge/vote`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
