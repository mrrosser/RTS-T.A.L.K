import React from 'react';
import { Viewer } from '../types';
import { LobbyState } from '../services/mockApi';
import ActiveTopicPanel from './ActiveTopicPanel';
import TimelinePanel from './TimelinePanel';
import PlayerPanel from './PlayerPanel';

interface ViewerScreenProps {
    lobbyState: LobbyState;
    localViewer: Viewer;
    onExit: () => void;
}

const ViewerScreen: React.FC<ViewerScreenProps> = ({ lobbyState, localViewer, onExit }) => {
    const { gameState, code: gameCode, players } = lobbyState;

    if (!gameState) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <p className="text-white text-xl animate-pulse">Loading conversation...</p>
            </div>
        );
    }
    
    // Create a dummy player object for PlayerPanel's prop requirement
    const dummyPlayer = { id: localViewer.id, name: localViewer.name, role: null, violations: { red: 0, yellow: 0, green: 0 }};

    return (
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
                <ActiveTopicPanel 
                    topic={gameState.activeTopic} 
                    question={gameState.activeQuestion} 
                    round={gameState.currentRound}
                    totalRounds={gameState.gameSettings.totalRounds}
                />
                <TimelinePanel 
                    gameCode={gameCode}
                    timeline={gameState.timeline} 
                    players={players}
                    isViewer={true}
                    localUserId={localViewer.id}
                />
            </div>
            <div className="flex flex-col gap-6">
                <PlayerPanel 
                    players={players} 
                    localPlayer={dummyPlayer} // Pass dummy player
                    currentSpeakerId={gameState.speakerId} 
                    onRemovePlayer={() => {}} // No-op for viewers
                />
                 <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl text-center">
                    <h2 className="text-3xl font-bold font-display text-gray-200">Spectator Mode</h2>
                    <p className="text-gray-400 mt-2">You are viewing the conversation. Use the vote buttons on statements in the Convo-Line to suggest a fact-check to the Referee.</p>
                     <button onClick={onExit} className="w-full mt-4 bg-red-800/70 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                        Exit
                    </button>
                 </div>
            </div>
        </div>
    );
};

export default ViewerScreen;