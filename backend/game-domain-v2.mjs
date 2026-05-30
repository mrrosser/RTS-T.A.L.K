const TIMELINE_EVENT_LIMIT = 300;
const TIMELINE_SECTION_LIMIT = 120;
const TIMELINE_HIGHLIGHT_LIMIT = 120;
const MODERATION_NOTE_LIMIT = 40;
const AUDIO_DRAFT_LIMIT = 100;
const MAX_APPROVED_PHRASES = 30;
const MAX_PLAYERS = 5;
const MIN_CHALLENGE_VOTES = 3;
const CHALLENGE_PASS_RATIO = 0.6;
const CHALLENGE_WINDOW_MS = 45 * 1000;
const DEFAULT_CLOSING_QUOTE =
  'The point of this game is to have an ability to express your full point and also understand the personal + social responsibilities of empathy and accountability.';

const ROLES = ['Conversationalist', 'Referee', 'Time Keeper'];
const LIFELINE_TYPES = ['AudienceOpinion', 'TrustedSourcing', 'RefsChoice'];
const DEFAULT_TRUSTED_SOURCES = [
  'https://www.reuters.com',
  'https://apnews.com',
  'https://www.britannica.com',
];

const PROMPT_CARD_KIND = {
  question: 'question',
  statement: 'statement',
};

const createEntityId = (prefix) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const trimArray = (items, limit) => {
  if (items.length > limit) {
    items.splice(0, items.length - limit);
  }
};

const normalizeReasonCodes = (reasonCodes = []) =>
  reasonCodes
    .map((reason) => String(reason).trim())
    .filter(Boolean);

const assertRoleAvailable = (players, role, playerId = null) => {
  if (role === null) return;
  if (!ROLES.includes(role)) {
    throw new Error(`Unsupported role: ${role}`);
  }

  if (
    (role === 'Referee' && players.some((player) => player.role === 'Referee' && player.id !== playerId)) ||
    (role === 'Time Keeper' && players.some((player) => player.role === 'Time Keeper' && player.id !== playerId))
  ) {
    throw new Error(`The ${role} role is already taken.`);
  }
};

const createIndicators = (round, existingIndicators = null) => ({
  round,
  redRemaining: existingIndicators?.redRemaining ?? 3,
  yellowRemaining: 3,
  greenRemaining: 1,
  purpleRemaining: existingIndicators?.purpleRemaining ?? 3,
});

const createPresence = () => ({
  micLive: false,
  videoEnabled: false,
  activeSpeaker: false,
  mutedByReferee: false,
  mutedByActionId: null,
});

const createLifelines = (round) => ({
  round,
  AudienceOpinion: false,
  TrustedSourcing: false,
  RefsChoice: false,
});

const createScore = () => ({
  replies: 0,
  directAnswers: 0,
  verifiedPoints: 0,
  redFlagsReceived: 0,
  yellowFlagsReceived: 0,
  yellowUsed: 0,
  greenUsed: 0,
  purpleChallengesUsed: 0,
  lifelinesUsed: 0,
  efficiencyBonus: 0,
  concessionPenalty: 0,
  total: 0,
});

const normalizeSources = (sources) => {
  const unique = [];
  for (const source of sources) {
    const normalized = source.trim();
    if (!normalized) continue;
    if (!unique.includes(normalized)) unique.push(normalized);
  }
  return unique;
};

const createPromptCard = (text, kind = PROMPT_CARD_KIND.question, existing = null) => ({
  id: existing?.id ?? createEntityId('prompt'),
  text,
  kind,
  used: existing?.used ?? false,
  revealed: existing?.revealed ?? false,
  revealedAt: existing?.revealedAt ?? null,
  usedAt: existing?.usedAt ?? null,
});

const createQuestionBankAlias = (promptCards) =>
  promptCards.map((card) => ({
    id: card.id,
    text: card.text,
    revealed: card.revealed,
    revealedAt: card.revealedAt,
    kind: card.kind,
    used: card.used,
    usedAt: card.usedAt,
  }));

const ensureRoundResources = (player, round) => {
  if (!player.indicators || player.indicators.round !== round) {
    player.indicators = createIndicators(round, player.indicators);
  }
  if (!player.lifelines || player.lifelines.round !== round) {
    player.lifelines = createLifelines(round);
  }
};

const ensurePlayerState = (player, round = 1) => {
  if (!player.violations) {
    player.violations = { red: 0, yellow: 0, green: 0 };
  }
  if (!player.presence) {
    player.presence = createPresence();
  }
  if (typeof player.presence.mutedByReferee !== 'boolean') {
    player.presence.mutedByReferee = false;
  }
  if (typeof player.presence.mutedByActionId !== 'string' && player.presence.mutedByActionId !== null) {
    player.presence.mutedByActionId = null;
  }
  if (!Array.isArray(player.trustedSources) || player.trustedSources.length === 0) {
    player.trustedSources = [...DEFAULT_TRUSTED_SOURCES];
  }
  if (typeof player.selectedTrustedSource !== 'string' && player.selectedTrustedSource !== null) {
    player.selectedTrustedSource = null;
  }
  if (!Array.isArray(player.promptCards)) {
    player.promptCards = Array.isArray(player.questionBank)
      ? player.questionBank.map((question) =>
          createPromptCard(question.text, question.kind ?? PROMPT_CARD_KIND.question, question),
        )
      : [];
  }
  if (!Array.isArray(player.questionBank)) {
    player.questionBank = createQuestionBankAlias(player.promptCards);
  }
  if (!player.score) {
    player.score = createScore();
  }
  if (!player.draftLearning || !Array.isArray(player.draftLearning.approvedPhrases)) {
    player.draftLearning = { approvedPhrases: [] };
  }
  if (!player.backdrop) {
    player.backdrop = null;
  }
  ensureRoundResources(player, round);
  return player;
};

