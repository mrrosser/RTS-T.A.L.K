import React, { useState } from 'react';
import { GameSettings } from '../types';

interface GameSetupProps {
  playerName: string;
  onGameSetup: (settings: GameSettings) => void;
  onBack: () => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ playerName, onGameSetup, onBack }) => {
  const [topic, setTopic] = useState('');
  const [totalRounds, setTotalRounds] = useState(3);
  const [turnDuration, setTurnDuration] = useState(60);
  const [isPublic, setIsPublic] = useState(true);

  const handleCreateLobby = () => {
    if (topic.trim()) {
        onGameSetup({ topic: topic.trim(), totalRounds, turnDuration, isPublic });
    }
  };

  const isFormValid = topic.trim().length > 0;

  return (
    <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[100svh] py-8 px-4">
      <div className="text-center mb-10">
        <h1 className="text-5xl sm:text-6xl font-black font-display tracking-tight text-gray-100">Game Setup</h1>
        <p className="text-lg sm:text-xl text-gray-400 mt-2">Welcome, {playerName}. Configure your T.A.L.K session.</p>
      </div>
      <div className="w-full bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-100 font-display">Session Settings</h2>
        
        <div className="space-y-4">
           <div>
            <label htmlFor="topic" className="block text-sm font-medium text-gray-400 mb-2">Game Topic</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The Future of AI"
              className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-amber-400 transition-shadow duration-200"
            />
          </div>
          <div>
            <label htmlFor="rounds" className="block text-sm font-medium text-gray-400 mb-2">Number of Rounds: <span className="font-bold text-white">{totalRounds}</span></label>
            <input
              id="rounds"
              type="range"
              min="1"
              max="10"
              value={totalRounds}
              onChange={(e) => setTotalRounds(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-400 mb-2">Time per Turn (seconds): <span className="font-bold text-white">{turnDuration}</span></label>
            <input
              id="duration"
              type="range"
              min="30"
              max="180"
              step="15"
              value={turnDuration}
              onChange={(e) => setTurnDuration(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
           <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-400">
              <span>Game Visibility</span>
              <div className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} className="sr-only peer" />
                <span className="text-sm font-medium text-gray-300 mr-3">{isPublic ? 'Public' : 'Private'}</span>
                <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </div>
            </label>
          </div>
        </div>
        
        <button
          onClick={handleCreateLobby}
          disabled={!isFormValid}
          className="w-full bg-gradient-to-r from-amber-600 via-purple-600 to-amber-600 bg-[length:200%_auto] hover:bg-[position:100%_0] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-purple-500 text-white font-bold py-3 px-4 rounded-lg text-lg transition-all duration-500 transform hover:scale-105 shadow-lg hover:shadow-purple-500/30 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {isFormValid ? 'Create Lobby' : 'Please enter a topic'}
        </button>
         <button onClick={onBack} className="w-full text-center text-sm text-gray-500 hover:text-gray-200 transition-colors pt-2">
            Back to Main Menu
        </button>
      </div>
    </div>
  );
};

export default GameSetup;