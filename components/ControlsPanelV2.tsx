import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioDraft, AudienceChallenge, ChatMessage, LifelineType, Player, PromptCard, RefereeAction, TimelineEvent, TimelineSection } from '../types';
import { tightenTranscript } from '../services/geminiService';

interface ControlsPanelProps {
  localPlayer: Player | undefined;
  players: Player[];
  timeline: TimelineEvent[];
  timelineSections: TimelineSection[];
  audioDrafts: AudioDraft[];
  audienceChallenges: AudienceChallenge[];
  refereeActions: RefereeAction[];
  onAddEvent: (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => void;
  onFactCheck: (statement: string) => void;
  onSendMessage: (payload: { text: string; recipientId?: string; recipientLabel?: string }) => void;
  onAssignViolation: (targetPlayerId: string, type: 'red' | 'yellow', reason: string) => void;
  onStartTurn: (speakerId: string) => void;
  onEndTurn: (payload: { endedBy?: string; reasonCodes?: string[] }) => void;
  onPauseTurn: (pause: boolean) => void;
  onUpdatePromptCards: (playerId: string, cards: PromptCard[]) => void;
  onRevealQuestion: (playerId: string, questionId: string) => void;
  onUpdateTrustedSources: (playerId: string, sources: string[]) => void;
  onUseLifeline: (payload: { playerId: string; type: LifelineType; selectedSource?: string; details?: string }) => void;
  onUpdateMicState: (payload: { playerId: string; micLive: boolean; videoEnabled?: boolean }) => void;
  onSetRefereeMuteState: (payload: { refereeId: string; targetPlayerId: string; muted: boolean }) => void;
  onAddModerationNote: (payload: { refereeId: string; text: string; shortcutKey?: string }) => void;
  onAwardScore: (payload: { playerId: string; points: number; reason: string; assignerId: string }) => void;
  onAdvanceRound: (timeKeeperId: string) => void;
  onEndGame: (payload: { requestedBy?: string; reason?: string; reasonCodes?: string[] }) => void;
  onHighlightTimelineEvent: (payload: { timeKeeperId: string; eventId: string; label: string }) => void;
  onUpdateSectionSummary: (payload: { timeKeeperId: string; sectionId: string; summary: string }) => void;
  onSubmitAudioDraft: (payload: { playerId: string; transcript: string; audioBase64?: string }) => void;
  onReviewAudioDraft: (payload: { reviewerId: string; draftId: string; status: 'approved' | 'rejected'; reviewNote?: string }) => void;
  onUploadBackdrop: (playerId: string, file: File) => void;
  onSubmitAudienceChallenge: (payload: { challengerId: string; actionId: string; note?: string }) => void;
  isTurnActive: boolean;
  turnRemaining: number;
  currentSpeakerId: string | null;
  currentRound: number;
  totalRounds: number;
  chatMessages: ChatMessage[];
  onExit: () => void;
}

const TURN_REASON_OPTIONS = ['agree_to_disagree', 'i_agree_with_this_point', 'my_opinion_has_changed', 'need_to_end_turn'];
const GAME_REASON_OPTIONS = ['agree_to_disagree', 'i_agree_with_this_point', 'my_opinion_has_changed', 'need_to_end_talk'];
const MODERATION_SHORTCUTS = [
  { key: 'veer', text: 'You are veering away from the original question.' },
  { key: 'derogatory', text: 'That is derogatory language. Keep it respectful.' },
  { key: 'misleading', text: 'This appears to be misleading information. Verify or restate.' },
];

const speak = (text: string) => {
  if (!('speechSynthesis' in window) || !text.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
};

const ControlsPanelV2: React.FC<ControlsPanelProps> = ({
  localPlayer,
  players,
  timeline,
  timelineSections,
  audioDrafts,
  audienceChallenges,
  refereeActions,
  onAddEvent,
  onFactCheck,
  onSendMessage,
  onAssignViolation,
  onStartTurn,
  onEndTurn,
  onPauseTurn,
  onUpdatePromptCards,
  onRevealQuestion,
  onUpdateTrustedSources,
  onUseLifeline,
  onUpdateMicState,
  onSetRefereeMuteState,
  onAddModerationNote,
  onAwardScore,
  onAdvanceRound,
  onEndGame,
  onHighlightTimelineEvent,
  onUpdateSectionSummary,
  onSubmitAudioDraft,
  onReviewAudioDraft,
  onUploadBackdrop,
  onSubmitAudienceChallenge,
  isTurnActive,
  turnRemaining,
  currentSpeakerId,
  currentRound,
  totalRounds,
  chatMessages,
  onExit,
}) => {
  const [statement, setStatement] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatRecipientId, setChatRecipientId] = useState('');
  const [factCheckStatement, setFactCheckStatement] = useState('');
  const [violationTarget, setViolationTarget] = useState('');
  const [violationReason, setViolationReason] = useState('');
  const [turnTarget, setTurnTarget] = useState('');
  const [promptCards, setPromptCards] = useState<PromptCard[]>([]);
  const [trustedSourcesText, setTrustedSourcesText] = useState('');
  const [selectedTrustedSource, setSelectedTrustedSource] = useState('');
  const [lifelineDetails, setLifelineDetails] = useState('');
  const [moderationCustomNote, setModerationCustomNote] = useState('');
  const [awardTarget, setAwardTarget] = useState('');
  const [awardPoints, setAwardPoints] = useState(1);
  const [awardReason, setAwardReason] = useState('Verified and acknowledged');
  const [endGameReason, setEndGameReason] = useState('Manual game close');
  const [highlightEventId, setHighlightEventId] = useState('');
  const [highlightLabel, setHighlightLabel] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [sectionSummary, setSectionSummary] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | undefined>(undefined);
  const [turnReasons, setTurnReasons] = useState<string[]>([]);
  const [gameReasons, setGameReasons] = useState<string[]>([]);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [challengeNote, setChallengeNote] = useState('');
  const [draftReviewNotes, setDraftReviewNotes] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptAssistLoading, setTranscriptAssistLoading] = useState(false);
  const [transcriptAssistNote, setTranscriptAssistNote] = useState('');
  const [transcriptSuggestion, setTranscriptSuggestion] = useState<string | null>(null);
  const [redoCheckpoint, setRedoCheckpoint] = useState<{ prefix: string } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const transcriptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordingTranscriptPrefixRef = useRef('');
  const redoTranscriptUpdatedRef = useRef(false);

