import React, { useState, useEffect } from 'react';
import { Player, TimelineEvent } from '../types';
import PlayerPanel from './PlayerPanel';
import TimelinePanel from './TimelinePanel';
import ControlsPanel from './ControlsPanel';
import ActiveTopicPanel from './ActiveTopicPanel';
import { verifyFact } from '../services/geminiService';
import { censorProfanity } from '../utils/profanityFilter';
import { logEvent } from '../utils/logger';
import { 
    LobbyState,
    addModerationNote,
    advanceRound,
    addTimelineEvent,
    assignViolation,
    awardScore,
    endGame,
    highlightTimelineEvent,
    removePlayer,
    revealQuestionFromBank,
    reviewAudioDraft,
    submitAudioDraft,
    sendMessage,
    startTurn,
    endTurn,
    pauseTurn,
    updateQuestionBank,
    updateTimelineSectionSummary,
    updateTrustedSources,
    useGreenIndicator,
    useLifeline,
} from '../services/mockApi';

interface GameScreenProps {
  lobbyState: LobbyState;
  localPlayer: Player;
  onExit: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ lobbyState, localPlayer, onExit }) => {
  const { code: gameCode, gameState, settings: gameSettings } = lobbyState;
  const [turnRemaining, setTurnRemaining] = useState<number>(gameState.turnRemainingSeconds ?? gameSettings.turnDuration);

  // Timer rendering logic
  useEffect(() => {
    let timerInterval: ReturnType<typeof setInterval> | undefined;

    if (!gameState.isTimerRunning) {
      setTurnRemaining(gameState.turnRemainingSeconds ?? gameSettings.turnDuration);
      return () => undefined;
    }

    if (gameState.turnStartTime) {
        const baseRemaining = gameState.turnRemainingSeconds ?? gameSettings.turnDuration;
        timerInterval = setInterval(() => {
            const elapsed = (Date.now() - gameState.turnStartTime) / 1000;
            const remaining = Math.max(0, baseRemaining - elapsed);
            setTurnRemaining(remaining);

            if (remaining === 0) {
                clearInterval(timerInterval);
            }
        }, 1000);
    }

    return () => clearInterval(timerInterval);
  }, [gameState.isTimerRunning, gameState.turnRemainingSeconds, gameState.turnStartTime, gameSettings.turnDuration]);

  const handleAddTimelineEvent = async (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => {
    try {
      await addTimelineEvent(gameCode, { ...event, text: censorProfanity(event.text) });
    } catch (error) {
      logEvent('error', 'game.addTimelineEvent.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleAssignViolation = async (targetPlayerId: string, type: 'red' | 'yellow', reason: string) => {
    try {
      await assignViolation(gameCode, {
        targetPlayerId,
        type,
        reason: censorProfanity(reason),
        assignerId: localPlayer.id
      });
    } catch (error) {
      logEvent('error', 'game.assignViolation.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        targetPlayerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  
  const handleSendMessage = async (text: string) => {
    try {
      await sendMessage(gameCode, {
          senderId: localPlayer.id,
          text: censorProfanity(text),
      });
    } catch (error) {
      logEvent('error', 'game.sendMessage.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleFactCheck = async (statement: string) => {
    try {
      await addTimelineEvent(gameCode, { type: 'FactCheck', text: `Fact-checking statement: "${statement}"`, playerId: localPlayer.id });
      const result = await verifyFact(statement);
      await addTimelineEvent(gameCode, { type: 'FactCheck', text: `Fact Check Result: ${result}`, playerId: 'system' });
    } catch (error) {
      logEvent('error', 'game.factCheck.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const handleStartTurn = async (speakerId: string) => {
    try {
      await startTurn(gameCode, speakerId);
    } catch (error) {
      logEvent('error', 'game.startTurn.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        speakerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleEndTurn = async () => {
    try {
      await endTurn(gameCode);
    } catch (error) {
      logEvent('error', 'game.endTurn.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handlePauseTurn = async (pause: boolean) => {
    try {
      await pauseTurn(gameCode, pause);
    } catch (error) {
      logEvent('error', 'game.pauseTurn.failed', {
        code: gameCode,
        playerId: localPlayer.id,
        pause,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
      if (window.confirm(`Are you sure you want to remove this player from the game?`)) {
          try {
              await removePlayer(gameCode, playerId);
          } catch (error) {
              logEvent('error', 'game.removePlayer.failed', {
                code: gameCode,
                removerId: localPlayer.id,
                playerId,
                error: error instanceof Error ? error.message : String(error),
              });
          }
      }
  };

  const localPlayerDetails = gameState.players.find(p => p.id === localPlayer.id);

  const handleUpdateQuestionBank = async (playerId: string, questions: string[]) => {
    try {
      await updateQuestionBank(gameCode, playerId, questions);
    } catch (error) {
      logEvent('error', 'game.updateQuestionBank.failed', {
        code: gameCode,
        playerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleRevealQuestion = async (playerId: string, questionId: string) => {
    try {
      await revealQuestionFromBank(gameCode, playerId, questionId);
    } catch (error) {
      logEvent('error', 'game.revealQuestion.failed', {
        code: gameCode,
        playerId,
        questionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleUpdateTrustedSources = async (playerId: string, sources: string[]) => {
    try {
      await updateTrustedSources(gameCode, playerId, sources);
    } catch (error) {
      logEvent('error', 'game.updateTrustedSources.failed', {
        code: gameCode,
        playerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleUseLifeline = async (payload: { playerId: string; type: 'AudienceOpinion' | 'TrustedSourcing' | 'RefsChoice'; selectedSource?: string; details?: string }) => {
    try {
      await useLifeline(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.useLifeline.failed', {
        code: gameCode,
        playerId: payload.playerId,
        type: payload.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleUseGreenIndicator = async (payload: { playerId: string; reason?: string }) => {
    try {
      await useGreenIndicator(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.useGreenIndicator.failed', {
        code: gameCode,
        playerId: payload.playerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleAddModerationNote = async (payload: { refereeId: string; text: string; shortcutKey?: string }) => {
    try {
      await addModerationNote(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.addModerationNote.failed', {
        code: gameCode,
        refereeId: payload.refereeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleAwardScore = async (payload: { playerId: string; points: number; reason: string; assignerId: string }) => {
    try {
      await awardScore(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.awardScore.failed', {
        code: gameCode,
        assignerId: payload.assignerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleAdvanceRound = async (timeKeeperId: string) => {
    try {
      await advanceRound(gameCode, timeKeeperId);
    } catch (error) {
      logEvent('error', 'game.advanceRound.failed', {
        code: gameCode,
        timeKeeperId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleEndGame = async (reason?: string) => {
    try {
      await endGame(gameCode, reason);
    } catch (error) {
      logEvent('error', 'game.endGame.failed', {
        code: gameCode,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleHighlightTimelineEvent = async (payload: { timeKeeperId: string; eventId: string; label: string }) => {
    try {
      await highlightTimelineEvent(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.highlightTimelineEvent.failed', {
        code: gameCode,
        timeKeeperId: payload.timeKeeperId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleUpdateSectionSummary = async (payload: { timeKeeperId: string; sectionId: string; summary: string }) => {
    try {
      await updateTimelineSectionSummary(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.updateSectionSummary.failed', {
        code: gameCode,
        timeKeeperId: payload.timeKeeperId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSubmitAudioDraft = async (payload: { playerId: string; transcript: string; audioBase64?: string }) => {
    try {
      await submitAudioDraft(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.submitAudioDraft.failed', {
        code: gameCode,
        playerId: payload.playerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleReviewAudioDraft = async (payload: { reviewerId: string; draftId: string; status: 'approved' | 'rejected'; reviewNote?: string }) => {
    try {
      await reviewAudioDraft(gameCode, payload);
    } catch (error) {
      logEvent('error', 'game.reviewAudioDraft.failed', {
        code: gameCode,
        reviewerId: payload.reviewerId,
        draftId: payload.draftId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <ActiveTopicPanel 
            topic={gameState.activeTopic} 
            question={gameState.activeQuestion} 
            round={gameState.currentRound}
            totalRounds={gameSettings.totalRounds}
            moderationNotes={gameState.moderationNotes}
            winner={gameState.winner}
        />
        <TimelinePanel 
            timeline={gameState.timeline} 
            players={gameState.players} 
            isViewer={false}
            timelineHighlights={gameState.timelineHighlights}
            timelineSections={gameState.timelineSections}
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
            timeline={gameState.timeline}
            timelineSections={gameState.timelineSections || []}
            audioDrafts={gameState.audioDrafts || []}
            onAddEvent={handleAddTimelineEvent}
            onFactCheck={handleFactCheck}
            onSendMessage={handleSendMessage}
            onAssignViolation={handleAssignViolation}
            onStartTurn={handleStartTurn}
            onEndTurn={handleEndTurn}
            onPauseTurn={handlePauseTurn}
            onUpdateQuestionBank={handleUpdateQuestionBank}
            onRevealQuestion={handleRevealQuestion}
            onUpdateTrustedSources={handleUpdateTrustedSources}
            onUseLifeline={handleUseLifeline}
            onUseGreenIndicator={handleUseGreenIndicator}
            onAddModerationNote={handleAddModerationNote}
            onAwardScore={handleAwardScore}
            onAdvanceRound={handleAdvanceRound}
            onEndGame={handleEndGame}
            onHighlightTimelineEvent={handleHighlightTimelineEvent}
            onUpdateSectionSummary={handleUpdateSectionSummary}
            onSubmitAudioDraft={handleSubmitAudioDraft}
            onReviewAudioDraft={handleReviewAudioDraft}
            isTurnActive={gameState.isTimerRunning}
            turnRemaining={turnRemaining}
            currentSpeakerId={gameState.speakerId}
            currentRound={gameState.currentRound}
            totalRounds={gameSettings.totalRounds}
            chatMessages={gameState.chatMessages}
            onExit={onExit}
        />
      </div>
    </div>
  );
};

export default GameScreen;
