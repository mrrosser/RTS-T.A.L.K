import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AudioDraft, ChatMessage, LifelineType, Player, TimelineEvent, TimelineSection } from '../types';

interface ControlsPanelProps {
  localPlayer: Player | undefined;
  players: Player[];
  timeline: TimelineEvent[];
  timelineSections: TimelineSection[];
  audioDrafts: AudioDraft[];
  onAddEvent: (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => void;
  onFactCheck: (statement: string) => void;
  onSendMessage: (text: string) => void;
  onAssignViolation: (targetPlayerId: string, type: 'red' | 'yellow', reason: string) => void;
  onStartTurn: (speakerId: string) => void;
  onEndTurn: () => void;
  onPauseTurn: (pause: boolean) => void;
  onUpdateQuestionBank: (playerId: string, questions: string[]) => void;
  onRevealQuestion: (playerId: string, questionId: string) => void;
  onUpdateTrustedSources: (playerId: string, sources: string[]) => void;
  onUseLifeline: (payload: { playerId: string; type: LifelineType; selectedSource?: string; details?: string }) => void;
  onUseGreenIndicator: (payload: { playerId: string; reason?: string }) => void;
  onAddModerationNote: (payload: { refereeId: string; text: string; shortcutKey?: string }) => void;
  onAwardScore: (payload: { playerId: string; points: number; reason: string; assignerId: string }) => void;
  onAdvanceRound: (timeKeeperId: string) => void;
  onEndGame: (reason?: string) => void;
  onHighlightTimelineEvent: (payload: { timeKeeperId: string; eventId: string; label: string }) => void;
  onUpdateSectionSummary: (payload: { timeKeeperId: string; sectionId: string; summary: string }) => void;
  onSubmitAudioDraft: (payload: { playerId: string; transcript: string; audioBase64?: string }) => void;
  onReviewAudioDraft: (payload: { reviewerId: string; draftId: string; status: 'approved' | 'rejected'; reviewNote?: string }) => void;
  isTurnActive: boolean;
  turnRemaining: number;
  currentSpeakerId: string | null;
  currentRound: number;
  totalRounds: number;
  chatMessages: ChatMessage[];
  onExit: () => void;
}

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

const ControlsPanel: React.FC<ControlsPanelProps> = ({
  localPlayer,
  players,
  timeline,
  timelineSections,
  audioDrafts,
  onAddEvent,
  onFactCheck,
  onSendMessage,
  onAssignViolation,
  onStartTurn,
  onEndTurn,
  onPauseTurn,
  onUpdateQuestionBank,
  onRevealQuestion,
  onUpdateTrustedSources,
  onUseLifeline,
  onUseGreenIndicator,
  onAddModerationNote,
  onAwardScore,
  onAdvanceRound,
  onEndGame,
  onHighlightTimelineEvent,
  onUpdateSectionSummary,
  onSubmitAudioDraft,
  onReviewAudioDraft,
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
  const [factCheckStatement, setFactCheckStatement] = useState('');
  const [violationTarget, setViolationTarget] = useState('');
  const [violationReason, setViolationReason] = useState('');
  const [turnTarget, setTurnTarget] = useState('');
  const [questionDrafts, setQuestionDrafts] = useState<string[]>(['', '', '']);
  const [trustedSourcesText, setTrustedSourcesText] = useState('');
  const [selectedTrustedSource, setSelectedTrustedSource] = useState('');
  const [lifelineDetails, setLifelineDetails] = useState('');
  const [greenReason, setGreenReason] = useState('');
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
  const [isRecording, setIsRecording] = useState(false);
  const [draftReviewNotes, setDraftReviewNotes] = useState<Record<string, string>>({});

  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    const fromBank = localPlayer?.questionBank?.map((entry) => entry.text);
    if (fromBank?.length) setQuestionDrafts(fromBank);
    if (localPlayer?.trustedSources?.length) {
      setTrustedSourcesText(localPlayer.trustedSources.join('\n'));
      setSelectedTrustedSource(localPlayer.selectedTrustedSource || localPlayer.trustedSources[0] || '');
    }
  }, [localPlayer?.id, localPlayer?.questionBank, localPlayer?.trustedSources, localPlayer?.selectedTrustedSource]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  if (!localPlayer) return null;

  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const conversationalists = useMemo(() => players.filter((player) => player.role === 'Conversationalist'), [players]);
  const pendingAudioDrafts = useMemo(() => audioDrafts.filter((draft) => draft.status === 'pending'), [audioDrafts]);
  const localPendingDraft = useMemo(() => audioDrafts.filter((draft) => draft.playerId === localPlayer.id).slice(-1)[0], [audioDrafts, localPlayer.id]);

  const isModerator = localPlayer.role === 'Referee' || localPlayer.role === 'Time Keeper';
  const visibleMessages = useMemo(() => chatMessages.filter((msg) => {
    if (isModerator) return true;
    const sender = playersById.get(msg.senderId);
    if (!sender) return false;
    return sender.role === 'Referee' || msg.senderId === localPlayer.id;
  }), [chatMessages, isModerator, localPlayer.id, playersById]);

  const canEditQuestionCount = !(localPlayer.questionBank && localPlayer.questionBank.length > 0);
  const lifelines = localPlayer.lifelines || { round: currentRound, AudienceOpinion: false, TrustedSourcing: false, RefsChoice: false };
  const yellowRemaining = localPlayer.indicators?.yellowRemaining ?? 0;
  const greenRemaining = localPlayer.indicators?.greenRemaining ?? 0;
  const isMyTurn = localPlayer.id === currentSpeakerId && isTurnActive && turnRemaining > 0;

  const setQuestionAt = (index: number, value: string) => setQuestionDrafts((current) => current.map((item, i) => (i === index ? value : item)));

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    onSendMessage(chatMessage.trim());
    setChatMessage('');
  };

