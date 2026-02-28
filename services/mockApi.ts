// This service simulates a backend server for managing game lobbies.
// It uses localStorage to persist data across browser tabs and sessions.

import { GameSettings, Player, PlayerRole, Viewer, GameState, TimelineEvent, ChatMessage } from '../types';
import { initialGameState } from '../constants';

const LOBBIES_KEY = 'TALK_GAME_LOBBIES';

export interface LobbyState {
  code: string;
  settings: GameSettings;
  players: Player[];
  viewers: Viewer[];
  gameState: GameState;
  gameStarted: boolean;
  createdAt: number;
}

// --- Helper Functions ---

const getLobbiesFromStorage = (): Map<string, LobbyState> => {
  try {
    const lobbiesJson = localStorage.getItem(LOBBIES_KEY);
    if (!lobbiesJson) return new Map();
    // Reviver function to correctly parse Map objects
    return new Map(JSON.parse(lobbiesJson));
  } catch (error) {
    console.error("Failed to parse lobbies from localStorage", error);
    return new Map();
  }
};

const saveLobbiesToStorage = (lobbies: Map<string, LobbyState>) => {
  const lobbiesArray = Array.from(lobbies.entries());
  localStorage.setItem(LOBBIES_KEY, JSON.stringify(lobbiesArray));
};

const generateCode = () => {
    const lobbies = getLobbiesFromStorage();
    let code = '';
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (lobbies.has(code));
    return code;
}

const cleanupOldLobbies = () => {
    const lobbies = getLobbiesFromStorage();
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    let changed = false;
    for (const [code, lobby] of lobbies.entries()) {
        if (lobby.createdAt < twoHoursAgo) {
            lobbies.delete(code);
            changed = true;
        }
    }
    if (changed) {
        saveLobbiesToStorage(lobbies);
    }
}
cleanupOldLobbies();


// --- API Functions ---

export const createLobby = (settings: GameSettings, host: Player): Promise<LobbyState> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lobbies = getLobbiesFromStorage();
      const code = generateCode();
      const newLobby: LobbyState = {
        code,
        settings,
        players: [host],
        viewers: [],
        gameState: {
            ...initialGameState,
            players: [host],
            viewers: [],
            gameSettings: settings,
            activeTopic: settings.topic,
            timeline: [
              { id: `event-${Date.now()}`, type: 'Topic', text: `The topic is: ${settings.topic}`, playerId: 'system', timestamp: Date.now() }
            ]
        },
        gameStarted: false,
        createdAt: Date.now(),
      };
      lobbies.set(code, newLobby);
      saveLobbiesToStorage(lobbies);
      resolve(newLobby);
    }, 500);
  });
};

export const joinLobby = (code: string, player: Player): Promise<LobbyState> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const lobbies = getLobbiesFromStorage();
      const lobby = lobbies.get(code);
      if (!lobby) return reject(new Error('Game not found.'));
      if (lobby.gameStarted) return reject(new Error('This game has already started.'));
      if (lobby.players.length >= 5) return reject(new Error('This lobby is already full.'));
      if (lobby.players.some(p => p.id === player.id)) return resolve(lobby); // Already in
      
      lobby.players.push(player);
      lobby.gameState.players = lobby.players;
      saveLobbiesToStorage(lobbies);
      resolve(lobby);
    }, 500);
  });
};

export const joinAsViewer = (code: string, viewer: Viewer): Promise<LobbyState> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const lobbies = getLobbiesFromStorage();
            const lobby = lobbies.get(code);
            if (!lobby) return reject(new Error('Game not found.'));
            if (!lobby.viewers.some(v => v.id === viewer.id)) {
                lobby.viewers.push(viewer);
                lobby.gameState.viewers = lobby.viewers;
                saveLobbiesToStorage(lobbies);
            }
            resolve(lobby);
        }, 500);
    });
};

export const getPublicLobbies = (): Promise<LobbyState[]> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            cleanupOldLobbies();
            const lobbies = getLobbiesFromStorage();
            const publicLobbies = Array.from(lobbies.values()).filter(l => l.settings.isPublic && !l.gameStarted);
            resolve(publicLobbies);
        }, 300);
    });
};

export const getLobbyState = (code: string): Promise<LobbyState | null> => {
   return new Promise((resolve) => {
     const lobbies = getLobbiesFromStorage();
     const lobby = lobbies.get(code);
     resolve(lobby || null);
   });
};

// --- In-Game Actions ---

const updateLobby = (code: string, updateFn: (lobby: LobbyState) => void): Promise<LobbyState> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const lobbies = getLobbiesFromStorage();
            const lobby = lobbies.get(code);
            if (!lobby) return reject(new Error("Lobby not found."));
            
            updateFn(lobby);

            saveLobbiesToStorage(lobbies);
            resolve(lobby);
        }, 50); // Actions are faster than joins
    });
};

