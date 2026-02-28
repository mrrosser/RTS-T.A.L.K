import React, { useState, useRef, useEffect } from 'react';
import { TimelineEvent, ChatMessage, Player } from '../types';

interface ControlsPanelProps {
    localPlayer: Player | undefined;
    players: Player[];
    onAddEvent: (event: Omit<TimelineEvent, 'id' | 'timestamp'>) => void;
    onFactCheck: (statement: string) => void;
    onSendMessage: (text: string) => void;
    onAssignViolation: (targetPlayerId: string, type: 'red' | 'yellow', reason: string) => void;
    onStartTurn: (speakerId: string) => void;
    onEndTurn: () => void;
    onPauseTurn: (pause: boolean) => void;
    isTurnActive: boolean;
    turnRemaining: number;
    currentSpeakerId: string | null;
    chatMessages: ChatMessage[];
    onExit: () => void;
}

const ControlsPanel: React.FC<ControlsPanelProps> = (props) => {
    const { localPlayer, players, onAddEvent, onFactCheck, onSendMessage, onAssignViolation, onStartTurn, onEndTurn, onPauseTurn, isTurnActive, turnRemaining, currentSpeakerId, chatMessages, onExit } = props;
    const [statement, setStatement] = useState('');
    const [chatMessage, setChatMessage] = useState('');
    const [violationTarget, setViolationTarget] = useState<string>('');
    const [violationReason, setViolationReason] = useState('');
    const [turnTarget, setTurnTarget] = useState<string>('');
    const [factCheckStatement, setFactCheckStatement] = useState('');

    const chatHistoryRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatMessages]);

    if (!localPlayer) return null;
    
    const handleAddEvent = (type: 'Answer' | 'Question') => {
        if (statement.trim()) {
            onAddEvent({ type, text: statement.trim(), playerId: localPlayer.id });
            setStatement('');
        }
    };

    const handleSendChat = () => {
        if (chatMessage.trim()) {
            onSendMessage(chatMessage.trim());
            setChatMessage('');
        }
    };

    const handleViolationClick = (type: 'red' | 'yellow') => {
        if (violationTarget && violationReason.trim()) {
            onAssignViolation(violationTarget, type, violationReason.trim());
            setViolationReason('');
            setViolationTarget('');
        }
    }

    const handleFactCheckClick = () => {
        if (factCheckStatement.trim()) {
            onFactCheck(factCheckStatement.trim());
            setFactCheckStatement('');
        }
    };
    
    const isModerator = localPlayer.role === 'Referee' || localPlayer.role === 'Time Keeper';
    const visibleMessages = chatMessages.filter(msg => {
        if (isModerator) return true;
        const sender = players.find(p => p.id === msg.senderId);
        if (!sender) return false;
        return sender.role === 'Referee' || msg.senderId === localPlayer.id;
    });

    const isMyTurn = localPlayer.id === currentSpeakerId && isTurnActive && turnRemaining > 0;

    const renderConversationalistControls = () => (
        <>
            <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                placeholder={isMyTurn ? "Enter your statement or question..." : "Waiting for your turn..."}
                disabled={!isMyTurn}
                className="w-full bg-black/40 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black/50 focus:ring-amber-400 transition-shadow duration-200 min-h-[100px] disabled:bg-black/20 disabled:cursor-not-allowed"
            />
            <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => handleAddEvent('Answer')} disabled={!statement.trim() || !isMyTurn} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Make Statement</button>
                <button onClick={() => handleAddEvent('Question')} disabled={!statement.trim() || !isMyTurn} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Ask Question</button>
            </div>
        </>
    );

    const renderRefereeControls = () => {
        const otherPlayers = players.filter(p => p.id !== localPlayer.id);
        const canFlag = violationTarget && violationReason.trim();
        return (
            <div className="space-y-4">
                <div className="p-3 bg-black/20 rounded-lg space-y-3">
                    <h4 className="font-bold text-center text-gray-300">Issue Violation</h4>
                    <select
                        value={violationTarget}
                        onChange={(e) => setViolationTarget(e.target.value)}
                        className="w-full bg-black/40 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">-- Select Player --</option>
                        {otherPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <textarea
                        value={violationReason}
                        onChange={(e) => setViolationReason(e.target.value)}
                        placeholder="Reason for violation..."
                        className="w-full text-sm bg-black/40 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                        rows={2}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleViolationClick('yellow')} disabled={!canFlag} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-black font-bold py-2 px-3 rounded-lg text-sm">Yellow Flag</button>
                        <button onClick={() => handleViolationClick('red')} disabled={!canFlag} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg text-sm">Red Flag</button>
                    </div>
                </div>
                 <div className="p-3 bg-black/20 rounded-lg space-y-3">
                    <h4 className="font-bold text-center text-gray-300">Fact Check</h4>
                     <textarea
                        value={factCheckStatement}
                        onChange={(e) => setFactCheckStatement(e.target.value)}
                        placeholder="Enter statement to fact check (audience votes can guide you)..."
                        className="w-full text-sm bg-black/40 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                        rows={2}
                    />
                    <button onClick={handleFactCheckClick} disabled={!factCheckStatement.trim()} className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg text-sm">Initiate Fact Check</button>
                </div>
            </div>
        );
    };
    
    const renderTimeKeeperControls = () => {
        const conversationalists = players.filter(p => p.role === 'Conversationalist');
        const formatTime = (seconds: number) => {
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
            return `${mins}:${secs}`;
        }
        return (
            <div className="text-center text-gray-400 space-y-3 p-3 bg-black/20 rounded-lg">
                <p className="text-5xl font-mono font-black my-4 text-white">{formatTime(turnRemaining)}</p>
                <select 
                    value={turnTarget}
                    onChange={e => setTurnTarget(e.target.value)}
                    disabled={isTurnActive}
                    className="w-full bg-black/40 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-black/20 disabled:cursor-not-allowed"
                >
                    <option value="">-- Select Speaker --</option>
                    {conversationalists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onStartTurn(turnTarget)} disabled={!turnTarget || isTurnActive} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">Start Turn</button>
                    <button onClick={() => onEndTurn()} disabled={!isTurnActive} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg">End Turn</button>
                </div>
                 <button onClick={() => onPauseTurn(isTurnActive)} disabled={!currentSpeakerId} className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-black font-bold py-2 px-4 rounded-lg">{isTurnActive ? 'Pause' : 'Resume'}</button>
            </div>
        )
    };
    
    const renderControls = () => {
        switch (localPlayer.role) {
            case 'Conversationalist': return renderConversationalistControls();
            case 'Referee': return renderRefereeControls();
            case 'Time Keeper': return renderTimeKeeperControls();
            default: return <p className="text-center text-gray-500">Waiting for your role assignment...</p>;
        }
    };

    return (
        <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl flex-grow flex flex-col">
            <div>
                <h2 className="text-3xl font-bold mb-4 border-b border-white/10 pb-2 font-display">Controls</h2>
                <div className="space-y-3">
                    {renderControls()}
                </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/20 flex flex-col flex-grow min-h-0">
                 <h3 className="text-xl font-bold font-display mb-2 text-gray-300">{localPlayer.role === 'Conversationalist' ? 'Referee Chat' : 'Moderator Chat'}</h3>
                 <div ref={chatHistoryRef} className="flex-grow bg-black/30 rounded-t-lg p-2 space-y-2 overflow-y-auto h-24 min-h-[6rem] smooth-scroll">
                     {visibleMessages.map(msg => {
                        const sender = players.find(p => p.id === msg.senderId);
                        const senderName = sender?.id === localPlayer.id ? 'You' : sender?.name || 'Unknown';
                        const isOwnMessage = msg.senderId === localPlayer.id;
                        return (
                            <div key={msg.id} className={`text-sm ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                                <div className={`inline-block px-3 py-1 rounded-lg ${isOwnMessage ? 'bg-purple-800 text-purple-100' : 'bg-gray-700 text-gray-200'}`}>
                                    <strong className="font-bold">{senderName}: </strong>
                                    <span>{msg.text}</span>
                                </div>
                            </div>
                        )
                     })}
                 </div>
                 <div className="flex">
                    <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendChat()} placeholder={isModerator ? "Chat with all players..." : "Chat with Referee..."} className="flex-grow bg-black/50 border-t-0 border border-gray-600 rounded-bl-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"/>
                    <button onClick={handleSendChat} className="bg-purple-700 hover:bg-purple-600 text-white font-bold p-2 px-4 rounded-br-lg">Send</button>
                 </div>
            </div>

            <button onClick={onExit} className="w-full mt-4 bg-red-800/70 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                Exit Game
            </button>
        </div>
    );
};

export default ControlsPanel;