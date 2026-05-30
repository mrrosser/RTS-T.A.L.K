export type PlayerRole = 'Conversationalist' | 'Referee' | 'Time Keeper';
export type LifelineType = 'AudienceOpinion' | 'TrustedSourcing' | 'RefsChoice';
export type AudioDraftStatus = 'pending' | 'approved' | 'rejected';
export type AuthProvider = 'guest' | 'google.com' | 'apple.com' | 'phone' | 'anonymous';
export type PromptCardKind = 'question' | 'statement';
export type AudienceChallengeVote = 'justified' | 'unjust';

export interface PlayerIndicators {
  round: number;
  redRemaining: number;
  yellowRemaining: number;
  greenRemaining: number;
  purpleRemaining?: number;
}

export interface PlayerPresence {
  micLive: boolean;
  videoEnabled: boolean;
  activeSpeaker: boolean;
  mutedByReferee?: boolean;
  mutedByActionId?: string | null;
}

export interface PlayerLifelines {
  round: number;
  AudienceOpinion: boolean;
  TrustedSourcing: boolean;
  RefsChoice: boolean;
}

export interface PromptCard {
  id: string;
  text: string;
  kind: PromptCardKind;
  used: boolean;
  revealed: boolean;
  revealedAt: number | null;
  usedAt: number | null;
}

export interface QuestionBankItem {
  id: string;
  text: string;
  revealed: boolean;
  revealedAt: number | null;
  kind?: PromptCardKind;
  used?: boolean;
  usedAt?: number | null;
}

export interface PlayerScore {
  replies: number;
  directAnswers: number;
  verifiedPoints: number;
  redFlagsReceived: number;
  yellowFlagsReceived: number;
  yellowUsed: number;
  greenUsed: number;
  purpleChallengesUsed?: number;
  lifelinesUsed: number;
  efficiencyBonus: number;
  concessionPenalty?: number;
  total: number;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole | null;
  violations: {
    red: number;
    yellow: number;
    green: number;
  };
  authUserId?: string;
  authProvider?: AuthProvider;
  trustedSources?: string[];
  selectedTrustedSource?: string | null;
  questionBank?: QuestionBankItem[];
  promptCards?: PromptCard[];
  indicators?: PlayerIndicators;
  presence?: PlayerPresence;
  lifelines?: PlayerLifelines;
  score?: PlayerScore;
  draftLearning?: {
    approvedPhrases: string[];
  };
  backdrop?: BackdropAsset | null;
}

export type TimelineEventType =
  | 'Topic'
  | 'Question'
  | 'Summary'
  | 'Answer'
  | 'FactCheck'
  | 'Violation'
  | 'RoundStart'
  | 'TurnStart'
  | 'TurnEnd'
  | 'GameEnd'
  | 'Lifeline'
  | 'ModerationNote'
  | 'Highlight'
  | 'ScoreAward'
  | 'AudioDraft'
  | 'AudioApproved'
  | 'AudioRejected'
  | 'Indicator';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  text: string;
  playerId: string;
  timestamp: number;
  violation?: {
    type: 'red' | 'yellow';
    targetPlayerId: string;
  };
  factCheckVotes?: string[];
  metadata?: Record<string, unknown>;
}

export interface GameSettings {
  topic: string;
  totalRounds: number;
  turnDuration: number;
  isPublic: boolean;
}

export type GamePhase = 'ROUND_START' | 'CONVERSATION' | 'JUDGEMENT' | 'GAME_OVER';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  recipientId?: string;
  recipientLabel?: string;
}

export interface Viewer {
  id: string;
  name: string;
  authUserId?: string;
  authProvider?: AuthProvider;
}

export interface TimelineSection {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  summary: string | null;
  endReasons?: string[];
}

export interface TimelineHighlight {
  id: string;
  eventId: string;
  label: string;
  byPlayerId: string;
  timestamp: number;
}

