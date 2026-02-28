import React, { useState } from 'react';
import { Player, PlayerRole } from '../types';
import { ROLES } from '../constants';
import { LobbyState } from '../services/mockApi';
import { logEvent } from '../utils/logger';

interface LobbyProps {
  lobbyState: LobbyState;
  localPlayer: Player;
  onStartGame: () => void;
  onSelectRole: (role: PlayerRole | null) => void;
  onAddBot: (role: PlayerRole) => void;
  onExit: () => void;
}

const RoleSelector: React.FC<{
  onSelectRole: (role: PlayerRole | null) => void;
  takenRoles: { referee: boolean; timeKeeper: boolean };
}> = ({ onSelectRole, takenRoles }) => {
    return (
        <div className="mt-4 p-3 bg-black/30 rounded-lg">
            <h3 className="text-center font-bold text-gray-200 mb-2">Choose Your Role</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button onClick={() => onSelectRole('Conversationalist')} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-md transition-colors">Conversationalist</button>
                <button onClick={() => onSelectRole('Referee')} disabled={takenRoles.referee} className="text-sm bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-md transition-colors">Referee</button>
                <button onClick={() => onSelectRole('Time Keeper')} disabled={takenRoles.timeKeeper} className="text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-3 rounded-md transition-colors">Time Keeper</button>
                <button onClick={() => onSelectRole(null)} className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-md transition-colors">Clear</button>
            </div>
        </div>
    );
};


const Lobby: React.FC<LobbyProps> = ({ lobbyState, localPlayer, onStartGame, onSelectRole, onAddBot, onExit }) => {
  const { code: gameCode, settings, players } = lobbyState;
  const [selectedBotRole, setSelectedBotRole] = useState<PlayerRole>('Conversationalist');
  const isHost = players[0]?.id === localPlayer.id;

  const rolesFilled = () => {
    const hasReferee = players.some(p => p.role === 'Referee');
    const hasTimeKeeper = players.some(p => p.role === 'Time Keeper');
    const hasConversationalist = players.some(p => p.role === 'Conversationalist');
    return hasReferee && hasTimeKeeper && hasConversationalist;
  };

  const getStartButtonText = () => {
    if (players.length < 3) return 'Need at least 3 players';
    if (!players.some(p => p.role === 'Referee')) return 'Waiting for a Referee';
    if (!players.some(p => p.role === 'Time Keeper')) return 'Waiting for a Time Keeper';
    if (!players.some(p => p.role === 'Conversationalist')) return 'Waiting for a Conversationalist';
    return 'Start Game';
  };

  const canStart = players.length >= 3 && rolesFilled();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(gameCode);
    } catch (error) {
      logEvent('warn', 'lobby.copyCode.failed', {
        code: gameCode,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const localPlayerDetails = players.find(p => p.id === localPlayer.id);

  const localPlayerRoleBlockers = {
      referee: players.some(p => p.role === 'Referee' && p.id !== localPlayer.id),
      timeKeeper: players.some(p => p.role === 'Time Keeper' && p.id !== localPlayer.id),
  };
  
  const globalTakenRoles = {
      referee: players.some(p => p.role === 'Referee'),
      timeKeeper: players.some(p => p.role === 'Time Keeper'),
  };

  const isBotAddDisabled = () => {
    if (players.length >= 5) return true;
    if (selectedBotRole === 'Referee' && globalTakenRoles.referee) return true;
    if (selectedBotRole === 'Time Keeper' && globalTakenRoles.timeKeeper) return true;
    return false;
  };

  const botAddButtonTitle = () => {
    if (players.length >= 5) return "Lobby is full";
    if ((selectedBotRole === 'Referee' && globalTakenRoles.referee) || (selectedBotRole === 'Time Keeper' && globalTakenRoles.timeKeeper)) {
        return `${selectedBotRole} role is already taken.`;
    }
    return "Add a bot with the selected role";
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[100svh] p-4">
      <div className="text-center mb-8">
        <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-gray-100">Game Lobby</h1>
        <p className="text-lg sm:text-xl text-gray-400 mt-2">Get ready to T.A.L.K.</p>
      </div>
      
      <div className="w-full bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {!settings.isPublic && (
            <div className="text-center p-4 bg-black/40 border border-dashed border-gray-600 rounded-lg">
                <p className="text-gray-400 text-sm">Share this code to invite others:</p>
                <div className="flex items-center justify-center gap-4 mt-2">
                    <p className="text-4xl font-mono font-bold tracking-widest text-amber-400">{gameCode}</p>
                    <button onClick={copyCode} title="Copy Code" className="p-2 rounded-md hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined">content_copy</span>
                    </button>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h2 className="text-2xl font-bold font-display mb-3 text-gray-100">Players ({players.length}/5)</h2>
                <div className="space-y-2 bg-black/20 p-3 rounded-lg min-h-[150px]">
                    {players.map(p => (
                        <div key={p.id} className="text-lg font-semibold text-gray-200 p-2 rounded-md bg-white/5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-amber-400 ${players[0].id === p.id ? 'opacity-100' : 'opacity-0'}`} title="Host">crown</span>
                                    <span>{p.name} {p.id === localPlayer.id && <span className="text-xs text-amber-400">(You)</span>}</span>
                                </div>
                                <span className="text-sm font-bold px-2 py-1 rounded-md bg-black/30 text-purple-300">{p.role || 'Choosing...'}</span>
                            </div>
                        </div>
                    ))}
                </div>
                 {localPlayerDetails && <RoleSelector onSelectRole={onSelectRole} takenRoles={localPlayerRoleBlockers} />}
            </div>
            <div>
                <h2 className="text-2xl font-bold font-display mb-3 text-gray-100">Settings</h2>
                <ul className="space-y-2 text-gray-300 bg-black/20 p-3 rounded-lg">
                    <li><strong>Topic:</strong> {settings.topic}</li>
                    <li><strong>Rounds:</strong> {settings.totalRounds}</li>
                    <li><strong>Turn Time:</strong> {settings.turnDuration}s</li>
                    <li><strong>Visibility:</strong> {settings.isPublic ? 'Public' : 'Private'}</li>
                </ul>
            </div>
        </div>
        
        {isHost ? (
          <div className="flex flex-col gap-3">
            <button
                onClick={onStartGame}
                disabled={!canStart}
                className="w-full bg-gradient-to-r from-amber-600 to-purple-600 bg-[length:200%_auto] hover:bg-[position:100%_0] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg text-lg transition-all duration-500 transform hover:scale-105"
            >
              {getStartButtonText()}
            </button>
            <div className="flex items-center justify-center gap-2 p-3 bg-black/20 rounded-lg">
              <label htmlFor="bot-role" className="font-semibold text-gray-300">Add Bot as:</label>
              <select
                  id="bot-role"
                  value={selectedBotRole}
                  onChange={e => setSelectedBotRole(e.target.value as PlayerRole)}
                  className="bg-black/40 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button 
                  onClick={() => onAddBot(selectedBotRole)} 
                  disabled={isBotAddDisabled()} 
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg"
                  title={botAddButtonTitle()}
              >
                  Add
              </button>
            </div>
          </div>
        ) : (
            <p className="text-center text-lg text-gray-400 italic py-3">Waiting for the host to start the game...</p>
        )}
        
        <button onClick={onExit} className="w-full text-center text-sm text-gray-500 hover:text-red-400 transition-colors pt-2">
          Leave Lobby
        </button>

      </div>
    </div>
  );
};

export default Lobby;