const syncPlayerDerivedFields = (player) => {
  player.questionBank = createQuestionBankAlias(player.promptCards ?? []);
  if (player.presence?.mutedByReferee) {
    player.presence.micLive = false;
  }
  if (player.indicators) {
    player.indicators.redRemaining = Math.max(0, 3 - (player.violations?.red ?? 0));
    player.indicators.purpleRemaining = Math.max(0, player.indicators.purpleRemaining ?? 3);
    player.indicators.greenRemaining = player.presence?.activeSpeaker && player.presence?.micLive ? 1 : 0;
  }
};

const pushTimelineEvent = (lobby, event) => {
  lobby.gameState.timeline.push({
    ...event,
    id: createEntityId('event'),
    timestamp: Date.now(),
  });
  trimArray(lobby.gameState.timeline, TIMELINE_EVENT_LIMIT);
};

const computeReplyEfficiencyBonus = (players) => {
  const conversationalists = players.filter((player) => player.role === 'Conversationalist');
  if (conversationalists.length === 0) return new Map();
  const minReplies = Math.min(...conversationalists.map((player) => player.score.replies));
  const bonuses = new Map();
  for (const player of conversationalists) {
    if (player.score.replies === minReplies) {
      bonuses.set(player.id, 5);
    } else if (player.score.replies === minReplies + 1) {
      bonuses.set(player.id, 2);
    } else {
      bonuses.set(player.id, 0);
    }
  }
  return bonuses;
};

const recomputeScores = (lobby) => {
  const bonuses = computeReplyEfficiencyBonus(lobby.players);
  for (const player of lobby.players) {
    ensurePlayerState(player, lobby.gameState.currentRound);
    player.score.efficiencyBonus = bonuses.get(player.id) ?? 0;
    player.score.total =
      player.score.verifiedPoints * 10 +
      player.score.directAnswers * 2 -
      player.score.redFlagsReceived * 8 -
      player.score.yellowFlagsReceived * 3 -
      player.score.replies -
      player.score.lifelinesUsed -
      player.score.concessionPenalty +
      player.score.efficiencyBonus;
    syncPlayerDerivedFields(player);
  }
  lobby.gameState.players = lobby.players;
};

const determineWinner = (lobby) => {
  const candidates = lobby.players.filter((player) => player.role === 'Conversationalist');
  const rankedCandidates = (candidates.length > 0 ? candidates : lobby.players).slice().sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (a.score.redFlagsReceived !== b.score.redFlagsReceived) {
      return a.score.redFlagsReceived - b.score.redFlagsReceived;
    }
    if (a.score.replies !== b.score.replies) {
      return a.score.replies - b.score.replies;
    }
    return a.name.localeCompare(b.name);
  });

  const winner = rankedCandidates[0];
  if (!winner) {
    lobby.gameState.winner = null;
    return;
  }
  lobby.gameState.winner = {
    playerId: winner.id,
    playerName: winner.name,
    score: winner.score.total,
    reason: 'Winner selected from verified points, penalties, and reply efficiency.',
  };
};

const setActiveSpeakerState = (lobby, speakerId, micLive = false) => {
  for (const player of lobby.players) {
    ensurePlayerState(player, lobby.gameState.currentRound);
    player.presence.activeSpeaker = player.id === speakerId;
    player.presence.micLive =
      player.id === speakerId ? Boolean(micLive && !player.presence.mutedByReferee) : false;
    player.indicators.greenRemaining = player.id === speakerId && micLive ? 1 : 0;
  }
};

const resetRoundResources = (lobby) => {
  for (const player of lobby.players) {
    ensurePlayerState(player, lobby.gameState.currentRound);
    if (player.role === 'Conversationalist') {
      player.indicators = createIndicators(lobby.gameState.currentRound, player.indicators);
      player.lifelines = createLifelines(lobby.gameState.currentRound);
    }
    player.presence.activeSpeaker = false;
    player.presence.micLive = false;
    player.indicators.greenRemaining = 0;
    syncPlayerDerivedFields(player);
  }
};

const assertConversationalist = (player) => {
  if (!player || player.role !== 'Conversationalist') {
    throw new Error('Only a Conversationalist can perform this action.');
  }
};

const assertReferee = (player) => {
  if (!player || player.role !== 'Referee') {
    throw new Error('Only the Referee can perform this action.');
  }
};

const assertTimeKeeper = (player) => {
  if (!player || player.role !== 'Time Keeper') {
    throw new Error('Only the Time Keeper can perform this action.');
  }
};

