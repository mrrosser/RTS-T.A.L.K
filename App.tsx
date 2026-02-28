
import React, { useState, useEffect, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import GameScreen from './components/GameScreen';
import GameSetup from './components/GameSetup';
import MainMenu from './components/MainMenu';
import Lobby from './components/Lobby';
import LobbyBrowser from './components/LobbyBrowser';
import ViewerScreen from './components/ViewerScreen';
// Fix: Import GameSettings type.
import { Player, PlayerRole, Viewer, GameSettings } from './types';
import { 
    createLobby, 
    joinLobby, 
    getLobbyState, 
    addBotToLobby, 
    setPlayerRoleInLobby,
    joinAsViewer,
    LobbyState,
    startGame
} from './services/mockApi';

type AppPhase = 'LOGIN' | 'MAIN_MENU' | 'SETUP' | 'LOBBY_BROWSER' | 'LOBBY' | 'GAME' | 'VIEWER';

const App: React.FC = () => {
  const [appPhase, setAppPhase] = useState<AppPhase>('LOGIN');
  const [localUser, setLocalUser] = useState<Player | Viewer | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gameCode = lobbyState?.code;

  const handleLobbyPoll = useCallback(async (code: string) => {
    try {
        const state = await getLobbyState(code);
        if (state) {
          setLobbyState(state);

          if (state.gameStarted && (appPhase === 'LOBBY' || appPhase === 'SETUP')) {
              const amIPlayer = state.players.some(p => p.id === localUser?.id);
              const amIViewer = state.viewers.some(v => v.id === localUser?.id);
              if (amIPlayer) setAppPhase('GAME');
              else if (amIViewer) setAppPhase('VIEWER');
          }
          
          if (localUser && 'role' in localUser && !state.players.some(p => p.id === localUser.id)) {
              handleExitGame();
              alert("You have been removed from the game by the Referee.");
          }

        } else {
          console.warn(`Lobby ${code} not found during poll. Returning to main menu.`);
          handleExitGame();
          alert("The lobby you were in is no longer available.");
        }
    } catch (e) {
        console.error("Error polling for lobby state:", e);
    }
  }, [localUser, appPhase]);

  // Centralized polling for all lobby/game updates
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if ((appPhase === 'LOBBY' || appPhase === 'GAME' || appPhase === 'VIEWER') && gameCode) {
      interval = setInterval(() => handleLobbyPoll(gameCode), 2000);
    }
    return () => clearInterval(interval);
  }, [appPhase, gameCode, handleLobbyPoll]);

  const handleLogin = (name: string) => {
    const user: Viewer = { 
      id: `user-${Date.now()}`,
      name,
    };
    setLocalUser(user);
    setAppPhase('MAIN_MENU');
  };

  const handleShowSetup = () => setAppPhase('SETUP');
  const handleShowLobbyBrowser = () => setAppPhase('LOBBY_BROWSER');
  const handleBackToMenu = () => setAppPhase('MAIN_MENU');

  const handleGameSetup = async (settings: GameSettings) => {
    if (!localUser) return;
    const player: Player = { ...localUser, role: null, violations: { red: 0, yellow: 0, green: 0 }};
    setIsLoading(true);
    setError(null);
    try {
      const newLobbyState = await createLobby(settings, player);
      setLobbyState(newLobbyState);
      setLocalUser(newLobbyState.players[0]);
      setAppPhase('LOBBY');
    } catch (e) {
      setError('Failed to create lobby.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSelectRole = async (role: PlayerRole) => {
    if (localUser && 'role' in localUser && gameCode) {
        try {
            const updatedLobbyState = await setPlayerRoleInLobby(gameCode, localUser.id, role);
            setLobbyState(updatedLobbyState);
            const updatedLocal = updatedLobbyState.players.find(p => p.id === localUser.id);
            if(updatedLocal) setLocalUser(updatedLocal);
        } catch (e) {
             console.error("Failed to set role", e);
             alert(e instanceof Error ? e.message : 'Failed to select role.');
        }
    }
  };

  const handleStartGame = async () => {
    if (!gameCode) return;
    try {
        await startGame(gameCode);
        setAppPhase('GAME');
    } catch (e) {
        alert(e instanceof Error ? e.message : 'Could not start game.');
    }
  };
  
  const handleExitGame = () => {
    setLobbyState(null);
    if (localUser) {
        const { id, name } = localUser;
        setLocalUser({ id, name });
    }
    setAppPhase('MAIN_MENU');
  };
  
  const handleJoinLobby = async (code: string) => {
    if (!localUser) return;
    const player: Player = { ...localUser, role: null, violations: { red: 0, yellow: 0, green: 0 } };
    setIsLoading(true);
    setError(null);
    try {
        const newLobbyState = await joinLobby(code, player);
        setLobbyState(newLobbyState);
        setLocalUser(player);
        setAppPhase('LOBBY');
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Invalid game code or game has already started.');
        setAppPhase('MAIN_MENU');
    } finally {
        setIsLoading(false);
    }
  }

  const handleJoinAsViewer = async (code: string) => {
      if (!localUser) return;
      setIsLoading(true);
      setError(null);
      try {
          const newLobbyState = await joinAsViewer(code, localUser);
          setLobbyState(newLobbyState);
          setAppPhase(newLobbyState.gameStarted ? 'VIEWER' : 'LOBBY'); // Go straight to viewer if game started
      } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not join as viewer.');
          setAppPhase('MAIN_MENU');
      } finally {
          setIsLoading(false);
      }
  }
  
  const handleAddBot = async (role: PlayerRole) => {
    if (gameCode) {
        try {
            const updatedLobbyState = await addBotToLobby(gameCode, role);
            setLobbyState(updatedLobbyState);
        } catch(e) {
             console.error("Failed to add bot", e);
             alert(e instanceof Error ? e.message : 'Failed to add bot.');
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
        return <MainMenu 
            playerName={localUser.name} 
            onShowSetup={handleShowSetup} 
            onShowLobbyBrowser={handleShowLobbyBrowser} 
            onJoinGame={handleJoinLobby} 
            onWatchGame={handleJoinAsViewer}
            error={error} 
        />;
      case 'SETUP':
        return <GameSetup onGameSetup={handleGameSetup} playerName={localUser.name} onBack={handleBackToMenu} />;
      case 'LOBBY_BROWSER':
        return <LobbyBrowser onJoinLobby={handleJoinLobby} onWatchLobby={handleJoinAsViewer} onBack={handleBackToMenu} />;
      case 'LOBBY':
        if (lobbyState && 'role' in localUser) {
            return <Lobby 
                lobbyState={lobbyState}
                localPlayer={localUser as Player}
                onStartGame={handleStartGame}
                onSelectRole={handleSelectRole}
                onAddBot={handleAddBot}
                onExit={handleExitGame}
            />
        }
        setAppPhase('MAIN_MENU');
        return null;
      case 'GAME':
        if (lobbyState && 'role' in localUser) {
          return <GameScreen 
              lobbyState={lobbyState}
              localPlayer={localUser as Player} 
              onExit={handleExitGame} 
          />;
        }
        setAppPhase('MAIN_MENU');
        return null;
       case 'VIEWER':
        if (lobbyState && localUser) {
            return <ViewerScreen 
                lobbyState={lobbyState}
                localViewer={localUser}
                onExit={handleExitGame}
            />;
        }
        setAppPhase('MAIN_MENU');
        return null;
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  }
  
  return <>{renderContent()}</>;
};

export default App;