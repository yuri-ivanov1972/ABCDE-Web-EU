import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Category } from '@/types';
import { getCategories, getCategoryById, getCategoryPath } from '@/api';
import NutriScoreFilter from '@/components/filters/nutri-score-filter';
import StoreFilter from '@/components/filters/store-filter';
import { Filters, NutriScoreGrade, Store } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import LangLink from '@/components/routing/LangLink';

interface SidebarProps {
  categoryId?: number;
  filters: Filters;
  onUpdateFilters: (filters: Filters) => void;
  onApplyFilters: () => void;
  selectedStore?: Store;
  onStoreChange?: (store?: Store) => void;
}

// Recursive category component to handle any depth of nesting
interface CategoryItemProps {
  category: Category;
  currentCategoryId?: number;
  depth: number;
  pathOfOpenCategories: number[];
}

const CategoryItem: React.FC<CategoryItemProps> = ({ 
  category, 
  currentCategoryId, 
  depth,
  pathOfOpenCategories
}) => {
  const { i18n } = useTranslation();
  // Initialize expanded state based on:
  // 1. Whether this category is in the path of open categories
  // 2. Whether this category is the currently selected category
  const [isExpanded, setIsExpanded] = useState(
    pathOfOpenCategories.includes(category.categoryId) || 
    currentCategoryId === category.categoryId
  );
  
  // Always fetch subcategories so we know if there are any
  const { data: subcategories = [] } = useQuery({
    queryKey: ['/api/categories', 'subcategories', category.categoryId],
    queryFn: () => getCategories(undefined, category.categoryId)
  });

  const isSelected = currentCategoryId === category.categoryId;
  const hasSubcategories = subcategories && subcategories.length > 0;
  
  // New improved handling of category clicks with simplified behavior
  const handleCategoryClick = (e: React.MouseEvent) => {
    // We don't prevent default navigation anymore
    // Instead, if it has subcategories and isn't expanded, expand it
    if (hasSubcategories && !isExpanded) {
      setIsExpanded(true);
    }
    // Navigation will happen naturally through the Link component
    // This allows both navigation and expansion with one click
  };

  return (
    <li>
      <div className="flex items-center">
        <LangLink 
          href={`/category/${category.slug || category.categoryId}`}
          onClick={handleCategoryClick}
          className={`flex-grow block px-3 py-1.5 rounded-md ${
            isSelected
              ? 'bg-primary text-white font-medium'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <div className="flex items-center justify-between w-full">
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
          </div>
        </LangLink>
      </div>
      
      {/* Display subcategories if expanded */}
      {isExpanded && hasSubcategories && (
        <ul className={`mt-1 space-y-1 ${depth === 1 ? 'ml-4' : 'ml-6'}`}>
          {subcategories.map(subcat => (
            <CategoryItem 
              key={subcat.categoryId}
              category={subcat}
              currentCategoryId={currentCategoryId}
              depth={depth + 1}
              pathOfOpenCategories={pathOfOpenCategories}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ categoryId, filters, onUpdateFilters, onApplyFilters, selectedStore, onStoreChange }) => {
  const [location] = useLocation();
  const { t } = useTranslation(['filters', 'categories']);
  
  // Fetch main level categories
  const { data: mainCategories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/categories', { level: 1 }],
    queryFn: () => getCategories(1)
  });
  
  // Fetch current category
  const { data: currentCategory } = useQuery({
    queryKey: ['/api/categories', categoryId],
    queryFn: () => (categoryId ? getCategoryById(categoryId) : null),
    enabled: !!categoryId
  });

  // Fetch path to the current category (to determine which categories should be expanded)
  const { data: categoryPath = [] } = useQuery({
    queryKey: ['/api/categories', categoryId, 'path'],
    queryFn: () => categoryId ? getCategoryPath(categoryId) : Promise.resolve([]),
    enabled: !!categoryId
  });
  
  // Handle nutri-score filter update
  const handleToggleNutriScore = (score: NutriScoreGrade) => {
    const updatedScores = [...filters.nutriScores];
    const index = updatedScores.indexOf(score);
    
    if (index >= 0) {
      updatedScores.splice(index, 1);
    } else {
      updatedScores.push(score);
    }
    
    onUpdateFilters({
      ...filters,
      nutriScores: updatedScores
    });
  };

  // Get parent ID chain for the current category
  const pathOfOpenCategories = categoryPath?.map((cat: Category) => cat.categoryId) || 
    (currentCategory?.parentCategoryId ? [currentCategory.parentCategoryId, currentCategory.categoryId] : 
    categoryId ? [categoryId] : []);

  return (
    <aside className="hidden md:block w-64 flex-shrink-0 pr-6">
      {/* Categories */}
      <div className="mb-8">
        <h2 className="font-medium text-lg text-gray-900 mb-3">{t('categories:title')}</h2>
        
        {/* Home link without breadcrumbs */}
        <div className="mb-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <LangLink href="/" className="hover:text-primary">{t('categories:allCategories')}</LangLink>
          </div>
        </div>
        
        {/* Category List */}
        {isLoadingCategories ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {mainCategories.map(category => (
              <CategoryItem 
                key={category.categoryId}
                category={category}
                currentCategoryId={categoryId}
                depth={1}
                pathOfOpenCategories={pathOfOpenCategories}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      <div>
        <h2 className="font-medium text-lg text-gray-900 mb-3">{t('filters:title')}</h2>
        
        {/* Store Filter */}
        {onStoreChange && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Veikals</h3>
            <StoreFilter 
              selectedStore={selectedStore}
              onStoreChange={onStoreChange}
            />
          </div>
        )}
        
        {/* Nutri-Score Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">{t('filters:nutriScore.label')}</h3>
          <NutriScoreFilter 
            selectedScores={filters.nutriScores}
            onToggleScore={handleToggleNutriScore}
          />
        </div>
        
        {/* Made in Latvia Filter */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.madeInLatvia || false}
              onChange={(e) => onUpdateFilters({ ...filters, madeInLatvia: e.target.checked })}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <span className="text-sm font-medium text-gray-700">{t('filters:madeInLatvia.label')}</span>
          </label>
        </div>
        
        {/* Apply Filters Button */}
        <button 
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary mt-2"
          onClick={onApplyFilters}
        >
          {t('filters:applyFilters')}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
