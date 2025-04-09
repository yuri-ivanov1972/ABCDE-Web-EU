import React from 'react';
import { NutriScoreGrade } from '@/types';

interface NutriScoreBadgeProps {
  score: NutriScoreGrade;
  size?: 'small' | 'medium' | 'large';
}

const NutriScoreBadge: React.FC<NutriScoreBadgeProps> = ({ score, size = 'medium' }) => {
  const scoreColors = {
    'A': 'bg-[#1e8e3e]',
    'B': 'bg-[#74b816]',
    'C': 'bg-[#fcc200]',
    'D': 'bg-[#ff8800]',
    'E': 'bg-[#e12d39]'
  };
  
  const sizeClasses = {
    small: 'h-8 w-8 text-sm',
    medium: 'h-10 w-10 text-base',
    large: 'h-12 w-12 text-lg'
  };
  
  return (
    <div className={`${sizeClasses[size]} ${scoreColors[score]} rounded-full flex items-center justify-center text-white font-bold`}>
      {score}
    </div>
  );
};

export default NutriScoreBadge;