export interface ModerationNote {
  id: string;
  text: string;
  shortcutKey: string | null;
  refereeId: string;
  timestamp: number;
  hidden?: boolean;
}

export interface AudioDraft {
  id: string;
  playerId: string;
  transcript: string;
  audioBase64: string | null;
  status: AudioDraftStatus;
  learningHint: string | null;
  submittedAt: number;
  reviewedAt: number | null;
  reviewerId: string | null;
  reviewNote: string | null;
}

export interface WinnerSummary {
  playerId: string;
  playerName: string;
  score: number;
  reason: string;
}

export interface BackdropAsset {
  assetUrl: string;
  uploadedAt?: number;
}

export interface RefereeAction {
  id: string;
  type: 'violation' | 'moderation-note' | 'mute';
  refereeId: string;
  payload: Record<string, unknown>;
  reversible: boolean;
  createdAt: number;
  reversedAt: number | null;
  reversedByChallengeId: string | null;
}

export interface AudienceChallenge {
  id: string;
  actionId: string;
  challengerId: string;
  challengerName: string;
  note: string | null;
  createdAt: number;
  expiresAt: number;
  status: 'open' | 'overturned' | 'upheld' | 'expired';
  votes: Record<string, AudienceChallengeVote>;
  resolvedAt: number | null;
}

export interface SessionSummary {
  sessionId: string;
  lobbyCode: string;
  topic: string;
  winner: WinnerSummary | null;
  endedAt: number;
  endedBy: string | null;
  currentRound: number;
  playerSnapshots: Array<{
    playerId: string;
    name: string;
    role: PlayerRole | null;
    score: number;
    trustedSources?: string[];
    backdrop?: BackdropAsset | null;
  }>;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  authProvider: AuthProvider;
  rememberedTrustedSources?: string[];
  preferredBackdrop?: BackdropAsset | null;
  approvedPhrases?: string[];
  lastLobbyCode?: string | null;
  lastRole?: PlayerRole | null;
  createdAt?: number;
  updatedAt?: number;
  lastSeenAt?: number;
}

export interface AuthContext {
  userId: string;
  authProvider: AuthProvider | string;
  isGuest: boolean;
  tokenVerified?: boolean;
  tokenPresent?: boolean;
  displayName?: string | null;
  phoneNumber?: string | null;
}

export interface BootstrapResponse {
  auth: AuthContext;
  profile: UserProfile;
  sessions: SessionSummary[];
}

export interface MediaTokenResponse {
  enabled: boolean;
  wsUrl: string | null;
  token: string | null;
  roomName: string;
}

export interface UploadResponse {
  enabled: boolean;
  uploadUrl: string | null;
  assetUrl: string | null;
  objectPath: string | null;
}

export interface GameState {
  players: Player[];
  viewers: Viewer[];
  gameSettings: GameSettings;
  timeline: TimelineEvent[];
  currentRound: number;
  activeTopic: string | null;
  activeQuestion: string | null;
  gamePhase: GamePhase;
  speakerId: string | null;
  chatMessages: ChatMessage[];
  turnStartTime: number | null;
  isTimerRunning: boolean;
  turnRemainingSeconds: number | null;
  timelineSections?: TimelineSection[];
  timelineHighlights?: TimelineHighlight[];
  moderationNotes?: ModerationNote[];
  audioDrafts?: AudioDraft[];
  audienceChallenges?: AudienceChallenge[];
  refereeActions?: RefereeAction[];
  icebreakerQuestions?: string[];
  winner?: WinnerSummary | null;
  closingQuote?: string;
  activeSection?: {
    id: string;
    speakerId: string;
    startTime: number;
  } | null;
}

export interface LobbyState {
  code: string;
  settings: GameSettings;
  players: Player[];
  viewers: Viewer[];
  gameState: GameState;
  gameStarted: boolean;
  createdAt: number;
  updatedAt?: number;
}
