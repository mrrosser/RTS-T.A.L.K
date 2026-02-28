import React, { useState, useEffect, useCallback, useMemo } from 'react';
import LoginScreen from './components/LoginScreen';
import GameScreen from './components/GameScreen';
import GameSetup from './components/GameSetup';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import LobbyBrowser from './components/LobbyBrowser';
import ViewerScreen from './components/ViewerScreen';
import { Player, PlayerRole, Viewer, GameSettings } from './types';
import {
  createLobby,
  joinLobby,
  getLobbyState,
  addBotToLobby,
  setPlayerRoleInLobby,
  joinAsViewer,
  LobbyState,
  startGame,
  setRequestPlayerId,
} from './services/mockApi';
import { createCorrelationId, logEvent } from './utils/logger';

type AppPhase = 'LOGIN' | 'MAIN_MENU' | 'SETUP' | 'LOBBY_BROWSER' | 'LOBBY' | 'GAME' | 'VIEWER';

const ACTIVE_POLL_MS = 2500;
const BACKGROUND_POLL_MS = 10000;
const NOTIFICATION_TIMEOUT_MS = 5000;

const createUserId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const App: React.FC = () => {
  const sessionCorrelationId = useMemo(() => createCorrelationId(), []);
  const [appPhase, setAppPhase] = useState<AppPhase>('LOGIN');
  const [localUser, setLocalUser] = useState<Player | Viewer | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const gameCode = lobbyState?.code;

  useEffect(() => {
    setRequestPlayerId(localUser?.id ?? null);
  }, [localUser]);

  const notify = useCallback((message: string) => {
    setNotification(message);
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timeoutId = window.setTimeout(() => {
      setNotification(null);
    }, NOTIFICATION_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [notification]);

  const handleExitGame = useCallback((message?: string) => {
    setLobbyState(null);
    setLocalUser((currentUser) => {
      if (!currentUser) return null;
      const { id, name } = currentUser;
      return { id, name };
    });
    setAppPhase('MAIN_MENU');
    if (message) {
      notify(message);
    }
  }, [notify]);

  const handleLobbyPoll = useCallback(
    async (code: string) => {
      try {
        const state = await getLobbyState(code);

        if (!state) {
          logEvent('warn', 'lobby.poll.missing', {
            correlationId: sessionCorrelationId,
            code,
          });
          handleExitGame('The lobby you were in is no longer available.');
          return;
        }

        setLobbyState(state);

        if (localUser) {
          const currentPlayer = state.players.find((player) => player.id === localUser.id);
          const currentViewer = state.viewers.find((viewer) => viewer.id === localUser.id);

          if (currentPlayer) {
            setLocalUser(currentPlayer);
          } else if (currentViewer) {
            setLocalUser(currentViewer);
          }

          if ('role' in localUser && !currentPlayer) {
            handleExitGame('You have been removed from the game by the Referee.');
            return;
          }
        }

        if (state.gameStarted && (appPhase === 'LOBBY' || appPhase === 'SETUP')) {
          const amIPlayer = state.players.some((player) => player.id === localUser?.id);
          const amIViewer = state.viewers.some((viewer) => viewer.id === localUser?.id);
          if (amIPlayer) setAppPhase('GAME');
          else if (amIViewer) setAppPhase('VIEWER');
        }
      } catch (pollError) {
        logEvent('error', 'lobby.poll.error', {
          correlationId: sessionCorrelationId,
          code,
          error: pollError instanceof Error ? pollError.message : String(pollError),
        });
      }
    },
    [appPhase, handleExitGame, localUser, sessionCorrelationId],
  );

  useEffect(() => {
    if (!(appPhase === 'LOBBY' || appPhase === 'GAME' || appPhase === 'VIEWER') || !gameCode) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const runPoll = () => void handleLobbyPoll(gameCode);

    const setupPolling = () => {
      if (interval) {
        clearInterval(interval);
      }
      const pollIntervalMs = document.hidden ? BACKGROUND_POLL_MS : ACTIVE_POLL_MS;
      interval = setInterval(runPoll, pollIntervalMs);
    };

    runPoll();
    setupPolling();
    const onVisibilityChange = () => setupPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [appPhase, gameCode, handleLobbyPoll]);

  useEffect(() => {
    if ((appPhase === 'LOBBY' || appPhase === 'GAME') && (!lobbyState || !localUser || !('role' in localUser))) {
      setAppPhase('MAIN_MENU');
    }
    if (appPhase === 'VIEWER' && (!lobbyState || !localUser)) {
      setAppPhase('MAIN_MENU');
    }
  }, [appPhase, lobbyState, localUser]);

  const handleLogin = (name: string) => {
    const user: Viewer = {
      id: createUserId(),
      name,
    };
    setLocalUser(user);
    setAppPhase('MAIN_MENU');
    setError(null);
  };

  const handleShowSetup = () => setAppPhase('SETUP');
  const handleShowLobbyBrowser = () => setAppPhase('LOBBY_BROWSER');
  const handleBackToMenu = () => setAppPhase('MAIN_MENU');

  const handleGameSetup = async (settings: GameSettings) => {
    if (!localUser) return;
    const player: Player = { ...localUser, role: null, violations: { red: 0, yellow: 0, green: 0 } };
    setIsLoading(true);
    setError(null);
    try {
      const newLobbyState = await createLobby(settings, player);
      setLobbyState(newLobbyState);
      setLocalUser(newLobbyState.players[0]);
      setAppPhase('LOBBY');
    } catch (setupError) {
      logEvent('error', 'lobby.create.failed', {
        correlationId: sessionCorrelationId,
        error: setupError instanceof Error ? setupError.message : String(setupError),
      });
      setError('Failed to create lobby.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRole = async (role: PlayerRole | null) => {
    if (localUser && 'role' in localUser && gameCode) {
      try {
        const updatedLobbyState = await setPlayerRoleInLobby(gameCode, localUser.id, role);
        setLobbyState(updatedLobbyState);
        const updatedLocal = updatedLobbyState.players.find((player) => player.id === localUser.id);
        if (updatedLocal) setLocalUser(updatedLocal);
      } catch (roleError) {
        notify(roleError instanceof Error ? roleError.message : 'Failed to select role.');
      }
    }
  };

  const handleStartGame = async () => {
    if (!gameCode) return;
    try {
      await startGame(gameCode);
      setAppPhase('GAME');
    } catch (startError) {
      notify(startError instanceof Error ? startError.message : 'Could not start game.');
    }
  };

  const handleJoinLobby = async (code: string) => {
    if (!localUser) return;
    const player: Player = { ...localUser, role: null, violations: { red: 0, yellow: 0, green: 0 } };
    setIsLoading(true);
    setError(null);
    try {
      const newLobbyState = await joinLobby(code, player);
      const joinedPlayer = newLobbyState.players.find((existingPlayer) => existingPlayer.id === player.id) ?? player;
      setLobbyState(newLobbyState);
      setLocalUser(joinedPlayer);
      setAppPhase('LOBBY');
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Invalid game code or game has already started.');
      setAppPhase('MAIN_MENU');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinAsViewer = async (code: string) => {
    if (!localUser) return;
    setIsLoading(true);
    setError(null);
    try {
      const newLobbyState = await joinAsViewer(code, localUser);
      setLobbyState(newLobbyState);
      setLocalUser({ id: localUser.id, name: localUser.name });
      setAppPhase(newLobbyState.gameStarted ? 'VIEWER' : 'LOBBY');
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Could not join as viewer.');
      setAppPhase('MAIN_MENU');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddBot = async (role: PlayerRole) => {
    if (gameCode) {
      try {
        const updatedLobbyState = await addBotToLobby(gameCode, role);
        setLobbyState(updatedLobbyState);
      } catch (botError) {
        notify(botError instanceof Error ? botError.message : 'Failed to add bot.');
      }
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <p className="text-white text-xl animate-pulse">Connecting...</p>
        </div>
      );
    }

    if (!localUser || appPhase === 'LOGIN') {
      return <LoginScreen onLogin={handleLogin} />;
    }

    switch (appPhase) {
      case 'MAIN_MENU':
        return (
          <MainMenu
            playerName={localUser.name}
            onShowSetup={handleShowSetup}
            onShowLobbyBrowser={handleShowLobbyBrowser}
            onJoinGame={handleJoinLobby}
            onWatchGame={handleJoinAsViewer}
            error={error}
          />
        );
      case 'SETUP':
        return <GameSetup onGameSetup={handleGameSetup} playerName={localUser.name} onBack={handleBackToMenu} />;
      case 'LOBBY_BROWSER':
        return <LobbyBrowser onJoinLobby={handleJoinLobby} onWatchLobby={handleJoinAsViewer} onBack={handleBackToMenu} />;
      case 'LOBBY':
        if (lobbyState && localUser && 'role' in localUser) {
          return (
            <Lobby
              lobbyState={lobbyState}
              localPlayer={localUser}
              onStartGame={handleStartGame}
              onSelectRole={handleSelectRole}
              onAddBot={handleAddBot}
              onExit={() => handleExitGame()}
            />
          );
        }
        return null;
      case 'GAME':
        if (lobbyState && localUser && 'role' in localUser) {
          return <GameScreen lobbyState={lobbyState} localPlayer={localUser} onExit={() => handleExitGame()} />;
        }
        return null;
      case 'VIEWER':
        if (lobbyState && localUser) {
          return <ViewerScreen lobbyState={lobbyState} localViewer={localUser} onExit={() => handleExitGame()} />;
        }
        return null;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <>
      {notification && (
        <div className="fixed top-4 left-1/2 z-50 w-[min(92vw,40rem)] -translate-x-1/2 rounded-lg border border-amber-300/40 bg-amber-900/70 px-4 py-3 text-center text-amber-100 shadow-xl backdrop-blur">
          {notification}
        </div>
      )}
      {renderContent()}
    </>
  );
};

export default App;
