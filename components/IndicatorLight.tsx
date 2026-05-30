
import React from 'react';

interface IndicatorLightProps {
  color: 'red' | 'yellow' | 'green' | 'purple';
  filled: number;
  total?: number;
  label?: string;
}

export const IndicatorLight: React.FC<IndicatorLightProps> = ({ color, filled, total = Math.max(filled, 1), label }) => {
  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="flex items-center gap-1.5" title={label || `${color.charAt(0).toUpperCase() + color.slice(1)} indicators`}>
      {Array.from({ length: Math.max(total, 1) }, (_, index) => (
        <div
          key={`${color}-${index}`}
          className={`h-3 w-3 rounded-full border border-white/15 ${index < filled ? colorClasses[color] : 'bg-white/10'}`}
        />
      ))}
    </div>
  );
};
