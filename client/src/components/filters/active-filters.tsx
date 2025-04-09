import React from 'react';
import { Filters, NutriScoreGrade } from '@/types';
import { X } from 'lucide-react';

interface ActiveFiltersProps {
  filters: Filters;
  onRemoveFilter: (
    filterType: 'nutriScores' | 'sugar' | 'fat' | 'protein' | 'salt'
  ) => void;
  onClearAllFilters: () => void;
}

const ActiveFilters: React.FC<ActiveFiltersProps> = ({ 
  filters, 
  onRemoveFilter,
  onClearAllFilters
}) => {
  const hasActiveFilters = 
    filters.nutriScores.length > 0 || 
    filters.sugar.min !== undefined || 
    filters.sugar.max !== undefined ||
    filters.fat.min !== undefined ||
    filters.fat.max !== undefined ||
    filters.protein.min !== undefined ||
    filters.protein.max !== undefined ||
    filters.salt.min !== undefined ||
    filters.salt.max !== undefined;
  
  if (!hasActiveFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {filters.nutriScores.length > 0 && (
        <div className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
          <span>Nutri-Score: {filters.nutriScores.join(', ')}</span>
          <button 
            className="ml-1 text-gray-500 hover:text-gray-700"
            onClick={() => onRemoveFilter('nutriScores')}
            aria-label="Noņemt Nutri-Score filtru"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {(filters.sugar.min !== undefined || filters.sugar.max !== undefined) && (
        <div className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
          <span>
            Cukurs: 
            {filters.sugar.min !== undefined && ` > ${filters.sugar.min}g`}
            {filters.sugar.max !== undefined && ` < ${filters.sugar.max}g`}
          </span>
          <button 
            className="ml-1 text-gray-500 hover:text-gray-700"
            onClick={() => onRemoveFilter('sugar')}
            aria-label="Noņemt cukura filtru"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {(filters.fat.min !== undefined || filters.fat.max !== undefined) && (
        <div className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
          <span>
            Tauki: 
            {filters.fat.min !== undefined && ` > ${filters.fat.min}g`}
            {filters.fat.max !== undefined && ` < ${filters.fat.max}g`}
          </span>
          <button 
            className="ml-1 text-gray-500 hover:text-gray-700"
            onClick={() => onRemoveFilter('fat')}
            aria-label="Noņemt tauku filtru"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {(filters.protein.min !== undefined || filters.protein.max !== undefined) && (
        <div className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
          <span>
            Olbaltumvielas: 
            {filters.protein.min !== undefined && ` > ${filters.protein.min}g`}
            {filters.protein.max !== undefined && ` < ${filters.protein.max}g`}
          </span>
          <button 
            className="ml-1 text-gray-500 hover:text-gray-700"
            onClick={() => onRemoveFilter('protein')}
            aria-label="Noņemt olbaltumvielu filtru"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {(filters.salt.min !== undefined || filters.salt.max !== undefined) && (
        <div className="inline-flex items-center bg-gray-100 rounded-full px-3 py-1 text-sm">
          <span>
            Sāls: 
            {filters.salt.min !== undefined && ` > ${filters.salt.min}g`}
            {filters.salt.max !== undefined && ` < ${filters.salt.max}g`}
          </span>
          <button 
            className="ml-1 text-gray-500 hover:text-gray-700"
            onClick={() => onRemoveFilter('salt')}
            aria-label="Noņemt sāls filtru"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Clear All Button */}
      <button 
        className="inline-flex items-center text-primary hover:text-primary/90 text-sm font-medium ml-1"
        onClick={onClearAllFilters}
      >
        Noņemt visus
      </button>
    </div>
  );
};

export default ActiveFilters;
