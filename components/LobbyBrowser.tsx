import React, { useState, useEffect } from 'react';
import { getPublicLobbies, LobbyState } from '../services/mockApi';
import { PlayerRole } from '../types';

interface LobbyBrowserProps {
  onJoinLobby: (code: string) => void;
  onWatchLobby: (code: string) => void;
  onBack: () => void;
}

const RoleIndicator: React.FC<{
    icon: string;
    role: PlayerRole;
    isTaken: boolean;
}> = ({ icon, role, isTaken }) => (
    <div className={`flex items-center gap-1 p-1.5 rounded-md ${isTaken ? 'bg-black/40 text-gray-200' : 'bg-black/20 text-gray-500'}`} title={isTaken ? `${role} is taken` : `${role} is available`}>
        <span className="material-symbols-outlined text-base">{icon}</span>
    </div>
);


const LobbyCard: React.FC<{ lobby: LobbyState; onJoin: (code: string) => void; onWatch: (code: string) => void }> = ({ lobby, onJoin, onWatch }) => {
    const { settings, players, code } = lobby;
    
    const roles = {
        referee: players.some(p => p.role === 'Referee'),
        timeKeeper: players.some(p => p.role === 'Time Keeper'),
        conversationalists: players.filter(p => p.role === 'Conversationalist').length,
    }

    const isFull = players.length >= 5;

    return (
        <div className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl p-4 flex flex-col justify-between gap-3 transform hover:-translate-y-1 transition-transform duration-300">
            <div>
                <h3 className="font-display text-2xl font-bold text-amber-400 truncate" title={settings.topic}>{settings.topic}</h3>
                <p className="text-gray-400 text-sm">Hosted by {players[0]?.name || 'Unknown'}</p>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <RoleIndicator icon="gavel" role="Referee" isTaken={roles.referee} />
                    <RoleIndicator icon="timer" role="Time Keeper" isTaken={roles.timeKeeper} />
                    <div className="flex items-center gap-1 p-1.5 rounded-md bg-black/20" title={`${roles.conversationalists} Conversationalist(s)`}>
                        <span className="material-symbols-outlined text-base text-gray-400">mic</span>
                        <span className="text-sm font-semibold">{roles.conversationalists}</span>
                    </div>
                </div>
                 <div className="text-lg font-bold">
                    <span className="material-symbols-outlined text-base align-middle mr-1">groups</span>
                    {players.length} / 5
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
                 <button
                    onClick={() => onWatch(code)}
                    className="w-full bg-indigo-700/80 hover:bg-indigo-600/80 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    Watch
                </button>
                <button
                    onClick={() => onJoin(code)}
                    disabled={isFull}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isFull ? 'Full' : 'Join'}
                </button>
            </div>
        </div>
    )
}

const LobbyBrowser: React.FC<LobbyBrowserProps> = ({ onJoinLobby, onWatchLobby, onBack }) => {
  const [lobbies, setLobbies] = useState<LobbyState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLobbies = async () => {
      setIsLoading(true);
      try {
        const publicLobbies = await getPublicLobbies();
        setLobbies(publicLobbies);
      } catch (error) {
        console.error("Failed to fetch public lobbies:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLobbies();
  }, []);

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[100svh] p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-8">
        <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-gray-100">Public Lobbies</h1>
        <p className="text-lg sm:text-xl text-gray-400 mt-2">Join an ongoing conversation or create your own.</p>
      </div>
      
      <div className="w-full bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-6 flex-grow">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white text-xl animate-pulse">Searching for games...</p>
          </div>
        ) : lobbies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lobbies.map(lobby => (
              <LobbyCard key={lobby.code} lobby={lobby} onJoin={onJoinLobby} onWatch={onWatchLobby} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="material-symbols-outlined text-6xl text-gray-600 mb-4">public_off</span>
            <h3 className="text-2xl font-bold text-gray-300">No Public Games Found</h3>
            <p className="text-gray-500">It looks quiet out there. Why not create the first game?</p>
          </div>
        )}
      </div>
       <button onClick={onBack} className="w-full text-center text-sm text-gray-400 hover:text-gray-100 transition-colors pt-6">
            Back to Main Menu
        </button>
    </div>
  );
};

export default LobbyBrowser;