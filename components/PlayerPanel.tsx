import React from 'react';
import { Player } from '../types';
import { IndicatorLight } from './IndicatorLight';

interface PlayerPanelProps {
  players: Player[];
  localPlayer: Player;
  currentSpeakerId: string | null;
  onRemovePlayer: (playerId: string) => void;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({ players, localPlayer, currentSpeakerId, onRemovePlayer }) => {
  const isReferee = localPlayer.role === 'Referee';
  const toCount = (value: number | undefined) => (typeof value === 'number' ? value : 0);

  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/10 p-4 rounded-xl">
      <h2 className="text-3xl font-bold mb-4 border-b border-white/10 pb-2 font-display">Participants</h2>
      <ul className="space-y-3">
        {players.map(player => (
          <li
            key={player.id}
            className={`p-3 rounded-lg flex items-center justify-between transition-all duration-300 group ${
              player.id === currentSpeakerId ? 'bg-amber-500/20 border border-amber-500' : 'bg-white/5 border border-transparent'
            }`}
          >
            <div className="min-w-0 pr-3">
              <p className="font-bold text-lg text-gray-100">
                {player.name} {player.id === localPlayer.id && <span className="text-xs text-amber-400">(You)</span>}
              </p>
              <p className="text-sm font-semibold text-purple-400">{player.role || 'Waiting for role...'}</p>
              {player.role === 'Conversationalist' && (
                <div className="mt-1 text-xs text-gray-300">
                  <p>Score: <strong>{toCount(player.score?.total)}</strong> | Replies: {toCount(player.score?.replies)} | Verified: {toCount(player.score?.verifiedPoints)}</p>
                  <p>
                    Indicators left:
                    {' '}
                    R {toCount(player.indicators?.redRemaining)} / Y {toCount(player.indicators?.yellowRemaining)} / G {toCount(player.indicators?.greenRemaining)}
                  </p>
                  {(player.trustedSources?.length ?? 0) > 0 && (
                    <p className="truncate">
                      Sources:
                      {' '}
                      {(player.trustedSources ?? []).slice(0, 3).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
                <IndicatorLight color="green" count={player.violations.green} />
                <IndicatorLight color="yellow" count={player.violations.yellow} />
                <IndicatorLight color="red" count={player.violations.red} />
                {isReferee && player.id !== localPlayer.id && (
                  <button 
                    onClick={() => onRemovePlayer(player.id)}
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                    title={`Remove ${player.name} from game`}
                  >
                      <span className="material-symbols-outlined">person_remove</span>
                  </button>
                )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayerPanel;
