// types.ts

export type PlayerRole = 'Conversationalist' | 'Referee' | 'Time Keeper';

export type LifelineType = 'AudienceOpinion' | 'TrustedSourcing' | 'RefsChoice';
export type AudioDraftStatus = 'pending' | 'approved' | 'rejected';

export interface PlayerIndicators {
  round: number;
  redRemaining: number;
  yellowRemaining: number;
  greenRemaining: number;
}

export interface PlayerLifelines {
  round: number;
  AudienceOpinion: boolean;
  TrustedSourcing: boolean;
  RefsChoice: boolean;
}

export interface QuestionBankItem {
  id: string;
  text: string;
  revealed: boolean;
  revealedAt: number | null;
}

export interface PlayerScore {
  replies: number;
  directAnswers: number;
  verifiedPoints: number;
  redFlagsReceived: number;
  yellowFlagsReceived: number;
  yellowUsed: number;
  greenUsed: number;
  lifelinesUsed: number;
  efficiencyBonus: number;
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
  trustedSources?: string[];
  selectedTrustedSource?: string | null;
  questionBank?: QuestionBankItem[];
  indicators?: PlayerIndicators;
  lifelines?: PlayerLifelines;
  score?: PlayerScore;
  draftLearning?: {
    approvedPhrases: string[];
  };
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
  factCheckVotes?: string[]; // Array of viewer IDs who voted
  metadata?: {
    lifelineType?: LifelineType;
    shortcutKey?: string;
    highlightId?: string;
    audioDraftId?: string;
    selectedSource?: string;
  };
}

export interface GameSettings {
  topic: string;
  totalRounds: number;
  turnDuration: number; // in seconds
  isPublic: boolean;
}

export type GamePhase =
  | 'ROUND_START'
  | 'CONVERSATION'
  | 'JUDGEMENT'
  | 'GAME_OVER';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface Viewer {
    id: string;
    name: string;
}

export interface TimelineSection {
  id: string;
  speakerId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  summary: string | null;
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
  // Timer State
  turnStartTime: number | null;
  isTimerRunning: boolean;
  turnRemainingSeconds: number | null;
  timelineSections?: TimelineSection[];
  timelineHighlights?: TimelineHighlight[];
  moderationNotes?: ModerationNote[];
  audioDrafts?: AudioDraft[];
  winner?: WinnerSummary | null;
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
}
