
import React from 'react';

interface IndicatorLightProps {
  color: 'red' | 'yellow' | 'green';
  count: number;
}

export const IndicatorLight: React.FC<IndicatorLightProps> = ({ color, count }) => {
  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  };

  return (
    <div className="flex items-center gap-1.5" title={`${color.charAt(0).toUpperCase() + color.slice(1)} Indicators`}>
      <div className={`w-3 h-3 rounded-full ${colorClasses[color]}`}></div>
      <span className="text-sm font-semibold text-gray-300">{count}</span>
    </div>
  );
};