  useEffect(() => {
    if (!localPlayer) return;
    if (localPlayer.promptCards?.length) setPromptCards(localPlayer.promptCards);
    else if (localPlayer.questionBank?.length) {
      setPromptCards(localPlayer.questionBank.map((item) => ({
        id: item.id,
        text: item.text,
        kind: item.kind || 'question',
        used: Boolean(item.used),
        revealed: item.revealed,
        revealedAt: item.revealedAt,
        usedAt: item.usedAt ?? null,
      })));
    } else {
      setPromptCards([
        { id: 'local-1', text: '', kind: 'question', used: false, revealed: false, revealedAt: null, usedAt: null },
        { id: 'local-2', text: '', kind: 'statement', used: false, revealed: false, revealedAt: null, usedAt: null },
      ]);
    }
    if (localPlayer.trustedSources?.length) {
      setTrustedSourcesText(localPlayer.trustedSources.join('\n'));
      setSelectedTrustedSource(localPlayer.selectedTrustedSource || localPlayer.trustedSources[0] || '');
    }
  }, [localPlayer]);

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const conversationalists = useMemo(() => players.filter((player) => player.role === 'Conversationalist'), [players]);
  const pendingAudioDrafts = useMemo(() => audioDrafts.filter((draft) => draft.status === 'pending'), [audioDrafts]);
  const isModerator = localPlayer?.role === 'Referee' || localPlayer?.role === 'Time Keeper';
  const yellowRemaining = localPlayer?.indicators?.yellowRemaining ?? 0;
  const purpleRemaining = localPlayer?.indicators?.purpleRemaining ?? 0;
  const isMyTurn = localPlayer?.id === currentSpeakerId && isTurnActive && turnRemaining > 0;
  const refereeTarget = violationTarget ? playersById.get(violationTarget) : undefined;
  const canModerateTarget = refereeTarget?.role === 'Conversationalist';
  const canSendAudioDraft = Boolean(audioTranscript.trim()) && !redoCheckpoint;

  if (!localPlayer) return null;

