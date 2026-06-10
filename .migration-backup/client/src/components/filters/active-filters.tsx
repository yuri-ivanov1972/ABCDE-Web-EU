import React from 'react';
import { Filters, NutriScoreGrade } from '@/types';
import { X } from 'lucide-react';

interface ActiveFiltersProps {
  filters: Filters;
  onRemoveFilter: (filterType: 'nutriScores') => void;
  onClearAllFilters: () => void;
}

const ActiveFilters: React.FC<ActiveFiltersProps> = ({ 
  filters, 
  onRemoveFilter,
  onClearAllFilters
}) => {
  const hasActiveFilters = filters.nutriScores.length > 0;
  
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