const assertViewer = (lobby, viewerId) => {
  const viewer = lobby.viewers.find((entry) => entry.id === viewerId);
  if (!viewer) {
    throw new Error('Only a viewer can perform this action.');
  }
  return viewer;
};

const buildLearningHint = (player) => {
  const approved = player.draftLearning.approvedPhrases.slice(-5);
  if (approved.length === 0) return null;
  const averageWords = Math.round(
    approved.reduce((sum, phrase) => sum + phrase.split(/\s+/).filter(Boolean).length, 0) / approved.length,
  );
  return `Recent approved drafts average ${averageWords} words. Keep this draft direct and concise.`;
};

const recordRefereeAction = (lobby, action) => {
  const refereeAction = {
    id: createEntityId('ref-action'),
    createdAt: Date.now(),
    reversedAt: null,
    reversedByChallengeId: null,
    reversible: true,
    ...action,
  };
  lobby.gameState.refereeActions.push(refereeAction);
  trimArray(lobby.gameState.refereeActions, 120);
  return refereeAction;
};

const reverseRefereeAction = (lobby, action, challengeId) => {
  if (!action || action.reversedAt) return false;
  if (action.type === 'violation') {
    const targetPlayer = lobby.players.find((player) => player.id === action.payload.targetPlayerId);
    if (!targetPlayer) return false;
    const violationType = action.payload.type;
    targetPlayer.violations[violationType] = Math.max(0, targetPlayer.violations[violationType] - 1);
    if (violationType === 'red') {
      targetPlayer.score.redFlagsReceived = Math.max(0, targetPlayer.score.redFlagsReceived - 1);
    } else {
      targetPlayer.score.yellowFlagsReceived = Math.max(0, targetPlayer.score.yellowFlagsReceived - 1);
    }
    recomputeScores(lobby);
  } else if (action.type === 'moderation-note') {
    const note = lobby.gameState.moderationNotes.find((entry) => entry.id === action.payload.noteId);
    if (note) {
      note.hidden = true;
    }
  } else if (action.type === 'mute') {
    const targetPlayer = lobby.players.find((player) => player.id === action.payload.targetPlayerId);
    if (!targetPlayer) return false;
    ensurePlayerState(targetPlayer, lobby.gameState.currentRound);
    const restoredMuted = Boolean(action.payload.previousMuted);
    targetPlayer.presence.mutedByReferee = restoredMuted;
    targetPlayer.presence.mutedByActionId = restoredMuted ? action.id : null;
    targetPlayer.presence.micLive = Boolean(
      action.payload.previousMicLive && targetPlayer.presence.activeSpeaker && !restoredMuted,
    );
    syncPlayerDerivedFields(targetPlayer);
  } else {
    return false;
  }

  action.reversedAt = Date.now();
  action.reversedByChallengeId = challengeId;
  pushTimelineEvent(lobby, {
    type: 'ModerationNote',
    text: `Audience review overturned referee action ${action.id}.`,
    playerId: 'system',
  });
  return true;
};

const maybeResolveChallenge = (lobby, challenge) => {
  if (challenge.status !== 'open') return challenge;
  const voteEntries = Object.values(challenge.votes);
  if (voteEntries.length < MIN_CHALLENGE_VOTES) return challenge;

  const unjustVotes = voteEntries.filter((vote) => vote === 'unjust').length;
  const ratio = unjustVotes / voteEntries.length;
  if (ratio >= CHALLENGE_PASS_RATIO) {
    const action = lobby.gameState.refereeActions.find((entry) => entry.id === challenge.actionId);
    reverseRefereeAction(lobby, action, challenge.id);
    challenge.status = 'overturned';
    challenge.resolvedAt = Date.now();
  } else {
    challenge.status = 'upheld';
    challenge.resolvedAt = Date.now();
  }
  return challenge;
};

export const createLobbyCode = (existingCodes) => {
  let code = '';
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (existingCodes.has(code));
  return code;
};

export const createLobbyState = ({ code, settings, host, icebreakerQuestions = [] }) => {
  const now = Date.now();
  const normalizedHost = ensurePlayerState({ ...host }, 1);
  return {
    code,
    settings,
    players: [normalizedHost],
    viewers: [],
    gameState: {
      players: [normalizedHost],
      viewers: [],
      gameSettings: settings,
      timeline: [
        {
          id: createEntityId('event'),
          type: 'Topic',
          text: `The topic is: ${settings.topic}`,
          playerId: 'system',
          timestamp: now,
        },
      ],
      currentRound: 1,
      activeTopic: settings.topic,
      activeQuestion: null,
      gamePhase: 'ROUND_START',
      speakerId: null,
      chatMessages: [],
      turnStartTime: null,
      isTimerRunning: false,
      turnRemainingSeconds: null,
      timelineSections: [],
      timelineHighlights: [],
      moderationNotes: [],
      audioDrafts: [],
      audienceChallenges: [],
      refereeActions: [],
      icebreakerQuestions,
      winner: null,
      closingQuote: DEFAULT_CLOSING_QUOTE,
      activeSection: null,
    },
    gameStarted: false,
    createdAt: now,
    updatedAt: now,
  };
};

