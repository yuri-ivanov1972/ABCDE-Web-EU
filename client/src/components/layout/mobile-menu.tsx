import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCategories } from '@/api';
import NutriScoreFilter from '@/components/filters/nutri-score-filter';
import { NutriScoreGrade, Category } from '@/types';

interface MobileMenuProps {
  isOpen: boolean;
  categoryId?: number;
  onApplyFilters?: (nutriScores: NutriScoreGrade[], sugarMin?: number, sugarMax?: number, 
    fatMin?: number, fatMax?: number, proteinMin?: number, proteinMax?: number, 
    saltMin?: number, saltMax?: number) => void;
}

// Mobile category component
interface MobileCategoryItemProps {
  category: Category;
  currentCategoryId?: number;
}

const MobileCategoryItem: React.FC<MobileCategoryItemProps> = ({ 
  category,
  currentCategoryId
}) => {
  const { i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(currentCategoryId === category.categoryId);
  
  // Always fetch subcategories so we know if there are any
  const { data: subcategories = [] } = useQuery({
    queryKey: ['/api/categories', 'subcategories', category.categoryId],
    queryFn: () => getCategories(undefined, category.categoryId)
  });

  const hasSubcategories = subcategories && subcategories.length > 0;
  const isSelected = currentCategoryId === category.categoryId;
  
  // New simplified behavior
  const handleCategoryClick = (e: React.MouseEvent) => {
    // If it has subcategories and isn't expanded, expand it
    if (hasSubcategories && !isExpanded) {
      setIsExpanded(true);
    }
    // No preventDefault - allow navigation to happen normally
  };

  return (
    <li className="mb-2">
      <div className="flex items-center">
        <Link 
          href={`/category/${category.categoryId}`}
          className={`flex-grow flex items-center justify-between px-2 py-1.5 rounded ${
            isSelected 
              ? 'bg-primary text-white font-medium' 
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          onClick={handleCategoryClick}
        >
          <span>{i18n.language.startsWith('en') ? (category.nameEn || category.nameLv) : category.nameLv}</span>
          
          {hasSubcategories && (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              onClick={(e) => {
                e.stopPropagation(); // Prevent navigation when clicking directly on arrow
                setIsExpanded(!isExpanded);
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          )}
        </Link>
      </div>
      
      {/* Display subcategories if expanded */}
      {isExpanded && hasSubcategories && (
        <ul className="ml-4 mt-1 space-y-1">
          {subcategories.map(subcat => (
            <MobileCategoryItem 
              key={subcat.categoryId}
              category={subcat}
              currentCategoryId={currentCategoryId}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, categoryId, onApplyFilters }) => {
  const [selectedNutriScores, setSelectedNutriScores] = useState<NutriScoreGrade[]>([]);
  const [filters, setFilters] = useState({
    sugar: { min: '', max: '' },
    fat: { min: '', max: '' },
    protein: { min: '', max: '' },
    salt: { min: '', max: '' }
  });

  // Fetch main categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/categories', { level: 1 }],
    queryFn: () => getCategories(1)
  });

  const toggleNutriScoreFilter = (score: NutriScoreGrade) => {
    if (selectedNutriScores.includes(score)) {
      setSelectedNutriScores(selectedNutriScores.filter(s => s !== score));
    } else {
      setSelectedNutriScores([...selectedNutriScores, score]);
    }
  };

  const updateFilters = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    const [filterName, filterType] = name.split('.');
    
    setFilters(prev => ({
      ...prev,
      [filterName]: {
        ...prev[filterName as keyof typeof prev],
        [filterType]: value
      }
    }));
  };

  const handleApplyFilters = () => {
    if (onApplyFilters) {
      // Convert string values to numbers or undefined for API
      const sugarMin = filters.sugar.min ? parseFloat(filters.sugar.min) : undefined;
      const sugarMax = filters.sugar.max ? parseFloat(filters.sugar.max) : undefined;
      const fatMin = filters.fat.min ? parseFloat(filters.fat.min) : undefined;
      const fatMax = filters.fat.max ? parseFloat(filters.fat.max) : undefined;
      const proteinMin = filters.protein.min ? parseFloat(filters.protein.min) : undefined;
      const proteinMax = filters.protein.max ? parseFloat(filters.protein.max) : undefined;
      const saltMin = filters.salt.min ? parseFloat(filters.salt.min) : undefined;
      const saltMax = filters.salt.max ? parseFloat(filters.salt.max) : undefined;
      
      // Call the parent component's filter handler
      onApplyFilters(
        selectedNutriScores,
        sugarMin, sugarMax, 
        fatMin, fatMax, 
        proteinMin, proteinMax, 
        saltMin, saltMax
      );
      
      console.log('Applied filters:', { 
        nutriScores: selectedNutriScores,
        sugarMin, sugarMax,
        fatMin, fatMax,
        proteinMin, proteinMax,
        saltMin, saltMax
      });
    }
  };

  return (
    <div 
      className={`md:hidden bg-white shadow-md transition-all duration-300 ease-in-out overflow-hidden ${
        isOpen ? 'max-h-[1000px]' : 'max-h-0'
      }`}
    >
      <nav className="py-3 px-4">
        <div className="mb-4">
          <Link 
            href="/product-search" 
            className="block py-2 text-gray-700 hover:text-primary"
          >
            Meklēt pēc URL
          </Link>
        </div>
        <h3 className="font-medium text-gray-900 mb-2">Kategorijas</h3>
        <ul className="space-y-1">
          {categories.map((category) => (
            <MobileCategoryItem 
              key={category.categoryId}
              category={category}
              currentCategoryId={categoryId}
            />
          ))}
        </ul>
      </nav>
      
      <div className="border-t border-gray-200 py-3 px-4">
        <h3 className="font-medium text-gray-900 mb-2">Filtri</h3>
        
        {/* Mobile Nutri-Score Filter */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Nutri-Score</h4>
          <div className="flex space-x-2">
            <NutriScoreFilter 
              selectedScores={selectedNutriScores}
              onToggleScore={toggleNutriScoreFilter}
              size="small"
            />
          </div>
        </div>

        {/* Mobile Nutrient Filters */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Uzturvielas (100g/ml)</h4>
          
          {/* Sugar Filter */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Cukurs</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                name="sugar.min"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.sugar.min}
                onChange={updateFilters}
              >
                <option value="">Min</option>
                <option value="0">0g</option>
                <option value="2">2g</option>
                <option value="5">5g</option>
              </select>
              <select 
                name="sugar.max"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.sugar.max}
                onChange={updateFilters}
              >
                <option value="">Max</option>
                <option value="5">5g</option>
                <option value="10">10g</option>
                <option value="15">15g</option>
                <option value="20">20g</option>
              </select>
            </div>
          </div>
          
          {/* Fat Filter */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Tauki</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                name="fat.min"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.fat.min}
                onChange={updateFilters}
              >
                <option value="">Min</option>
                <option value="0">0g</option>
                <option value="2">2g</option>
                <option value="5">5g</option>
              </select>
              <select 
                name="fat.max"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.fat.max}
                onChange={updateFilters}
              >
                <option value="">Max</option>
                <option value="5">5g</option>
                <option value="10">10g</option>
                <option value="20">20g</option>
                <option value="30">30g</option>
              </select>
            </div>
          </div>
          
          {/* Protein Filter */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Olbaltumvielas</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                name="protein.min"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.protein.min}
                onChange={updateFilters}
              >
                <option value="">Min</option>
                <option value="5">5g</option>
                <option value="10">10g</option>
                <option value="15">15g</option>
              </select>
              <select 
                name="protein.max"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.protein.max}
                onChange={updateFilters}
              >
                <option value="">Max</option>
                <option value="15">15g</option>
                <option value="20">20g</option>
                <option value="30">30g</option>
                <option value="40">40g</option>
              </select>
            </div>
          </div>
          
          {/* Salt Filter */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Sāls</label>
            <div className="grid grid-cols-2 gap-2">
              <select 
                name="salt.min"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.salt.min}
                onChange={updateFilters}
              >
                <option value="">Min</option>
                <option value="0">0g</option>
                <option value="0.1">0.1g</option>
                <option value="0.5">0.5g</option>
              </select>
              <select 
                name="salt.max"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                value={filters.salt.max}
                onChange={updateFilters}
              >
                <option value="">Max</option>
                <option value="0.5">0.5g</option>
                <option value="1">1g</option>
                <option value="1.5">1.5g</option>
                <option value="2">2g</option>
              </select>
            </div>
          </div>
        </div>

        {/* Apply Filters Button */}
        <button 
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          onClick={handleApplyFilters}
        >
          Pielietot filtrus
        </button>
      </div>
    </div>
  );
};

export default MobileMenu;
