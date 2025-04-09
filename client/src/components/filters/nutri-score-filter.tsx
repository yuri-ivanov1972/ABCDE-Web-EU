import React from 'react';
import { NutriScoreGrade } from '@/types';

interface NutriScoreFilterProps {
  selectedScores: NutriScoreGrade[];
  onToggleScore: (score: NutriScoreGrade) => void;
  size?: 'small' | 'medium';
}

const NutriScoreFilter: React.FC<NutriScoreFilterProps> = ({ 
  selectedScores,
  onToggleScore,
  size = 'medium'
}) => {
  const nutriScores: NutriScoreGrade[] = ['A', 'B', 'C', 'D', 'E'];
  
  const scoreColors = {
    'A': 'bg-[#1e8e3e]',
    'B': 'bg-[#74b816]',
    'C': 'bg-[#fcc200]',
    'D': 'bg-[#ff8800]',
    'E': 'bg-[#e12d39]'
  };
  
  const ringColors = {
    'A': 'focus:ring-[#1e8e3e]',
    'B': 'focus:ring-[#74b816]',
    'C': 'focus:ring-[#fcc200]',
    'D': 'focus:ring-[#ff8800]',
    'E': 'focus:ring-[#e12d39]'
  };
  
  const sizeClasses = {
    small: 'h-8 w-8 text-sm',
    medium: 'h-10 w-10 text-base'
  };
  
  return (
    <div className="flex space-x-2">
      {nutriScores.map((score) => (
        <button 
          key={score}
          className={`
            ${sizeClasses[size]} 
            ${scoreColors[score]} 
            ${ringColors[score]} 
            ${selectedScores.includes(score) ? 'ring-2 ring-offset-2' : ''}
            rounded-full flex items-center justify-center text-white font-semibold 
            focus:outline-none focus:ring-2 focus:ring-offset-2
          `}
          onClick={() => onToggleScore(score)}
          aria-pressed={selectedScores.includes(score)}
        >
          {score}
        </button>
      ))}
    </div>
  );
};

export default NutriScoreFilter;