export const buildSessionSummary = (lobby, endedBy = null) => ({
  sessionId: `session-${lobby.code}-${lobby.createdAt}`,
  lobbyCode: lobby.code,
  topic: lobby.settings.topic,
  winner: lobby.gameState.winner,
  endedAt: Date.now(),
  endedBy,
  currentRound: lobby.gameState.currentRound,
  playerSnapshots: lobby.players.map((player) => ({
    playerId: player.id,
    name: player.name,
    role: player.role,
    score: player.score.total,
    trustedSources: player.trustedSources,
    backdrop: player.backdrop,
  })),
});

export const joinPlayer = (lobby, player) => {
  if (lobby.gameStarted) throw new Error('This game has already started.');
  if (lobby.players.length >= MAX_PLAYERS) throw new Error('This lobby is already full.');
  if (lobby.players.some((existingPlayer) => existingPlayer.id === player.id)) return;
  const joined = ensurePlayerState({ ...player }, lobby.gameState.currentRound);
  syncPlayerDerivedFields(joined);
  lobby.players.push(joined);
  lobby.gameState.players = lobby.players;
};

export const joinViewer = (lobby, viewer) => {
  if (!lobby.viewers.some((existingViewer) => existingViewer.id === viewer.id)) {
    lobby.viewers.push(viewer);
    lobby.gameState.viewers = lobby.viewers;
  }
};

export const startGame = (lobby) => {
  lobby.gameStarted = true;
  lobby.gameState.gamePhase = 'CONVERSATION';
  resetRoundResources(lobby);
  pushTimelineEvent(lobby, {
    type: 'RoundStart',
    text: 'Round 1 has begun!',
    playerId: 'system',
  });
};

export const addBot = (lobby, role) => {
  if (lobby.players.length >= MAX_PLAYERS) throw new Error('Lobby is full.');
  assertRoleAvailable(lobby.players, role);

  const bot = ensurePlayerState(
    {
      id: createEntityId('player-bot'),
      name: `Bot ${lobby.players.length + 1}`,
      role,
      violations: { red: 0, yellow: 0, green: 0 },
    },
    lobby.gameState.currentRound,
  );
  syncPlayerDerivedFields(bot);
  lobby.players.push(bot);
  lobby.gameState.players = lobby.players;
};

export const setRole = (lobby, playerId, role) => {
  assertRoleAvailable(lobby.players, role, playerId);
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === playerId);
  if (!player) throw new Error('Player not found.');
  player.role = role;
  ensurePlayerState(player, lobby.gameState.currentRound);
  syncPlayerDerivedFields(player);
  lobby.gameState.players = lobby.players;
};

export const removePlayer = (lobby, playerId) => {
  const playerIndex = lobby.players.findIndex((player) => player.id === playerId);
  if (playerIndex < 0) throw new Error('Player not found to remove.');
  lobby.players.splice(playerIndex, 1);
  lobby.viewers = lobby.viewers.filter((viewer) => viewer.id !== playerId);
  if (lobby.gameState.speakerId === playerId) {
    lobby.gameState.speakerId = null;
    lobby.gameState.turnStartTime = null;
    lobby.gameState.turnRemainingSeconds = null;
    lobby.gameState.isTimerRunning = false;
    lobby.gameState.activeSection = null;
    setActiveSpeakerState(lobby, null);
  }
  recomputeScores(lobby);
  lobby.gameState.players = lobby.players;
  lobby.gameState.viewers = lobby.viewers;
};

export const addTimelineEvent = (lobby, event) => {
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === event.playerId);
  if (event.type === 'Question') {
    lobby.gameState.activeQuestion = event.text;
  }
  if (player && (event.type === 'Answer' || event.type === 'Question')) {
    ensurePlayerState(player, lobby.gameState.currentRound);
    player.score.replies += 1;
    if (event.type === 'Answer') {
      player.score.directAnswers += 1;
    }
    recomputeScores(lobby);
  }

  pushTimelineEvent(lobby, event);
};

export const assignViolation = (lobby, violation) => {
  const assigner = lobby.gameState.players.find((player) => player.id === violation.assignerId);
  assertReferee(assigner);
  const targetPlayer = lobby.gameState.players.find((player) => player.id === violation.targetPlayerId);
  if (!targetPlayer) throw new Error('Player to violate not found');

  ensurePlayerState(targetPlayer, lobby.gameState.currentRound);
  targetPlayer.violations[violation.type] += 1;
  if (violation.type === 'red') {
    targetPlayer.score.redFlagsReceived += 1;
    targetPlayer.indicators.redRemaining = Math.max(0, targetPlayer.indicators.redRemaining - 1);
  } else {
    targetPlayer.score.yellowFlagsReceived += 1;
  }

  recomputeScores(lobby);

  const action = recordRefereeAction(lobby, {
    type: 'violation',
    refereeId: violation.assignerId,
    payload: {
      targetPlayerId: violation.targetPlayerId,
      type: violation.type,
      reason: violation.reason,
    },
  });

  pushTimelineEvent(lobby, {
    type: 'Violation',
    text: `Reason: ${violation.reason}`,
    playerId: violation.assignerId,
    violation: { type: violation.type, targetPlayerId: violation.targetPlayerId },
    metadata: { refereeActionId: action.id },
  });
  lobby.players = lobby.gameState.players;
};

