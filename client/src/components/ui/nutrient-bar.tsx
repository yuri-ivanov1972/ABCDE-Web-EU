import React, { useMemo } from 'react';

interface NutrientBarProps {
  nutrient: 'sugar' | 'fat' | 'protein' | 'salt';
  value: number;
  unit?: string;
}

const NutrientBar: React.FC<NutrientBarProps> = ({ 
  nutrient, 
  value, 
  unit = 'g'
}) => {
  // Define thresholds for nutrient colors
  const thresholds = useMemo(() => {
    switch(nutrient) {
      case 'sugar':
        return { low: 5, medium: 10, high: 15 };
      case 'fat':
        return { low: 10, medium: 20, high: 30 };
      case 'protein':
        // For protein, higher is better
        return { low: 5, medium: 10, high: 15 };
      case 'salt':
        return { low: 0.5, medium: 1, high: 1.5 };
      default:
        return { low: 10, medium: 50, high: 80 };
    }
  }, [nutrient]);
  
  // Calculate percentage based on nutrient type
  const percentage = useMemo(() => {
    switch(nutrient) {
      case 'sugar':
        return Math.min(100, (value / 20) * 100);
      case 'fat':
        return Math.min(100, (value / 30) * 100);
      case 'protein':
        // For protein, show as percentage of a good amount (20g)
        return Math.min(100, (value / 20) * 100);
      case 'salt':
        return Math.min(100, (value / 2) * 100);
      default:
        return Math.min(100, value);
    }
  }, [nutrient, value]);
  
  // Determine color based on value and nutrient type
  const color = useMemo(() => {
    // For protein, higher is better
    if (nutrient === 'protein') {
      if (value >= thresholds.high) return 'bg-green-500';
      if (value >= thresholds.medium) return 'bg-lime-500';
      if (value >= thresholds.low) return 'bg-yellow-500';
      return 'bg-red-500';
    }
    
    // For others, lower is better
    if (value <= thresholds.low) return 'bg-green-500';
    if (value <= thresholds.medium) return 'bg-yellow-500';
    if (value <= thresholds.high) return 'bg-orange-500';
    return 'bg-red-500';
  }, [nutrient, value, thresholds]);

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600">{nutrient.charAt(0).toUpperCase() + nutrient.slice(1)}</span>
      <div className="flex items-center">
        <span className="font-medium mr-2">{value}{unit}</span>
        <div className="w-16 bg-gray-200 rounded-full h-1.5">
          <div 
            className={`${color} h-1.5 rounded-full`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default NutrientBar;
