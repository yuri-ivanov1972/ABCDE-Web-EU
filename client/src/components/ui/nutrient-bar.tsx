import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface NutrientBarProps {
  nutrient: 'sugar' | 'fat' | 'saturatedFat' | 'protein' | 'salt';
  value: number;
  unit?: string;
  compact?: boolean;
}

const NutrientBar: React.FC<NutrientBarProps> = ({ 
  nutrient, 
  value, 
  unit = 'g',
  compact = false
}) => {
  // Define thresholds for nutrient colors (based on Nutri-Score criteria)
  const thresholds = useMemo(() => {
    switch(nutrient) {
      case 'sugar':
        return { low: 5, medium: 10, high: 15 };
      case 'fat':
        return { low: 10, medium: 20, high: 30 };
      case 'saturatedFat':
        // Nutri-Score thresholds for saturated fat
        return { low: 1, medium: 4, high: 7 };
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
      case 'saturatedFat':
        return Math.min(100, (value / 10) * 100);
      case 'protein':
        // For protein, show as percentage of a good amount (20g)
        return Math.min(100, (value / 20) * 100);
      case 'salt':
        return Math.min(100, (value / 2) * 100);
      default:
        return Math.min(100, value);
    }
  }, [nutrient, value]);
  
  // Determine color based on nutrient type
  const color = useMemo(() => {
    // Gray for zero values
    if (value === 0) return 'bg-gray-400';
    
    // Protein is always green when > 0
    if (nutrient === 'protein') {
      return 'bg-green-500';
    }
    
    // Sugar, saturated fat, salt are always red when > 0
    if (nutrient === 'sugar' || nutrient === 'saturatedFat' || nutrient === 'salt') {
      return 'bg-red-500';
    }
    
    // Fat (regular) keeps existing logic
    if (value <= thresholds.low) return 'bg-green-500';
    if (value <= thresholds.medium) return 'bg-yellow-500';
    if (value <= thresholds.high) return 'bg-orange-500';
    return 'bg-red-500';
  }, [nutrient, value, thresholds]);

  const { t } = useTranslation('common');
  
  // Get translated nutrient labels
  const nutrientLabels = {
    sugar: t('nutrients.sugar'),
    fat: t('nutrients.fat'),
    saturatedFat: t('nutrients.saturatedFat'),
    protein: compact ? t('nutrients.proteinShort') : t('nutrients.protein'),
    salt: t('nutrients.salt')
  };

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-600">{nutrientLabels[nutrient]}</span>
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