export const sendMessage = (lobby, message) => {
  lobby.gameState.chatMessages.push({
    ...message,
    id: createEntityId('msg'),
    timestamp: Date.now(),
  });
};

export const startTurn = (lobby, speakerId) => {
  const speaker = lobby.players.find((player) => player.id === speakerId);
  if (!speaker) throw new Error('Selected speaker was not found.');
  const duration = lobby.gameState.gameSettings.turnDuration;
  lobby.gameState.turnRemainingSeconds = duration;
  lobby.gameState.isTimerRunning = true;
  lobby.gameState.turnStartTime = Date.now();
  lobby.gameState.speakerId = speakerId;
  lobby.gameState.activeSection = {
    id: createEntityId('section'),
    speakerId,
    startTime: Date.now(),
  };
  setActiveSpeakerState(lobby, speakerId, false);

  pushTimelineEvent(lobby, {
    type: 'TurnStart',
    text: `${speaker.name} has started their turn.`,
    playerId: 'system',
  });
};

export const endTurn = (lobby, payload = {}) => {
  if (lobby.gameState.activeSection) {
    const endTime = Date.now();
    const section = {
      id: lobby.gameState.activeSection.id,
      speakerId: lobby.gameState.activeSection.speakerId,
      startTime: lobby.gameState.activeSection.startTime,
      endTime,
      durationSeconds: Math.max(0, (endTime - lobby.gameState.activeSection.startTime) / 1000),
      summary: null,
      endReasons: normalizeReasonCodes(payload.reasonCodes),
    };
    lobby.gameState.timelineSections.push(section);
    trimArray(lobby.gameState.timelineSections, TIMELINE_SECTION_LIMIT);
  }

  lobby.gameState.isTimerRunning = false;
  lobby.gameState.turnStartTime = null;
  lobby.gameState.turnRemainingSeconds = null;
  lobby.gameState.speakerId = null;
  lobby.gameState.activeSection = null;
  setActiveSpeakerState(lobby, null);

  const reasons = normalizeReasonCodes(payload.reasonCodes);
  const endingPlayer = payload.endedBy ? lobby.players.find((player) => player.id === payload.endedBy) : null;
  if (endingPlayer && reasons.includes('agree_to_disagree')) {
    endingPlayer.score.concessionPenalty += 2;
    recomputeScores(lobby);
  }

  const reasonText = reasons.length > 0 ? ` Reasons: ${reasons.join(', ')}.` : '';
  pushTimelineEvent(lobby, {
    type: 'TurnEnd',
    text: `The active turn has ended.${reasonText}`.trim(),
    playerId: endingPlayer?.id || 'system',
  });
};

export const pauseTurn = (lobby, pause) => {
  const baseRemaining = lobby.gameState.turnRemainingSeconds ?? lobby.gameState.gameSettings.turnDuration;
  if (pause) {
    if (!lobby.gameState.isTimerRunning || lobby.gameState.turnStartTime === null) return;
    const elapsedSeconds = (Date.now() - lobby.gameState.turnStartTime) / 1000;
    lobby.gameState.turnRemainingSeconds = Math.max(0, baseRemaining - elapsedSeconds);
    lobby.gameState.isTimerRunning = false;
    lobby.gameState.turnStartTime = null;
    return;
  }

  if (lobby.gameState.isTimerRunning || baseRemaining <= 0) return;
  lobby.gameState.turnRemainingSeconds = baseRemaining;
  lobby.gameState.isTimerRunning = true;
  lobby.gameState.turnStartTime = Date.now();
};

export const updateMicState = (lobby, payload) => {
  const player = lobby.players.find((entry) => entry.id === payload.playerId);
  if (!player) throw new Error('Player not found.');
  ensurePlayerState(player, lobby.gameState.currentRound);
  if (payload.micLive && player.presence.mutedByReferee) {
    throw new Error('Referee has muted this microphone.');
  }
  player.presence.micLive = Boolean(payload.micLive);
  player.presence.videoEnabled = Boolean(payload.videoEnabled ?? player.presence.videoEnabled);
  player.indicators.greenRemaining = player.presence.activeSpeaker && player.presence.micLive ? 1 : 0;
};

export const setRefereeMuteState = (lobby, payload) => {
  const referee = lobby.players.find((player) => player.id === payload.refereeId);
  assertReferee(referee);
  const targetPlayer = lobby.players.find((player) => player.id === payload.targetPlayerId);
  assertConversationalist(targetPlayer);
  ensurePlayerState(targetPlayer, lobby.gameState.currentRound);

  const nextMuted = Boolean(payload.muted);
  const previousMuted = Boolean(targetPlayer.presence.mutedByReferee);
  const previousMicLive = Boolean(targetPlayer.presence.micLive);
  if (previousMuted === nextMuted) {
    return;
  }

  targetPlayer.presence.mutedByReferee = nextMuted;
  targetPlayer.presence.mutedByActionId = null;
  if (nextMuted) {
    targetPlayer.presence.micLive = false;
  }
  syncPlayerDerivedFields(targetPlayer);

  const action = recordRefereeAction(lobby, {
    type: 'mute',
    refereeId: payload.refereeId,
    payload: {
      targetPlayerId: payload.targetPlayerId,
      muted: nextMuted,
      previousMuted,
      previousMicLive,
    },
  });

  targetPlayer.presence.mutedByActionId = nextMuted ? action.id : null;
  pushTimelineEvent(lobby, {
    type: 'ModerationNote',
    text: `${referee.name} ${nextMuted ? 'muted' : 'restored'} ${targetPlayer.name}'s microphone.`,
    playerId: payload.refereeId,
    metadata: {
      refereeActionId: action.id,
      muteState: nextMuted ? 'muted' : 'restored',
      targetPlayerId: payload.targetPlayerId,
    },
  });
};