  const handleAddEvent = (type: 'Answer' | 'Question') => {
    if (!statement.trim()) return;
    onAddEvent({ type, text: statement.trim(), playerId: localPlayer.id });
    setStatement('');
  };

  const handleSaveQuestionBank = () => {
    const questions = questionDrafts.map((q) => q.trim()).filter(Boolean);
    if (questions.length === 0) return;
    onUpdateQuestionBank(localPlayer.id, questions);
  };

  const handleSaveTrustedSources = () => {
    const sources = trustedSourcesText.split('\n').map((line) => line.trim()).filter(Boolean);
    if (sources.length < 3) return;
    onUpdateTrustedSources(localPlayer.id, sources);
  };

  const handleUseLifeline = (type: LifelineType) => {
    onUseLifeline({
      playerId: localPlayer.id,
      type,
      selectedSource: type === 'TrustedSourcing' ? selectedTrustedSource || undefined : undefined,
      details: lifelineDetails || undefined,
    });
    setLifelineDetails('');
  };

  const handleUseGreenIndicator = () => {
    onUseGreenIndicator({ playerId: localPlayer.id, reason: greenReason || undefined });
    setGreenReason('');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || isRecording) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
      setAudioBase64(window.btoa(binary));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsRecording(false);
    };
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => recorderRef.current?.stop();

  const submitAudioDraft = () => {
    if (!audioTranscript.trim()) return;
    onSubmitAudioDraft({ playerId: localPlayer.id, transcript: audioTranscript.trim(), audioBase64 });
    setAudioTranscript('');
    setAudioBase64(undefined);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const questions = localPlayer.questionBank || [];

  const renderConversationalistControls = () => (
    <div className="space-y-4">
      <textarea
        value={statement}
        onChange={(event) => setStatement(event.target.value)}
        placeholder={isMyTurn ? 'Enter your statement or question...' : 'Waiting for your turn...'}
        disabled={!isMyTurn}
        className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 min-h-[100px] disabled:bg-black/20"
      />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => handleAddEvent('Answer')} disabled={!statement.trim() || !isMyTurn} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 rounded-lg">Make Statement</button>
        <button onClick={() => handleAddEvent('Question')} disabled={!statement.trim() || !isMyTurn} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-2 rounded-lg">Ask Question</button>
      </div>

      <div className="p-3 rounded-lg bg-black/20 border border-white/10 space-y-2">
        <h4 className="font-bold text-gray-200">Private Question Bank</h4>
        {questionDrafts.map((value, index) => (
          <div key={`q-${index}`} className="space-y-1">
            <input value={value} onChange={(event) => setQuestionAt(index, event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" placeholder={`Question ${index + 1}`} />
            {questions[index] && (
              <button type="button" disabled={questions[index].revealed} onClick={() => onRevealQuestion(localPlayer.id, questions[index].id)} className="text-xs px-2 py-1 rounded bg-indigo-700/70 hover:bg-indigo-600 disabled:bg-gray-700 text-white">
                {questions[index].revealed ? 'Revealed' : 'Reveal On Ask'}
              </button>
            )}
          </div>
        ))}
        {canEditQuestionCount && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setQuestionDrafts((current) => [...current, ''])} disabled={questionDrafts.length >= 10} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white">+ Add</button>
            <button type="button" onClick={() => setQuestionDrafts((current) => current.slice(0, -1))} disabled={questionDrafts.length <= 1} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white">- Remove</button>
          </div>
        )}
        <button type="button" onClick={handleSaveQuestionBank} className="w-full bg-indigo-700 hover:bg-indigo-600 text-white font-bold py-2 rounded">Save Question Bank</button>
      </div>

      <div className="p-3 rounded-lg bg-black/20 border border-white/10 space-y-2">
        <h4 className="font-bold text-gray-200">Trusted Sources (min 3)</h4>
        <textarea value={trustedSourcesText} onChange={(event) => setTrustedSourcesText(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white min-h-[80px]" placeholder="One source URL per line" />
        <button type="button" onClick={handleSaveTrustedSources} className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-2 rounded">Save Trusted Sources</button>
      </div>

      <div className="p-3 rounded-lg bg-black/20 border border-white/10 space-y-2">
        <h4 className="font-bold text-gray-200">Yellow Lifelines</h4>
        <p className="text-xs text-yellow-200">Remaining yellow indicators: {yellowRemaining}</p>
        <select value={selectedTrustedSource} onChange={(event) => setSelectedTrustedSource(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white">
          <option value="">Select source for Trusted Sourcing</option>
          {(localPlayer.trustedSources || []).map((source) => <option key={source} value={source}>{source}</option>)}
        </select>
        <input value={lifelineDetails} onChange={(event) => setLifelineDetails(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" placeholder="Optional lifeline context" />
        <div className="grid grid-cols-1 gap-2">
          <button type="button" disabled={yellowRemaining <= 0 || lifelines.AudienceOpinion} onClick={() => handleUseLifeline('AudienceOpinion')} className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Audience Opinion</button>
          <button type="button" disabled={yellowRemaining <= 0 || lifelines.TrustedSourcing} onClick={() => handleUseLifeline('TrustedSourcing')} className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Trusted Sourcing</button>
          <button type="button" disabled={yellowRemaining <= 0 || lifelines.RefsChoice} onClick={() => handleUseLifeline('RefsChoice')} className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Ref's Choice</button>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-black/20 border border-white/10 space-y-2">
        <h4 className="font-bold text-gray-200">Green Indicator</h4>
        <p className="text-xs text-lime-300">Remaining green indicators: {greenRemaining}</p>
        <input value={greenReason} onChange={(event) => setGreenReason(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" placeholder="Reason: process, repeat, elaborate" />
        <button type="button" disabled={greenRemaining <= 0} onClick={handleUseGreenIndicator} className="w-full bg-lime-700 hover:bg-lime-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Use Green Indicator</button>
      </div>

      <div className="p-3 rounded-lg bg-black/20 border border-white/10 space-y-2">
        <h4 className="font-bold text-gray-200">Audio Draft</h4>
        <div className="flex gap-2">
          <button type="button" onClick={startRecording} disabled={isRecording} className="flex-1 bg-sky-700 hover:bg-sky-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Start Mic</button>
          <button type="button" onClick={stopRecording} disabled={!isRecording} className="flex-1 bg-sky-900 hover:bg-sky-800 disabled:bg-gray-700 text-white font-bold py-2 rounded">Stop</button>
        </div>
        <textarea value={audioTranscript} onChange={(event) => setAudioTranscript(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white min-h-[80px]" placeholder="Transcript for standardized playback" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => speak(audioTranscript)} disabled={!audioTranscript.trim()} className="bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Preview Standard Voice</button>
          <button type="button" onClick={submitAudioDraft} disabled={!audioTranscript.trim()} className="bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Send to Referee</button>
        </div>
        {localPendingDraft?.learningHint && <p className="text-xs text-cyan-200">{localPendingDraft.learningHint}</p>}
      </div>
    </div>
  );

  const renderRefereeControls = () => {
    const otherPlayers = players.filter((player) => player.id !== localPlayer.id);
    const canFlag = violationTarget && violationReason.trim();
    return (
      <div className="space-y-4">
        <div className="p-3 bg-black/20 rounded-lg space-y-2">
          <h4 className="font-bold text-center text-gray-300">Issue Violation</h4>
          <select value={violationTarget} onChange={(event) => setViolationTarget(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-white">
            <option value="">-- Select Player --</option>
            {otherPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          <textarea value={violationReason} onChange={(event) => setViolationReason(event.target.value)} className="w-full text-sm bg-black/40 border border-gray-600 rounded px-3 py-2 text-white" rows={2} placeholder="Reason for violation" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => canFlag && onAssignViolation(violationTarget, 'yellow', violationReason.trim())} disabled={!canFlag} className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-black font-bold py-2 rounded">Yellow Flag</button>
            <button onClick={() => canFlag && onAssignViolation(violationTarget, 'red', violationReason.trim())} disabled={!canFlag} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 rounded">Red Flag</button>
          </div>
        </div>

        <div className="p-3 bg-black/20 rounded-lg space-y-2">
          <h4 className="font-bold text-gray-300">Moderation Notes</h4>
          {MODERATION_SHORTCUTS.map((shortcut) => (
            <button key={shortcut.key} type="button" onClick={() => onAddModerationNote({ refereeId: localPlayer.id, text: shortcut.text, shortcutKey: shortcut.key })} className="w-full text-left text-sm bg-red-800/60 hover:bg-red-700 text-white px-3 py-2 rounded">
              {shortcut.text}
            </button>
          ))}
          <input value={moderationCustomNote} onChange={(event) => setModerationCustomNote(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" placeholder="Custom moderation note" />
          <button type="button" disabled={!moderationCustomNote.trim()} onClick={() => { onAddModerationNote({ refereeId: localPlayer.id, text: moderationCustomNote.trim() }); setModerationCustomNote(''); }} className="w-full bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Broadcast Custom Note</button>
        </div>

        <div className="p-3 bg-black/20 rounded-lg space-y-2">
          <h4 className="font-bold text-gray-300">Award Points</h4>
          <select value={awardTarget} onChange={(event) => setAwardTarget(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white">
            <option value="">-- Select Player --</option>
            {conversationalists.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select>
          <input type="number" min={1} max={10} value={awardPoints} onChange={(event) => setAwardPoints(Number(event.target.value))} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" />
          <input value={awardReason} onChange={(event) => setAwardReason(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" />
          <button type="button" disabled={!awardTarget || !awardReason.trim()} onClick={() => onAwardScore({ playerId: awardTarget, points: awardPoints, reason: awardReason.trim(), assignerId: localPlayer.id })} className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Award Verified Points</button>
        </div>

        <div className="p-3 bg-black/20 rounded-lg space-y-2">
          <h4 className="font-bold text-gray-300">Audio Draft Review</h4>
          {pendingAudioDrafts.length === 0 && <p className="text-sm text-gray-400">No pending drafts.</p>}
          {pendingAudioDrafts.map((draft) => (
            <div key={draft.id} className="rounded border border-white/10 p-2 text-sm text-gray-200 space-y-2">
              <p><strong>{playersById.get(draft.playerId)?.name || draft.playerId}</strong>: {draft.transcript}</p>
              <input value={draftReviewNotes[draft.id] || ''} onChange={(event) => setDraftReviewNotes((current) => ({ ...current, [draft.id]: event.target.value }))} className="w-full bg-black/40 border border-gray-600 rounded px-2 py-1 text-xs text-white" placeholder="Optional review note" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onReviewAudioDraft({ reviewerId: localPlayer.id, draftId: draft.id, status: 'approved', reviewNote: draftReviewNotes[draft.id] || undefined })} className="bg-emerald-700 hover:bg-emerald-600 text-white py-1 rounded">Approve</button>
                <button type="button" onClick={() => onReviewAudioDraft({ reviewerId: localPlayer.id, draftId: draft.id, status: 'rejected', reviewNote: draftReviewNotes[draft.id] || undefined })} className="bg-red-700 hover:bg-red-600 text-white py-1 rounded">Reject</button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-black/20 rounded-lg space-y-2">
          <h4 className="font-bold text-gray-300">Fact Check</h4>
          <textarea value={factCheckStatement} onChange={(event) => setFactCheckStatement(event.target.value)} className="w-full text-sm bg-black/40 border border-gray-600 rounded px-3 py-2 text-white" rows={2} placeholder="Enter statement to fact check" />
          <button onClick={() => factCheckStatement.trim() && onFactCheck(factCheckStatement.trim())} disabled={!factCheckStatement.trim()} className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-2 rounded">Initiate Fact Check</button>
        </div>

        <div className="p-3 bg-black/20 rounded-lg space-y-2">
          <h4 className="font-bold text-gray-300">End Game</h4>
          <input value={endGameReason} onChange={(event) => setEndGameReason(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" />
          <button type="button" onClick={() => onEndGame(endGameReason.trim() || undefined)} className="w-full bg-red-800 hover:bg-red-700 text-white font-bold py-2 rounded">End Game and Compute Winner</button>
        </div>
      </div>
    );
  };

  const renderTimeKeeperControls = () => (
    <div className="space-y-3">
      <div className="text-center text-gray-400 space-y-3 p-3 bg-black/20 rounded-lg">
        <p className="text-5xl font-mono font-black my-4 text-white">{formatTime(turnRemaining)}</p>
        <select value={turnTarget} onChange={(event) => setTurnTarget(event.target.value)} disabled={isTurnActive} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-white disabled:bg-black/20">
          <option value="">-- Select Speaker --</option>
          {conversationalists.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onStartTurn(turnTarget)} disabled={!turnTarget || isTurnActive} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 rounded">Start Turn</button>
          <button onClick={() => onEndTurn()} disabled={!isTurnActive} className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 rounded">End Turn</button>
        </div>
        <button onClick={() => onPauseTurn(isTurnActive)} disabled={!currentSpeakerId} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-black font-bold py-2 rounded">{isTurnActive ? 'Pause' : 'Resume'}</button>
        <button type="button" onClick={() => onAdvanceRound(localPlayer.id)} disabled={currentRound >= totalRounds} className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">
          Advance Round ({currentRound}/{totalRounds})
        </button>
      </div>

      <div className="p-3 bg-black/20 rounded-lg space-y-2">
        <h4 className="font-bold text-gray-300">Highlight Timeline</h4>
        <select value={highlightEventId} onChange={(event) => setHighlightEventId(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white">
          <option value="">-- Select Event --</option>
          {timeline.slice(-40).map((event) => <option key={event.id} value={event.id}>{event.type} - {event.text.slice(0, 60)}</option>)}
        </select>
        <input value={highlightLabel} onChange={(event) => setHighlightLabel(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white" placeholder="Highlight label" />
        <button type="button" disabled={!highlightEventId || !highlightLabel.trim()} onClick={() => { onHighlightTimelineEvent({ timeKeeperId: localPlayer.id, eventId: highlightEventId, label: highlightLabel.trim() }); setHighlightLabel(''); }} className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Highlight on Main Screen</button>
      </div>

      <div className="p-3 bg-black/20 rounded-lg space-y-2">
        <h4 className="font-bold text-gray-300">Section Summary</h4>
        <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white">
          <option value="">-- Select Section --</option>
          {timelineSections.slice(-30).map((section) => <option key={section.id} value={section.id}>{playersById.get(section.speakerId)?.name || section.speakerId} • {Math.round(section.durationSeconds)}s</option>)}
        </select>
        <textarea value={sectionSummary} onChange={(event) => setSectionSummary(event.target.value)} className="w-full bg-black/40 border border-gray-600 rounded px-3 py-2 text-sm text-white min-h-[70px]" placeholder="Summary for selected section" />
        <button type="button" disabled={!sectionId} onClick={() => { onUpdateSectionSummary({ timeKeeperId: localPlayer.id, sectionId, summary: sectionSummary }); setSectionSummary(''); }} className="w-full bg-teal-700 hover:bg-teal-600 disabled:bg-gray-700 text-white font-bold py-2 rounded">Save Section Summary</button>
      </div>
    </div>
  );

  const renderControls = () => {
    if (localPlayer.role === 'Conversationalist') return renderConversationalistControls();
    if (localPlayer.role === 'Referee') return renderRefereeControls();
    if (localPlayer.role === 'Time Keeper') return renderTimeKeeperControls();
    return <p className="text-center text-gray-500">Waiting for your role assignment...</p>;
  };

  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl flex-grow flex flex-col">
      <div>
        <h2 className="text-3xl font-bold mb-4 border-b border-white/10 pb-2 font-display">Controls</h2>
        <div className="space-y-3">{renderControls()}</div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/20 flex flex-col flex-grow min-h-0">
        <h3 className="text-xl font-bold font-display mb-2 text-gray-300">{localPlayer.role === 'Conversationalist' ? 'Referee Chat' : 'Moderator Chat'}</h3>
        <div ref={chatHistoryRef} className="flex-grow bg-black/30 rounded-t-lg p-2 space-y-2 overflow-y-auto h-24 min-h-[6rem] smooth-scroll">
          {visibleMessages.map((msg) => {
            const sender = playersById.get(msg.senderId);
            const senderName = sender?.id === localPlayer.id ? 'You' : sender?.name || 'Unknown';
            const isOwnMessage = msg.senderId === localPlayer.id;
            return (
              <div key={msg.id} className={`text-sm ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block px-3 py-1 rounded-lg ${isOwnMessage ? 'bg-purple-800 text-purple-100' : 'bg-gray-700 text-gray-200'}`}>
                  <strong className="font-bold">{senderName}: </strong>
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex">
          <input type="text" value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleSendChat()} placeholder={isModerator ? 'Chat with all players...' : 'Chat with Referee...'} className="flex-grow bg-black/50 border border-gray-600 rounded-bl-lg px-3 py-2 text-white placeholder-gray-500" />
          <button onClick={handleSendChat} className="bg-purple-700 hover:bg-purple-600 text-white font-bold p-2 px-4 rounded-br-lg">Send</button>
        </div>
      </div>

      <button onClick={onExit} className="w-full mt-4 bg-red-800/70 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">Exit Game</button>
    </div>
  );
};

export default ControlsPanel;
