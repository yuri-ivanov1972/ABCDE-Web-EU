import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getCategories } from '@/api';
import LangLink from '@/components/routing/LangLink';
import NutriScoreFilter from '@/components/filters/nutri-score-filter';
import StoreFilter from '@/components/filters/store-filter';
import { NutriScoreGrade, Category, Store } from '@/types';

interface MobileMenuProps {
  isOpen: boolean;
  categoryId?: number;
  selectedStore?: Store;
  onStoreChange?: (store?: Store) => void;
  onApplyFilters?: (nutriScores: NutriScoreGrade[]) => void;
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
        <LangLink 
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
        </LangLink>
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

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, categoryId, selectedStore, onStoreChange, onApplyFilters }) => {
  const { t } = useTranslation(['filters', 'categories', 'common']);
  const [selectedNutriScores, setSelectedNutriScores] = useState<NutriScoreGrade[]>([]);

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

  const handleApplyFilters = () => {
    if (onApplyFilters) {
      onApplyFilters(selectedNutriScores);
      console.log('Applied filters:', { nutriScores: selectedNutriScores });
    }
  };

  return (
    <div 
      className={`md:hidden bg-white shadow-md transition-all duration-300 ease-in-out flex flex-col ${
        isOpen ? 'max-h-[85vh]' : 'max-h-0 overflow-hidden'
      }`}
    >
      <nav className="py-3 px-4 flex-1 overflow-y-auto min-h-0">
        <h3 className="font-medium text-gray-900 mb-2">{t('categories:title')}</h3>
        <ul className="space-y-1">
          <li className="mb-2">
            <LangLink 
              href="/"
              className={`block px-2 py-1.5 rounded ${
                !categoryId 
                  ? 'bg-primary text-white font-medium' 
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {t('categories:allCategories')}
            </LangLink>
          </li>
          {categories.map((category) => (
            <MobileCategoryItem 
              key={category.categoryId}
              category={category}
              currentCategoryId={categoryId}
            />
          ))}
        </ul>
      </nav>
      
      <div className="border-t border-gray-200 py-3 px-4 flex-shrink-0">
        <h3 className="font-medium text-gray-900 mb-2">{t('filters:title')}</h3>
        
        {/* Mobile Store Filter */}
        {onStoreChange && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{t('filters:store.label')}</h4>
            <StoreFilter 
              selectedStore={selectedStore}
              onStoreChange={onStoreChange}
            />
          </div>
        )}
        
        {/* Mobile Nutri-Score Filter */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('filters:nutriScore.label')}</h4>
          <div className="flex space-x-2">
            <NutriScoreFilter 
              selectedScores={selectedNutriScores}
              onToggleScore={toggleNutriScoreFilter}
              size="small"
            />
          </div>
        </div>

        {/* Apply Filters Button */}
        <button 
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          onClick={handleApplyFilters}
        >
          {t('filters:applyFilters')}
        </button>
      </div>
    </div>
  );
};

export default MobileMenu;