export const startGame = (code: string): Promise<LobbyState> => updateLobby(code, lobby => {
    lobby.gameStarted = true;
    lobby.gameState.timeline.unshift({ id: `event-${Date.now()}`, type: 'RoundStart', text: `Round 1 has begun!`, playerId: 'system', timestamp: Date.now() });
});

export const addBotToLobby = (code: string, role: PlayerRole): Promise<LobbyState> => updateLobby(code, lobby => {
    if (lobby.players.length >= 5) throw new Error("Lobby is full.");

    if ((role === 'Referee' && lobby.players.some(p => p.role === 'Referee')) ||
        (role === 'Time Keeper' && lobby.players.some(p => p.role === 'Time Keeper'))) {
        throw new Error(`The ${role} role is already taken.`);
    }

    const bot: Player = {
        id: `player-bot-${Date.now()}`,
        name: `Bot ${lobby.players.length + 1}`,
        role: role,
        violations: { red: 0, yellow: 0, green: 0 },
    };
    lobby.players.push(bot);
    lobby.gameState.players = lobby.players;
});

export const setPlayerRoleInLobby = (code: string, playerId: string, role: PlayerRole): Promise<LobbyState> => updateLobby(code, lobby => {
    if ((role === 'Referee' && lobby.players.some(p => p.role === 'Referee' && p.id !== playerId)) ||
        (role === 'Time Keeper' && lobby.players.some(p => p.role === 'Time Keeper' && p.id !== playerId))) {
        throw new Error(`The ${role} role is already taken.`);
    }
    
    const player = lobby.players.find(p => p.id === playerId);
    if (player) {
        player.role = role;
        lobby.gameState.players = lobby.players;
    } else {
        throw new Error("Player not found.");
    }
});

export const removePlayer = (code: string, playerId: string): Promise<LobbyState> => updateLobby(code, lobby => {
    const playerIndex = lobby.players.findIndex(p => p.id === playerId);
    if (playerIndex > -1) {
        lobby.players.splice(playerIndex, 1);
        lobby.gameState.players = lobby.players;
    } else {
        throw new Error("Player not found to remove.");
    }
});

export const addTimelineEvent = (code: string, event: Omit<TimelineEvent, 'id' | 'timestamp'>): Promise<LobbyState> => updateLobby(code, lobby => {
    const newEvent: TimelineEvent = { ...event, id: `event-${Date.now()}`, timestamp: Date.now() };
    lobby.gameState.timeline.push(newEvent);
});

export const assignViolation = (code: string, violation: {targetPlayerId: string, type: 'red' | 'yellow', reason: string, assignerId: string}): Promise<LobbyState> => updateLobby(code, lobby => {
    const targetPlayer = lobby.gameState.players.find(p => p.id === violation.targetPlayerId);
    if (!targetPlayer) throw new Error("Player to violate not found");

    targetPlayer.violations[violation.type]++;
    const newEvent: TimelineEvent = {
        id: `event-${Date.now()}`,
        timestamp: Date.now(),
        type: 'Violation',
        text: `Reason: ${violation.reason}`,
        playerId: violation.assignerId,
        violation: { type: violation.type, targetPlayerId: violation.targetPlayerId }
    };
    lobby.gameState.timeline.push(newEvent);
    lobby.players = lobby.gameState.players; // sync top-level players too
});

export const sendMessage = (code: string, message: Omit<ChatMessage, 'id'|'timestamp'>): Promise<LobbyState> => updateLobby(code, lobby => {
    const newMessage: ChatMessage = { ...message, id: `msg-${Date.now()}`, timestamp: Date.now() };
    lobby.gameState.chatMessages.push(newMessage);
});

export const startTurn = (code: string, speakerId: string): Promise<LobbyState> => updateLobby(code, lobby => {
    lobby.gameState.isTimerRunning = true;
    lobby.gameState.turnStartTime = Date.now();
    lobby.gameState.speakerId = speakerId;
});

export const endTurn = (code: string): Promise<LobbyState> => updateLobby(code, lobby => {
    lobby.gameState.isTimerRunning = false;
    lobby.gameState.turnStartTime = null;
});

export const pauseTurn = (code: string, pause: boolean): Promise<LobbyState> => updateLobby(code, lobby => {
    lobby.gameState.isTimerRunning = !pause;
    // Note: A real implementation would need to adjust startTime to account for pause duration.
    // For this mock, we'll keep it simple.
});

export const castVote = (code: string, eventId: string, viewerId: string): Promise<LobbyState> => updateLobby(code, lobby => {
    const event = lobby.gameState.timeline.find(e => e.id === eventId);
    if (event) {
        if (!event.factCheckVotes) event.factCheckVotes = [];
        if (!event.factCheckVotes.includes(viewerId)) {
            event.factCheckVotes.push(viewerId);
        }
    } else {
        throw new Error("Timeline event not found.");
    }
});