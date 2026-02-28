import React, { useState, useEffect } from 'react';
// Fix: Import TimelineEvent to use in type annotations.
import { Player, TimelineEvent } from '../types';
import PlayerPanel from './PlayerPanel';
import TimelinePanel from './TimelinePanel';
import ControlsPanel from './ControlsPanel';
import ActiveTopicPanel from './ActiveTopicPanel';
import { verifyFact } from '../services/geminiService';
import { censorProfanity } from '../utils/profanityFilter';
import { 
    LobbyState,
    addTimelineEvent,
    assignViolation,
    removePlayer,
    sendMessage,
    startTurn,
    endTurn,
    pauseTurn
} from '../services/mockApi';

interface GameScreenProps {
  lobbyState: LobbyState;
  localPlayer: Player;
  onExit: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ lobbyState, localPlayer, onExit }) => {
  const { code: gameCode, gameState, settings: gameSettings } = lobbyState;
  const [turnRemaining, setTurnRemaining] = useState<number>(gameSettings.turnDuration);

  // Timer rendering logic
  useEffect(() => {
    let timerInterval: ReturnType<typeof setInterval> | undefined;
    if (gameState.isTimerRunning && gameState.turnStartTime) {
        timerInterval = setInterval(() => {
            const elapsed = (Date.now() - gameState.turnStartTime!) / 1000;
            const remaining = Math.max(0, gameSettings.turnDuration - elapsed);
            setTurnRemaining(remaining);

            if (remaining === 0) {
                // The server/polling logic will handle adding the 'TurnEnd' event
                // and updating the timer state.
                clearInterval(timerInterval);
            }
        }, 1000);
    } else if (!gameState.isTimerRunning) {
        setTurnRemaining(gameSettings.turnDuration);
    }
    return () => clearInterval(timerInterval);
  }, [gameState.isTimerRunning, gameState.turnStartTime, gameSettings.turnDuration]);


  // Fix: Corrected Dito.TimelineEvent to TimelineEvent.
  const handleAddTimelineEvent = async (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => {
    await addTimelineEvent(gameCode, { ...event, text: censorProfanity(event.text) });
  };

  const handleAssignViolation = async (targetPlayerId: string, type: 'red' | 'yellow', reason: string) => {
    await assignViolation(gameCode, {
        targetPlayerId,
        type,
        reason: censorProfanity(reason),
        assignerId: localPlayer.id
    });
  };
  
  const handleSendMessage = async (text: string) => {
    await sendMessage(gameCode, {
        senderId: localPlayer.id,
        text: censorProfanity(text),
    });
  };

  const handleFactCheck = async (statement: string) => {
    await addTimelineEvent(gameCode, { type: 'FactCheck', text: `Fact-checking statement: "${statement}"`, playerId: localPlayer.id });
    const result = await verifyFact(statement);
    await addTimelineEvent(gameCode, { type: 'FactCheck', text: `Fact Check Result: ${result}`, playerId: 'system' });
  }

  const handleStartTurn = (speakerId: string) => startTurn(gameCode, speakerId);
  const handleEndTurn = () => endTurn(gameCode);
  const handlePauseTurn = (pause: boolean) => pauseTurn(gameCode, pause);

  const handleRemovePlayer = async (playerId: string) => {
      if (window.confirm(`Are you sure you want to remove this player from the game?`)) {
          try {
              await removePlayer(gameCode, playerId);
          } catch (e) {
              alert(e instanceof Error ? e.message : "Failed to remove player.");
          }
      }
  };

  const localPlayerDetails = gameState.players.find(p => p.id === localPlayer.id);

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <ActiveTopicPanel 
            topic={gameState.activeTopic} 
            question={gameState.activeQuestion} 
            round={gameState.currentRound}
            totalRounds={gameSettings.totalRounds}
        />
        <TimelinePanel 
            timeline={gameState.timeline} 
            players={gameState.players} 
            isViewer={false}
        />
      </div>
      <div className="flex flex-col gap-6">
        <PlayerPanel 
            players={gameState.players} 
            localPlayer={localPlayer} 
            currentSpeakerId={gameState.speakerId} 
            onRemovePlayer={handleRemovePlayer}
        />
        <ControlsPanel 
            localPlayer={localPlayerDetails}
            players={gameState.players}
            onAddEvent={handleAddTimelineEvent}
            onFactCheck={handleFactCheck}
            onSendMessage={handleSendMessage}
            onAssignViolation={handleAssignViolation}
            onStartTurn={handleStartTurn}
            onEndTurn={handleEndTurn}
            onPauseTurn={handlePauseTurn}
            isTurnActive={gameState.isTimerRunning}
            turnRemaining={turnRemaining}
            currentSpeakerId={gameState.speakerId}
            chatMessages={gameState.chatMessages}
            onExit={onExit}
        />
      </div>
    </div>
  );
};

export default GameScreen;