import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Filters, NutrientFilter } from '@/types';

interface NutrientFiltersProps {
  filters: Filters;
  onUpdateFilter: (
    nutrient: 'sugar' | 'fat' | 'protein' | 'salt',
    type: 'min' | 'max',
    value: number
  ) => void;
}

const NutrientFilters: React.FC<NutrientFiltersProps> = ({ 
  filters, 
  onUpdateFilter 
}) => {
  const { t } = useTranslation('filters');
  // Display values for the sliders
  const [displayValues, setDisplayValues] = useState({
    sugar: filters.sugar.max ? `< ${filters.sugar.max}g` : '< 5g',
    fat: filters.fat.max ? `< ${filters.fat.max}g` : '< 10g',
    protein: filters.protein.min ? `> ${filters.protein.min}g` : '> 5g',
    salt: filters.salt.max ? `< ${filters.salt.max}g` : '< 1g'
  });

  useEffect(() => {
    setDisplayValues({
      sugar: filters.sugar.max ? `< ${filters.sugar.max}g` : '< 5g',
      fat: filters.fat.max ? `< ${filters.fat.max}g` : '< 10g',
      protein: filters.protein.min ? `> ${filters.protein.min}g` : '> 5g',
      salt: filters.salt.max ? `< ${filters.salt.max}g` : '< 1g'
    });
  }, [filters]);

  const handleSugarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDisplayValues(prev => ({ ...prev, sugar: `< ${value}g` }));
    onUpdateFilter('sugar', 'max', value);
  };

  const handleFatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDisplayValues(prev => ({ ...prev, fat: `< ${value}g` }));
    onUpdateFilter('fat', 'max', value);
  };

  const handleProteinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDisplayValues(prev => ({ ...prev, protein: `> ${value}g` }));
    onUpdateFilter('protein', 'min', value);
  };

  const handleSaltChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDisplayValues(prev => ({ ...prev, salt: `< ${value}g` }));
    onUpdateFilter('salt', 'max', value);
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{t('nutrients.title')}</h3>
      
      {/* Sugar Filter */}
      <div className="mb-4">
        <label className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{t('nutrients.sugar')}</span>
          <span>{displayValues.sugar}</span>
        </label>
        <input 
          type="range" 
          min="0" 
          max="20" 
          step="1" 
          value={filters.sugar.max || 5}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
          onChange={handleSugarChange}
        />
      </div>
      
      {/* Fat Filter */}
      <div className="mb-4">
        <label className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{t('nutrients.fat')}</span>
          <span>{displayValues.fat}</span>
        </label>
        <input 
          type="range" 
          min="0" 
          max="30" 
          step="1" 
          value={filters.fat.max || 10}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
          onChange={handleFatChange}
        />
      </div>
      
      {/* Protein Filter */}
      <div className="mb-4">
        <label className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{t('nutrients.protein')}</span>
          <span>{displayValues.protein}</span>
        </label>
        <input 
          type="range" 
          min="0" 
          max="30" 
          step="1" 
          value={filters.protein.min || 5}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
          onChange={handleProteinChange}
        />
      </div>
      
      {/* Salt Filter */}
      <div className="mb-4">
        <label className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{t('nutrients.salt')}</span>
          <span>{displayValues.salt}</span>
        </label>
        <input 
          type="range" 
          min="0" 
          max="3" 
          step="0.1" 
          value={filters.salt.max || 1}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" 
          onChange={handleSaltChange}
        />
      </div>
    </div>
  );
};

export default NutrientFilters;
