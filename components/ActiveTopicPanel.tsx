import React from 'react';

interface ActiveTopicPanelProps {
  topic: string | null;
  question: string | null;
  round: number;
  totalRounds: number;
}

const ActiveTopicPanel: React.FC<ActiveTopicPanelProps> = ({ topic, question, round, totalRounds }) => {
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
    </div>
  );
};

export default ActiveTopicPanel;