export const castVote = (lobby, eventId, viewerId) => {
  assertViewer(lobby, viewerId);
  const event = lobby.gameState.timeline.find((timelineEvent) => timelineEvent.id === eventId);
  if (!event) throw new Error('Timeline event not found.');

  if (!event.factCheckVotes) event.factCheckVotes = [];
  if (!event.factCheckVotes.includes(viewerId)) {
    event.factCheckVotes.push(viewerId);
  }
};

export const setTrustedSources = (lobby, payload) => {
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === payload.playerId);
  if (!player) throw new Error('Player not found.');
  const trustedSources = normalizeSources(payload.sources);
  if (trustedSources.length < 3) {
    throw new Error('At least three trusted sources are required.');
  }
  player.trustedSources = trustedSources;
  if (player.selectedTrustedSource && !trustedSources.includes(player.selectedTrustedSource)) {
    player.selectedTrustedSource = null;
  }
  lobby.gameState.players = lobby.players;
};

export const updatePromptCards = (lobby, payload) => {
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === payload.playerId);
  assertConversationalist(player);

  const cards = payload.cards
    .map((card) => ({
      text: card.text.trim(),
      kind: card.kind === PROMPT_CARD_KIND.statement ? PROMPT_CARD_KIND.statement : PROMPT_CARD_KIND.question,
    }))
    .filter((card) => card.text.length > 0);
  if (cards.length < 1) {
    throw new Error('At least one prompt card is required.');
  }
  if (player.promptCards.length > 0 && player.promptCards.length !== cards.length) {
    throw new Error('You can edit prompt text, but you cannot change the number of prompt cards.');
  }

  if (player.promptCards.length === 0) {
    player.promptCards = cards.map((card) => createPromptCard(card.text, card.kind));
  } else {
    player.promptCards = cards.map((card, index) => createPromptCard(card.text, card.kind, player.promptCards[index]));
  }
  syncPlayerDerivedFields(player);
};

export const updateQuestionBank = (lobby, payload) => {
  const cards = payload.cards ?? payload.questions.map((question) => ({ text: question, kind: PROMPT_CARD_KIND.question }));
  updatePromptCards(lobby, {
    playerId: payload.playerId,
    cards,
  });
};

export const revealQuestion = (lobby, payload) => {
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === payload.playerId);
  assertConversationalist(player);
  const promptCard = player.promptCards.find((entry) => entry.id === payload.questionId);
  if (!promptCard) throw new Error('Prompt card was not found.');
  if (promptCard.revealed) throw new Error('Prompt card is already revealed.');

  promptCard.revealed = true;
  promptCard.revealedAt = Date.now();
  promptCard.used = true;
  promptCard.usedAt = Date.now();
  lobby.gameState.activeQuestion = promptCard.text;
  player.score.replies += 1;
  if (promptCard.kind === PROMPT_CARD_KIND.statement) {
    player.score.directAnswers += 1;
  }
  recomputeScores(lobby);
  syncPlayerDerivedFields(player);
  pushTimelineEvent(lobby, {
    type: promptCard.kind === PROMPT_CARD_KIND.statement ? 'Answer' : 'Question',
    text: promptCard.text,
    playerId: player.id,
  });
};

export const useLifeline = (lobby, payload) => {
  if (!LIFELINE_TYPES.includes(payload.type)) {
    throw new Error('Unsupported lifeline type.');
  }
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === payload.playerId);
  assertConversationalist(player);
  ensureRoundResources(player, lobby.gameState.currentRound);

  if (player.indicators.yellowRemaining <= 0) {
    throw new Error('No yellow indicators remaining this round.');
  }
  if (player.lifelines[payload.type]) {
    throw new Error('That lifeline has already been used this round.');
  }

  let selectedSource = null;
  if (payload.type === 'TrustedSourcing') {
    selectedSource = payload.selectedSource || player.selectedTrustedSource || player.trustedSources[0] || null;
    if (!selectedSource) {
      throw new Error('No trusted source is configured for this player.');
    }
    player.selectedTrustedSource = selectedSource;
  }

  player.indicators.yellowRemaining -= 1;
  player.score.yellowUsed += 1;
  player.score.lifelinesUsed += 1;
  player.lifelines[payload.type] = true;
  recomputeScores(lobby);

  const labelByType = {
    AudienceOpinion: 'Audience Opinion',
    TrustedSourcing: 'Trusted Sourcing',
    RefsChoice: "Ref's Choice",
  };
  const details = payload.details?.trim() ? ` ${payload.details.trim()}` : '';
  const sourceText = selectedSource ? ` Source: ${selectedSource}.` : '';
  pushTimelineEvent(lobby, {
    type: 'Lifeline',
    text: `${player.name} used ${labelByType[payload.type]} lifeline.${sourceText}${details}`.trim(),
    playerId: player.id,
    metadata: {
      lifelineType: payload.type,
      selectedSource,
    },
  });
};

