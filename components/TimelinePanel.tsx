import React from 'react';
import { TimelineEvent, Player } from '../types';
import { castVote } from '../services/mockApi';

interface TimelinePanelProps {
  gameCode?: string;
  timeline: TimelineEvent[];
  players: Player[];
  isViewer: boolean;
  localUserId?: string;
}

const TimelinePanel: React.FC<TimelinePanelProps> = ({ gameCode, timeline, players, isViewer, localUserId }) => {
  const getPlayerName = (playerId: string) => players.find(p => p.id === playerId)?.name || 'System';

  const handleVote = (eventId: string) => {
      if (gameCode && localUserId) {
          castVote(gameCode, eventId, localUserId).catch(err => console.error("Failed to cast vote:", err));
      }
  }

  const getEventDetails = (event: TimelineEvent) => {
    switch(event.type) {
      case 'Topic': return { icon: 'topic', color: 'bg-purple-600', title: 'New Topic Set' };
      case 'Question': return { icon: 'help_outline', color: 'bg-indigo-500', title: 'Question Asked' };
      case 'Summary': return { icon: 'summarize', color: 'bg-teal-600', title: 'Summary Provided' };
      case 'Answer': return { icon: 'chat_bubble', color: 'bg-green-600', title: 'Statement Made' };
      case 'FactCheck': return { icon: 'check_circle', color: 'bg-amber-600', title: 'Fact Check' };
      case 'Violation': {
        const targetName = getPlayerName(event.violation!.targetPlayerId);
        const color = event.violation?.type === 'red' ? 'bg-red-600' : 'bg-yellow-500';
        return { icon: 'flag', color, title: `${event.violation?.type === 'red' ? 'Red' : 'Yellow'} Flag on ${targetName}` };
      }
      case 'RoundStart': return { icon: 'sports_esports', color: 'bg-gray-500', title: 'Round Started' };
      case 'TurnStart': return { icon: 'play_arrow', color: 'bg-blue-500', title: 'Turn Started' };
      case 'TurnEnd': return { icon: 'stop', color: 'bg-gray-600', title: 'Turn Ended' };
      default: return { icon: 'radio_button_checked', color: 'bg-gray-600', title: 'Game Event' };
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl flex-grow flex flex-col min-h-[300px] lg:min-h-[400px]">
      <h2 className="text-3xl font-bold mb-4 border-b border-white/10 pb-2 font-display">Convo-Line</h2>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4 smooth-scroll">
        {timeline.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 italic">
            The conversation will appear here...
          </div>
        ) : (
          <div>
            {timeline.map(event => {
                const details = getEventDetails(event);
                const isViolation = event.type === 'Violation';
                const borderColor = isViolation ? (event.violation?.type === 'red' ? 'border-red-500' : 'border-yellow-500') : 'border-transparent';
                const voteCount = event.factCheckVotes?.length || 0;
                const hasVoted = localUserId && event.factCheckVotes?.includes(localUserId);

                return (
                  <div key={event.id} className={`p-3 rounded-lg bg-black/20 border-l-4 ${borderColor} mb-3`}>
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white ${details.color} shadow-md`}>
                         <span className="material-symbols-outlined">{details.icon}</span>
                       </div>
                       <div className="flex-grow">
                           <p className="font-bold text-gray-200">{details.title}</p>
                           <p className="text-xs text-gray-400">By: {getPlayerName(event.playerId)}</p>
                       </div>
                    </div>
                    <p className="text-gray-300 mt-2 pl-2 border-l-2 border-white/10 ml-[18px]">{event.text}</p>

                    {event.type === 'Answer' && (
                        <div className="flex items-center justify-end gap-3 mt-2 text-sm">
                           <div className="flex items-center gap-1 text-amber-300">
                                <span className="material-symbols-outlined text-base">how_to_vote</span>
                                <span>{voteCount}</span>
                           </div>
                           {isViewer && (
                                <button 
                                    onClick={() => handleVote(event.id)}
                                    disabled={hasVoted}
                                    className="px-3 py-1 bg-amber-600/50 hover:bg-amber-500/50 text-amber-200 rounded-md disabled:bg-gray-600/50 disabled:cursor-not-allowed disabled:text-gray-400"
                                >
                                  {hasVoted ? 'Voted' : 'Vote for Fact Check'}
                                </button>
                           )}
                        </div>
                    )}
                  </div>
                )
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelinePanel;