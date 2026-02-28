// types.ts

import { LobbyState } from "./services/mockApi";

export type PlayerRole = 'Conversationalist' | 'Referee' | 'Time Keeper';

export interface Player {
  id: string;
  name: string;
  role: PlayerRole | null;
  violations: {
    red: number;
    yellow: number;
    green: number;
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
  | 'GameEnd';

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
}

// Re-export LobbyState to avoid circular dependency issues
export type { LobbyState };