import React, { useState, useEffect } from 'react';

interface MainMenuProps {
  playerName: string;
  onShowSetup: () => void;
  onShowLobbyBrowser: () => void;
  onJoinGame: (code: string) => void;
  onWatchGame: (code: string) => void;
  error: string | null;
}

const MainMenu: React.FC<MainMenuProps> = ({ playerName, onShowSetup, onShowLobbyBrowser, onJoinGame, onWatchGame, error: apiError }) => {
  const [activeAction, setActiveAction] = useState<'join' | 'watch' | null>(null);
  const [gameCode, setGameCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (apiError) {
      setError(apiError);
    }
  }, [apiError]);

  const handleAction = () => {
    const code = gameCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a game code.');
      return;
    }
    setError('');
    if (activeAction === 'join') {
        onJoinGame(code);
    } else if (activeAction === 'watch') {
        onWatchGame(code);
    }
  };

  const renderInputSection = (type: 'join' | 'watch') => {
    const title = type === 'join' ? 'Enter Game Code to Play' : 'Enter Game Code to Watch';
    const buttonText = type === 'join' ? 'Join Game' : 'Watch Game';
    return (
        <div className="space-y-3 pt-2">
            <h3 className="text-lg font-bold text-center text-gray-200">{title}</h3>
            {error && <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-2 rounded-lg text-sm text-center">{error}</div>}
            <input
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAction()}
              placeholder="ABCXYZ"
              maxLength={6}
              autoCapitalize="characters"
              className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-amber-400 transition-shadow duration-200 text-center tracking-widest font-mono uppercase"
            />
            <button
              onClick={handleAction}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              {buttonText}
            </button>
             <button onClick={() => setActiveAction(null)} className="w-full text-center text-xs text-gray-500 hover:text-gray-200">Cancel</button>
          </div>
    )
  }

  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[100svh] p-4">
      <div className="text-center mb-10">
        <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-gray-100">Welcome, {playerName}</h1>
        <p className="text-lg sm:text-xl text-gray-400 mt-2">How would you like to T.A.L.K today?</p>
      </div>
      <div className="w-full bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-8 space-y-4">
        <button
          onClick={onShowSetup}
          className="w-full bg-gradient-to-r from-amber-600 to-purple-600 bg-[length:200%_auto] hover:bg-[position:100%_0] text-white font-bold py-3 px-4 rounded-lg text-lg transition-all duration-500 transform hover:scale-105 shadow-lg hover:shadow-purple-500/30"
        >
          Create a New Game
        </button>

        <button
            onClick={onShowLobbyBrowser}
            className="w-full bg-indigo-700/80 hover:bg-indigo-600/80 text-white font-bold py-3 px-4 rounded-lg border border-indigo-600 transition-colors"
          >
            Browse Public Games
        </button>
        
        <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
            </div>
            <div className="relative bg-[#0d0d1a] px-2 text-sm text-gray-500">OR</div>
        </div>

        {activeAction ? renderInputSection(activeAction) : (
             <div className="grid grid-cols-2 gap-3">
                 <button
                    onClick={() => setActiveAction('join')}
                    className="w-full bg-gray-700/50 hover:bg-gray-600/50 text-white font-bold py-3 px-4 rounded-lg border border-gray-600 transition-colors"
                  >
                    Join with a Code
                  </button>
                  <button
                    onClick={() => setActiveAction('watch')}
                    className="w-full bg-gray-700/50 hover:bg-gray-600/50 text-white font-bold py-3 px-4 rounded-lg border border-gray-600 transition-colors"
                  >
                    Watch with a Code
                  </button>
             </div>
        )}
      </div>
    </div>
  );
};

export default MainMenu;