  const toggleReason = (current: string[], reason: string) =>
    current.includes(reason) ? current.filter((entry) => entry !== reason) : [...current, reason];

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    const recipient = players.find((player) => player.id === chatRecipientId);
    onSendMessage({
      text: chatMessage.trim(),
      recipientId: chatRecipientId || undefined,
      recipientLabel: recipient?.name || undefined,
    });
    setChatMessage('');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || isRecording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const transcriptPrefix = redoCheckpoint?.prefix ?? '';
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const supportsSpeechRecognition = Boolean(SpeechRecognition);

    chunksRef.current = [];
    recordingTranscriptPrefixRef.current = transcriptPrefix;
    redoTranscriptUpdatedRef.current = false;
    setTranscriptSuggestion(null);
    setTranscriptAssistNote(redoCheckpoint
      ? 'Redo recording started. Repeat everything after the cut before sending.'
      : '');

    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      setAudioBase64(window.btoa(binary));
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      onUpdateMicState({ playerId: localPlayer.id, micLive: false });
      recognitionRef.current?.stop?.();

      if (redoCheckpoint) {
        if (!supportsSpeechRecognition || redoTranscriptUpdatedRef.current) {
          setRedoCheckpoint(null);
          setTranscriptAssistNote('Redo captured. Review the transcript, then send it to the referee.');
        } else {
          setTranscriptAssistNote('The transcript was chopped. Repeat after the cut before sending.');
        }
      }
    };
    recorder.start();
    setIsRecording(true);
    onUpdateMicState({ playerId: localPlayer.id, micLive: true });

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        const liveTranscript = Array.from(event.results)
          .map((result: any) => result[0]?.transcript || '')
          .join(' ')
          .trim();
        const transcript = [recordingTranscriptPrefixRef.current, liveTranscript]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        setAudioTranscript(transcript);
        if (redoCheckpoint && transcript.length > recordingTranscriptPrefixRef.current.trim().length) {
          redoTranscriptUpdatedRef.current = true;
        }
      };
      recognition.start();
      recognitionRef.current = recognition;
    }
  };

  const stopRecording = () => recorderRef.current?.stop();

  const handleAudioTranscriptChange = (value: string) => {
    setAudioTranscript(value);
    setTranscriptSuggestion(null);
    if (audioBase64) {
      setAudioBase64(undefined);
    }
  };

  const handleChopTranscript = () => {
    const transcript = audioTranscript.trimEnd();
    if (!transcript) return;

    const textarea = transcriptTextareaRef.current;
    const rawCutIndex = textarea?.selectionStart ?? transcript.length;
    const cutIndex = Math.max(0, Math.min(rawCutIndex, transcript.length));
    const choppedTranscript = transcript.slice(0, cutIndex).trimEnd();

    if (choppedTranscript.length >= transcript.length) {
      setTranscriptAssistNote('Move the cursor earlier in the transcript to chop the response.');
      return;
    }

    setAudioTranscript(choppedTranscript);
    setAudioBase64(undefined);
    setTranscriptSuggestion(null);
    setRedoCheckpoint({ prefix: choppedTranscript });
    setTranscriptAssistNote('Transcript chopped. Start mic and repeat anything after the cut before sending.');

    requestAnimationFrame(() => {
      transcriptTextareaRef.current?.focus();
      const position = choppedTranscript.length;
      transcriptTextareaRef.current?.setSelectionRange(position, position);
    });
  };

  const handleGeminiTighten = async () => {
    const transcript = audioTranscript.trim();
    if (!transcript || transcriptAssistLoading) return;

    setTranscriptAssistLoading(true);
    setTranscriptSuggestion(null);
    const result = await tightenTranscript(transcript);
    setTranscriptAssistLoading(false);
    setTranscriptAssistNote(result.note);

    if (result.suggestion && result.suggestion.trim() !== transcript) {
      setTranscriptSuggestion(result.suggestion.trim());
    }
  };

  const applyTranscriptSuggestion = () => {
    if (!transcriptSuggestion) return;
    setAudioTranscript(transcriptSuggestion);
    setAudioBase64(undefined);
    setTranscriptAssistNote('Gemini suggestion applied. Review it before sending.');
    setTranscriptSuggestion(null);
  };

  const renderReasonToggles = (options: string[], selected: string[], onToggle: (next: string[]) => void) => (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onToggle(toggleReason(selected, option))}
          className={`rounded px-3 py-2 text-xs font-semibold ${selected.includes(option) ? 'bg-amber-600 text-black' : 'bg-black/30 text-gray-200'}`}
        >
          {option.replaceAll('_', ' ')}
        </button>
      ))}
    </div>
  );

  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl flex-grow flex flex-col gap-4">
      <h2 className="text-3xl font-bold border-b border-white/10 pb-2 font-display">Controls</h2>

      {localPlayer.role === 'Conversationalist' && (
        <>
          <textarea value={statement} onChange={(e) => setStatement(e.target.value)} disabled={!isMyTurn} className="w-full min-h-[100px] rounded-lg bg-black/40 border border-gray-600 px-4 py-3 text-white" placeholder={isMyTurn ? 'Respond or present your point...' : 'Waiting for your turn...'} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => statement.trim() && onAddEvent({ type: 'Answer', text: statement.trim(), playerId: localPlayer.id })} disabled={!statement.trim() || !isMyTurn} className="rounded-lg bg-green-700 py-2 font-bold text-white disabled:bg-gray-700">Submit Statement</button>
            <button onClick={() => statement.trim() && onAddEvent({ type: 'Question', text: statement.trim(), playerId: localPlayer.id })} disabled={!statement.trim() || !isMyTurn} className="rounded-lg bg-indigo-700 py-2 font-bold text-white disabled:bg-gray-700">Ask Question</button>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Prompt Cards</h4>
            {promptCards.map((card, index) => (
              <div key={card.id || index} className="grid grid-cols-[1fr_auto_auto] gap-2">
                <input value={card.text} onChange={(e) => setPromptCards((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, text: e.target.value } : entry))} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white" />
                <select value={card.kind} onChange={(e) => setPromptCards((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, kind: e.target.value as PromptCard['kind'] } : entry))} className="rounded bg-black/40 border border-gray-600 px-2 text-sm text-white">
                  <option value="question">Question</option>
                  <option value="statement">Statement</option>
                </select>
                <button onClick={() => onRevealQuestion(localPlayer.id, card.id)} disabled={card.revealed} className="rounded bg-indigo-700 px-3 text-xs font-bold text-white disabled:bg-gray-700">{card.revealed ? 'Used' : 'Use'}</button>
              </div>
            ))}
            <button onClick={() => onUpdatePromptCards(localPlayer.id, promptCards)} className="w-full rounded bg-indigo-700 py-2 font-bold text-white">Save Prompt Cards</button>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Trusted Sources</h4>
            <textarea value={trustedSourcesText} onChange={(e) => setTrustedSourcesText(e.target.value)} className="w-full min-h-[80px] rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white" />
            <button onClick={() => onUpdateTrustedSources(localPlayer.id, trustedSourcesText.split('\n').map((line) => line.trim()).filter(Boolean))} className="w-full rounded bg-cyan-700 py-2 font-bold text-white">Save Sources</button>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Lifelines</h4>
            <p className="text-xs text-yellow-200">Yellow slots left this round: {yellowRemaining}</p>
            <select value={selectedTrustedSource} onChange={(e) => setSelectedTrustedSource(e.target.value)} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white">
              {(localPlayer.trustedSources || []).map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            <input value={lifelineDetails} onChange={(e) => setLifelineDetails(e.target.value)} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white" placeholder="Optional context" />
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => onUseLifeline({ playerId: localPlayer.id, type: 'AudienceOpinion', details: lifelineDetails || undefined })} disabled={yellowRemaining <= 0} className="rounded bg-yellow-700 py-2 font-bold text-white disabled:bg-gray-700">Audience Opinion</button>
              <button onClick={() => onUseLifeline({ playerId: localPlayer.id, type: 'TrustedSourcing', selectedSource: selectedTrustedSource, details: lifelineDetails || undefined })} disabled={yellowRemaining <= 0} className="rounded bg-yellow-700 py-2 font-bold text-white disabled:bg-gray-700">Trusted Sourcing</button>
              <button onClick={() => onUseLifeline({ playerId: localPlayer.id, type: 'RefsChoice', details: lifelineDetails || undefined })} disabled={yellowRemaining <= 0} className="rounded bg-yellow-700 py-2 font-bold text-white disabled:bg-gray-700">Ref&apos;s Choice</button>
            </div>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Backdrop</h4>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && onUploadBackdrop(localPlayer.id, e.target.files[0])} className="w-full text-sm text-gray-200" />
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Voice Response</h4>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={startRecording} disabled={isRecording} className="rounded bg-sky-700 py-2 font-bold text-white disabled:bg-gray-700">Start Mic</button>
              <button onClick={stopRecording} disabled={!isRecording} className="rounded bg-sky-900 py-2 font-bold text-white disabled:bg-gray-700">Stop</button>
            </div>
            <textarea ref={transcriptTextareaRef} value={audioTranscript} onChange={(e) => handleAudioTranscriptChange(e.target.value)} className="w-full min-h-[90px] rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white" placeholder="Live transcript appears here before submit" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleChopTranscript} disabled={!audioTranscript.trim() || isRecording} className="rounded bg-amber-700 py-2 font-bold text-white disabled:bg-gray-700">Chop at Cursor</button>
              <button onClick={handleGeminiTighten} disabled={!audioTranscript.trim() || isRecording || transcriptAssistLoading} className="rounded bg-cyan-700 py-2 font-bold text-white disabled:bg-gray-700">{transcriptAssistLoading ? 'Gemini Working...' : 'Gemini Tighten'}</button>
            </div>
            {transcriptAssistNote && (
              <p className={`text-xs ${redoCheckpoint ? 'text-amber-200' : 'text-cyan-100'}`}>{transcriptAssistNote}</p>
            )}
            {transcriptSuggestion && (
              <div className="rounded border border-cyan-400/40 bg-cyan-950/30 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Gemini Suggestion</p>
                <p className="text-sm text-white">{transcriptSuggestion}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={applyTranscriptSuggestion} className="rounded bg-cyan-700 py-2 font-bold text-white">Use Suggestion</button>
                  <button onClick={() => setTranscriptSuggestion(null)} className="rounded bg-slate-700 py-2 font-bold text-white">Dismiss</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => speak(audioTranscript)} disabled={!audioTranscript.trim()} className="rounded bg-emerald-700 py-2 font-bold text-white disabled:bg-gray-700">Preview Voice</button>
              <button onClick={() => audioTranscript.trim() && onSubmitAudioDraft({ playerId: localPlayer.id, transcript: audioTranscript.trim(), audioBase64 })} disabled={!canSendAudioDraft} className="rounded bg-indigo-700 py-2 font-bold text-white disabled:bg-gray-700">Send to Referee</button>
            </div>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">End Turn</h4>
            {renderReasonToggles(TURN_REASON_OPTIONS, turnReasons, setTurnReasons)}
            <button onClick={() => onEndTurn({ endedBy: localPlayer.id, reasonCodes: turnReasons })} className="w-full rounded bg-red-700 py-2 font-bold text-white">End My Turn</button>
          </div>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Audience Review</h4>
            <p className="text-xs text-purple-200">Purple review tokens left: {purpleRemaining}</p>
            <select value={selectedActionId} onChange={(e) => setSelectedActionId(e.target.value)} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white">
              <option value="">Choose referee action</option>
              {refereeActions.map((action) => <option key={action.id} value={action.id}>{action.type} · {action.id}</option>)}
            </select>
            <input value={challengeNote} onChange={(e) => setChallengeNote(e.target.value)} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white" placeholder="Why should the audience review this?" />
            <button onClick={() => selectedActionId && onSubmitAudienceChallenge({ challengerId: localPlayer.id, actionId: selectedActionId, note: challengeNote || undefined })} disabled={!selectedActionId || purpleRemaining <= 0} className="w-full rounded bg-purple-700 py-2 font-bold text-white disabled:bg-gray-700">Send to Audience Review</button>
          </div>
        </>
      )}

      {localPlayer.role === 'Referee' && (
        <>
          <select value={violationTarget} onChange={(e) => setViolationTarget(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white">
            <option value="">Select player</option>
            {players.filter((player) => player.id !== localPlayer.id).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.role || 'No role'}</option>)}
          </select>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Realtime Mic Control</h4>
            <p className="text-xs text-gray-400">
              {canModerateTarget
                ? `${refereeTarget?.name} is ${refereeTarget?.presence?.mutedByReferee ? 'currently muted by the referee.' : 'currently allowed to use live mic.'}`
                : 'Select a conversationalist to mute or restore their live mic.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => violationTarget && onSetRefereeMuteState({ refereeId: localPlayer.id, targetPlayerId: violationTarget, muted: true })}
                disabled={!canModerateTarget || refereeTarget?.presence?.mutedByReferee}
                className="rounded bg-red-800 py-2 font-bold text-white disabled:bg-gray-700"
              >
                Mute Mic
              </button>
              <button
                type="button"
                onClick={() => violationTarget && onSetRefereeMuteState({ refereeId: localPlayer.id, targetPlayerId: violationTarget, muted: false })}
                disabled={!canModerateTarget || !refereeTarget?.presence?.mutedByReferee}
                className="rounded bg-emerald-700 py-2 font-bold text-white disabled:bg-gray-700"
              >
                Restore Mic
              </button>
            </div>
          </div>
          <textarea value={violationReason} onChange={(e) => setViolationReason(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Reason for flag" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => violationTarget && violationReason && onAssignViolation(violationTarget, 'yellow', violationReason)} className="rounded bg-yellow-600 py-2 font-bold text-black">Yellow Flag</button>
            <button onClick={() => violationTarget && violationReason && onAssignViolation(violationTarget, 'red', violationReason)} className="rounded bg-red-700 py-2 font-bold text-white">Red Flag</button>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
            <h4 className="font-bold text-gray-200">Quick Referee Notes</h4>
            {MODERATION_SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.key}
                type="button"
                onClick={() => onAddModerationNote({ refereeId: localPlayer.id, text: shortcut.text, shortcutKey: shortcut.key })}
                className="w-full rounded bg-red-800/70 px-3 py-2 text-left text-sm font-semibold text-white hover:bg-red-700"
              >
                {shortcut.text}
              </button>
            ))}
          </div>
          <input value={moderationCustomNote} onChange={(e) => setModerationCustomNote(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Broadcast note to main screen" />
          <button onClick={() => moderationCustomNote.trim() && onAddModerationNote({ refereeId: localPlayer.id, text: moderationCustomNote.trim() })} className="rounded bg-red-700 py-2 font-bold text-white">Send Moderation Note</button>
          <input value={factCheckStatement} onChange={(e) => setFactCheckStatement(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Fact check statement" />
          <button onClick={() => factCheckStatement.trim() && onFactCheck(factCheckStatement.trim())} className="rounded bg-amber-700 py-2 font-bold text-white">Fact Check</button>
          {pendingAudioDrafts.map((draft) => (
            <div key={draft.id} className="rounded-lg border border-white/10 p-3 space-y-2">
              <p className="text-sm text-gray-100"><strong>{playersById.get(draft.playerId)?.name}</strong>: {draft.transcript}</p>
              <input value={draftReviewNotes[draft.id] || ''} onChange={(e) => setDraftReviewNotes((current) => ({ ...current, [draft.id]: e.target.value }))} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-sm text-white" placeholder="Review note" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onReviewAudioDraft({ reviewerId: localPlayer.id, draftId: draft.id, status: 'approved', reviewNote: draftReviewNotes[draft.id] })} className="rounded bg-emerald-700 py-2 font-bold text-white">Approve</button>
                <button onClick={() => onReviewAudioDraft({ reviewerId: localPlayer.id, draftId: draft.id, status: 'rejected', reviewNote: draftReviewNotes[draft.id] })} className="rounded bg-red-700 py-2 font-bold text-white">Reject</button>
              </div>
            </div>
          ))}
          <select value={awardTarget} onChange={(e) => setAwardTarget(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white">
            <option value="">Select player to score</option>
            {conversationalists.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          <input type="number" value={awardPoints} onChange={(e) => setAwardPoints(Number(e.target.value))} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" />
          <input value={awardReason} onChange={(e) => setAwardReason(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" />
          <button onClick={() => awardTarget && onAwardScore({ playerId: awardTarget, points: awardPoints, reason: awardReason, assignerId: localPlayer.id })} className="rounded bg-emerald-700 py-2 font-bold text-white">Award Score</button>
        </>
      )}

      {localPlayer.role === 'Time Keeper' && (
        <>
          <div className="rounded-lg bg-black/20 border border-white/10 p-3 text-center">
            <p className="text-5xl font-mono font-black text-white">{Math.floor(turnRemaining / 60).toString().padStart(2, '0')}:{Math.floor(turnRemaining % 60).toString().padStart(2, '0')}</p>
          </div>
          <select value={turnTarget} onChange={(e) => setTurnTarget(e.target.value)} disabled={isTurnActive} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white">
            <option value="">Select speaker</option>
            {conversationalists.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => turnTarget && onStartTurn(turnTarget)} disabled={!turnTarget || isTurnActive} className="rounded bg-purple-700 py-2 font-bold text-white disabled:bg-gray-700">Start Turn</button>
            <button onClick={() => onEndTurn({})} disabled={!isTurnActive} className="rounded bg-red-700 py-2 font-bold text-white disabled:bg-gray-700">End Turn</button>
          </div>
          <button onClick={() => onPauseTurn(isTurnActive)} disabled={!currentSpeakerId} className="rounded bg-yellow-600 py-2 font-bold text-black disabled:bg-gray-700 disabled:text-white">{isTurnActive ? 'Pause' : 'Resume'}</button>
          <button onClick={() => onAdvanceRound(localPlayer.id)} disabled={currentRound >= totalRounds} className="rounded bg-cyan-700 py-2 font-bold text-white disabled:bg-gray-700">Advance Round ({currentRound}/{totalRounds})</button>
          <select value={highlightEventId} onChange={(e) => setHighlightEventId(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white">
            <option value="">Select timeline event</option>
            {timeline.slice(-40).map((event) => <option key={event.id} value={event.id}>{event.type} · {event.text.slice(0, 60)}</option>)}
          </select>
          <input value={highlightLabel} onChange={(e) => setHighlightLabel(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Highlight label" />
          <button onClick={() => highlightEventId && highlightLabel && onHighlightTimelineEvent({ timeKeeperId: localPlayer.id, eventId: highlightEventId, label: highlightLabel })} className="rounded bg-cyan-700 py-2 font-bold text-white">Highlight</button>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white">
            <option value="">Select section</option>
            {timelineSections.map((section) => <option key={section.id} value={section.id}>{playersById.get(section.speakerId)?.name} · {Math.round(section.durationSeconds)}s</option>)}
          </select>
          <textarea value={sectionSummary} onChange={(e) => setSectionSummary(e.target.value)} className="rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Section summary" />
          <button onClick={() => sectionId && onUpdateSectionSummary({ timeKeeperId: localPlayer.id, sectionId, summary: sectionSummary })} className="rounded bg-teal-700 py-2 font-bold text-white">Save Summary</button>
        </>
      )}

      <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
        <h4 className="font-bold text-gray-200">Public Accountability Chat</h4>
        <select value={chatRecipientId} onChange={(e) => setChatRecipientId(e.target.value)} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-white">
          <option value="">Address everyone</option>
          {players.filter((player) => player.id !== localPlayer.id).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
        <div className="max-h-36 overflow-y-auto space-y-2 rounded bg-black/30 p-2">
          {chatMessages.map((msg) => (
            <div key={msg.id} className="rounded bg-gray-800/70 px-3 py-2 text-sm text-gray-100">
              <strong>{playersById.get(msg.senderId)?.name || 'System'}</strong>
              {msg.recipientLabel ? <span className="text-cyan-300"> → {msg.recipientLabel}</span> : <span className="text-amber-300"> → All</span>}
              <span>: {msg.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} className="flex-1 rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Message everyone can see..." />
          <button onClick={handleSendChat} className="rounded bg-purple-700 px-4 font-bold text-white">Send</button>
        </div>
      </div>

      <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
        <h4 className="font-bold text-gray-200">End T.A.L.K</h4>
        {renderReasonToggles(GAME_REASON_OPTIONS, gameReasons, setGameReasons)}
        <input value={endGameReason} onChange={(e) => setEndGameReason(e.target.value)} className="w-full rounded bg-black/40 border border-gray-600 px-3 py-2 text-white" placeholder="Why are you ending the TALK?" />
        <button onClick={() => onEndGame({ requestedBy: localPlayer.id, reason: endGameReason, reasonCodes: gameReasons })} className="w-full rounded bg-red-800 py-2 font-bold text-white">End T.A.L.K</button>
      </div>

      {audienceChallenges.length > 0 && (
        <div className="rounded-lg bg-black/20 border border-white/10 p-3 space-y-2">
          <h4 className="font-bold text-gray-200">Audience Challenges</h4>
          {audienceChallenges.slice(-5).map((challenge) => (
            <div key={challenge.id} className="rounded bg-black/30 px-3 py-2 text-sm text-gray-100">
              <strong>{challenge.challengerName}</strong> · {challenge.status} · {Object.keys(challenge.votes).length} vote(s)
            </div>
          ))}
        </div>
      )}

      <button onClick={onExit} className="w-full rounded-lg bg-red-800/70 py-2 font-bold text-white">Exit Game</button>
    </div>
  );
};

export default ControlsPanelV2;
