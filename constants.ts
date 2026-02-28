// Fix: Use type-only import for GameState as it's only used for type annotations.
import type { GameState } from './types';

export const ROLES: ['Conversationalist', 'Referee', 'Time Keeper'] = ['Conversationalist', 'Referee', 'Time Keeper'];

// Fix: Add missing properties to satisfy the Omit<GameState, ...> type.
export const initialGameState: Omit<GameState, 'players' | 'gameSettings'> = {
  timeline: [],
  viewers: [],
  currentRound: 1,
  activeTopic: null,
  activeQuestion: null,
  gamePhase: 'ROUND_START',
  speakerId: null,
  chatMessages: [],
  turnStartTime: null,
  isTimerRunning: false,
};
