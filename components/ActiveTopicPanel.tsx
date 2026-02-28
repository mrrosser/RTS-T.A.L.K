import React from 'react';
import type { ModerationNote, WinnerSummary } from '../types';

interface ActiveTopicPanelProps {
  topic: string | null;
  question: string | null;
  round: number;
  totalRounds: number;
  moderationNotes?: ModerationNote[];
  winner?: WinnerSummary | null;
}

const ActiveTopicPanel: React.FC<ActiveTopicPanelProps> = ({ topic, question, round, totalRounds, moderationNotes = [], winner = null }) => {
  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-gray-100 font-display">Active Topic</h2>
        <span className="text-lg font-semibold bg-purple-600/50 text-purple-200 px-3 py-1 rounded-full">
            Round {round} / {totalRounds}
        </span>
      </div>
      {topic ? (
        <p className="text-lg text-gray-300">{topic}</p>
      ) : (
        <p className="text-lg text-gray-500 italic">Waiting for a topic...</p>
      )}
      {question && (
        <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-xl font-bold text-gray-200 font-display">Current Question</h3>
            <p className="text-md text-gray-400">{question}</p>
        </div>
      )}
      {moderationNotes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="text-xl font-bold text-gray-200 font-display">Referee Notes</h3>
          <ul className="mt-2 space-y-2">
            {moderationNotes.slice(-3).reverse().map(note => (
              <li key={note.id} className="rounded-md bg-red-950/30 border border-red-700/40 px-3 py-2 text-sm text-red-100">
                {note.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {winner && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <h3 className="text-xl font-bold text-emerald-300 font-display">Winner</h3>
          <p className="text-sm text-emerald-100">
            {winner.playerName}
            {' '}
            with score
            {' '}
            {winner.score}
            .
          </p>
        </div>
      )}
    </div>
  );
};

export default ActiveTopicPanel;