export const useGreenIndicator = (lobby, payload) => {
  updateMicState(lobby, {
    playerId: payload.playerId,
    micLive: true,
  });
  const player = lobby.players.find((existingPlayer) => existingPlayer.id === payload.playerId);
  if (!player) return;
  pushTimelineEvent(lobby, {
    type: 'Indicator',
    text: `${player.name} has an active mic state.${payload.reason ? ` ${payload.reason}` : ''}`,
    playerId: player.id,
  });
};

export const addModerationNote = (lobby, payload) => {
  const referee = lobby.players.find((player) => player.id === payload.refereeId);
  assertReferee(referee);
  const note = {
    id: createEntityId('note'),
    text: payload.text,
    shortcutKey: payload.shortcutKey ?? null,
    refereeId: payload.refereeId,
    timestamp: Date.now(),
    hidden: false,
  };
  lobby.gameState.moderationNotes.push(note);
  trimArray(lobby.gameState.moderationNotes, MODERATION_NOTE_LIMIT);
  const action = recordRefereeAction(lobby, {
    type: 'moderation-note',
    refereeId: payload.refereeId,
    payload: { noteId: note.id, text: payload.text },
  });
  pushTimelineEvent(lobby, {
    type: 'ModerationNote',
    text: payload.text,
    playerId: payload.refereeId,
    metadata: {
      shortcutKey: payload.shortcutKey ?? undefined,
      refereeActionId: action.id,
    },
  });
};

export const highlightTimelineEvent = (lobby, payload) => {
  const timeKeeper = lobby.players.find((player) => player.id === payload.timeKeeperId);
  assertTimeKeeper(timeKeeper);
  const event = lobby.gameState.timeline.find((entry) => entry.id === payload.eventId);
  if (!event) {
    throw new Error('Timeline event not found.');
  }
  const highlight = {
    id: createEntityId('highlight'),
    eventId: payload.eventId,
    label: payload.label,
    byPlayerId: payload.timeKeeperId,
    timestamp: Date.now(),
  };
  lobby.gameState.timelineHighlights.push(highlight);
  trimArray(lobby.gameState.timelineHighlights, TIMELINE_HIGHLIGHT_LIMIT);

  pushTimelineEvent(lobby, {
    type: 'Highlight',
    text: `${timeKeeper.name} highlighted "${event.text}"`,
    playerId: payload.timeKeeperId,
    metadata: {
      highlightId: highlight.id,
    },
  });
};

export const updateTimelineSectionSummary = (lobby, payload) => {
  const timeKeeper = lobby.players.find((player) => player.id === payload.timeKeeperId);
  assertTimeKeeper(timeKeeper);
  const section = lobby.gameState.timelineSections.find((entry) => entry.id === payload.sectionId);
  if (!section) throw new Error('Timeline section not found.');
  section.summary = payload.summary.trim() || null;
  pushTimelineEvent(lobby, {
    type: 'Summary',
    text: `Section summary updated by ${timeKeeper.name}.`,
    playerId: payload.timeKeeperId,
  });
};

export const awardScore = (lobby, payload) => {
  const recipient = lobby.players.find((player) => player.id === payload.playerId);
  if (!recipient) throw new Error('Player not found.');
  const points = Number(payload.points);
  if (!Number.isFinite(points) || points < 1) {
    throw new Error('Points must be a positive number.');
  }
  recipient.score.verifiedPoints += points;
  recomputeScores(lobby);
  pushTimelineEvent(lobby, {
    type: 'ScoreAward',
    text: `${recipient.name} received ${points} verified point(s). Reason: ${payload.reason}`,
    playerId: payload.assignerId,
  });
};

export const advanceRound = (lobby, payload) => {
  const timeKeeper = lobby.players.find((player) => player.id === payload.timeKeeperId);
  assertTimeKeeper(timeKeeper);

  if (lobby.gameState.currentRound >= lobby.gameState.gameSettings.totalRounds) {
    endGame(lobby, { reason: 'All rounds completed.' });
    return;
  }

  lobby.gameState.currentRound += 1;
  lobby.gameState.activeQuestion = null;
  resetRoundResources(lobby);
  pushTimelineEvent(lobby, {
    type: 'RoundStart',
    text: `Round ${lobby.gameState.currentRound} has begun.`,
    playerId: 'system',
  });
};

export const setBackdropAsset = (lobby, payload) => {
  const player = lobby.players.find((entry) => entry.id === payload.playerId);
  assertConversationalist(player);
  player.backdrop = {
    assetUrl: payload.assetUrl,
    uploadedAt: Date.now(),
  };
};

export const submitAudioDraft = (lobby, payload) => {
  const player = lobby.players.find((entry) => entry.id === payload.playerId);
  assertConversationalist(player);
  const transcript = payload.transcript.trim();
  if (!transcript) throw new Error('Transcript is required.');
  const draft = {
    id: createEntityId('audio-draft'),
    playerId: payload.playerId,
    transcript,
    audioBase64: payload.audioBase64 ?? null,
    status: 'pending',
    learningHint: buildLearningHint(player),
    submittedAt: Date.now(),
    reviewedAt: null,
    reviewerId: null,
    reviewNote: null,
  };
  lobby.gameState.audioDrafts.push(draft);
  trimArray(lobby.gameState.audioDrafts, AUDIO_DRAFT_LIMIT);
  updateMicState(lobby, { playerId: payload.playerId, micLive: false });
  pushTimelineEvent(lobby, {
    type: 'AudioDraft',
    text: `${player.name} submitted an audio draft for review.`,
    playerId: payload.playerId,
    metadata: {
      audioDraftId: draft.id,
    },
  });
};

export const reviewAudioDraft = (lobby, payload) => {
  const referee = lobby.players.find((entry) => entry.id === payload.reviewerId);
  assertReferee(referee);
  const draft = lobby.gameState.audioDrafts.find((entry) => entry.id === payload.draftId);
  if (!draft) throw new Error('Audio draft not found.');
  if (draft.status !== 'pending') throw new Error('Audio draft has already been reviewed.');

  draft.status = payload.status;
  draft.reviewerId = payload.reviewerId;
  draft.reviewedAt = Date.now();
  draft.reviewNote = payload.reviewNote ?? null;

  const owner = lobby.players.find((entry) => entry.id === draft.playerId);
  if (payload.status === 'approved') {
    if (owner) {
      owner.draftLearning.approvedPhrases.push(draft.transcript);
      trimArray(owner.draftLearning.approvedPhrases, MAX_APPROVED_PHRASES);
      owner.score.replies += 1;
      owner.score.directAnswers += 1;
    }
    recomputeScores(lobby);
    pushTimelineEvent(lobby, {
      type: 'AudioApproved',
      text: draft.transcript,
      playerId: draft.playerId,
      metadata: { audioDraftId: draft.id },
    });
    return;
  }

  pushTimelineEvent(lobby, {
    type: 'AudioRejected',
    text: draft.reviewNote || 'Draft rejected by referee.',
    playerId: payload.reviewerId,
    metadata: { audioDraftId: draft.id },
  });
};

export const submitAudienceChallenge = (lobby, payload) => {
  const challenger = lobby.players.find((entry) => entry.id === payload.challengerId);
  assertConversationalist(challenger);
  ensurePlayerState(challenger, lobby.gameState.currentRound);
  if (challenger.indicators.purpleRemaining <= 0) {
    throw new Error('No audience challenge tokens remaining.');
  }
  const action = lobby.gameState.refereeActions.find((entry) => entry.id === payload.actionId);
  if (!action || !action.reversible || action.reversedAt) {
    throw new Error('Selected referee action cannot be challenged.');
  }

  challenger.indicators.purpleRemaining -= 1;
  challenger.score.purpleChallengesUsed += 1;

  const challenge = {
    id: createEntityId('challenge'),
    actionId: payload.actionId,
    challengerId: payload.challengerId,
    challengerName: challenger.name,
    note: payload.note?.trim() || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_WINDOW_MS,
    status: 'open',
    votes: {},
    resolvedAt: null,
  };
  lobby.gameState.audienceChallenges.push(challenge);
  trimArray(lobby.gameState.audienceChallenges, 60);
  pushTimelineEvent(lobby, {
    type: 'ModerationNote',
    text: `${challenger.name} requested audience review for referee action ${payload.actionId}.`,
    playerId: payload.challengerId,
  });
  return challenge;
};

export const castAudienceChallengeVote = (lobby, payload) => {
  assertViewer(lobby, payload.viewerId);
  const challenge = lobby.gameState.audienceChallenges.find((entry) => entry.id === payload.challengeId);
  if (!challenge) throw new Error('Audience challenge not found.');
  if (challenge.status !== 'open') throw new Error('Audience challenge is already closed.');
  if (challenge.expiresAt <= Date.now()) {
    challenge.status = 'expired';
    challenge.resolvedAt = Date.now();
    throw new Error('Audience challenge voting window has expired.');
  }
  challenge.votes[payload.viewerId] = payload.vote;
  maybeResolveChallenge(lobby, challenge);
  return challenge;
};

export const endGame = (lobby, payload = {}) => {
  lobby.gameState.gamePhase = 'GAME_OVER';
  lobby.gameState.isTimerRunning = false;
  lobby.gameState.turnStartTime = null;
  lobby.gameState.turnRemainingSeconds = null;
  lobby.gameState.speakerId = null;
  lobby.gameState.activeSection = null;
  setActiveSpeakerState(lobby, null);

  const reasons = normalizeReasonCodes(payload.reasonCodes);
  if (payload.requestedBy) {
    const requester = lobby.players.find((player) => player.id === payload.requestedBy);
    if (requester && reasons.includes('agree_to_disagree')) {
      requester.score.concessionPenalty += 2;
    }
  }

  recomputeScores(lobby);
  determineWinner(lobby);
  pushTimelineEvent(lobby, {
    type: 'GameEnd',
    text: payload.reason || 'The game has ended.',
    playerId: payload.requestedBy || 'system',
  });
};
