import React from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Category } from '@/types';
import { getCategories, getCategoryById, getSubcategories } from '@/api';
import NutriScoreFilter from '@/components/filters/nutri-score-filter';
import NutrientFilters from '@/components/filters/nutrient-filters';
import { Filters, NutrientFilter, NutriScoreGrade } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

interface SidebarProps {
  categoryId?: number;
  filters: Filters;
  onUpdateFilters: (filters: Filters) => void;
  onApplyFilters: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ categoryId, filters, onUpdateFilters, onApplyFilters }) => {
  const [location] = useLocation();
  
  // Fetch main level categories
  const { data: mainCategories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/categories', { level: 1 }],
    queryFn: () => getCategories(1)
  });
  
  // Fetch current category
  const { data: currentCategory } = useQuery({
    queryKey: ['/api/categories', categoryId],
    queryFn: () => (categoryId ? getCategoryById(categoryId) : null),
    enabled: !!categoryId
  });
  
  // Fetch subcategories if a category is selected
  const { data: subcategories } = useQuery({
    queryKey: ['/api/categories', 'subcategories', categoryId],
    queryFn: () => (categoryId ? getCategories(undefined, categoryId) : []),
    enabled: !!categoryId
  });
  
  // Handle nutrient filter update
  const handleUpdateNutrientFilter = (
    nutrient: 'sugar' | 'fat' | 'protein' | 'salt',
    type: 'min' | 'max',
    value: number
  ) => {
    const updatedFilters = { ...filters };
    updatedFilters[nutrient] = {
      ...updatedFilters[nutrient],
      [type]: value
    };
    onUpdateFilters(updatedFilters);
  };
  
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

  return (
    <aside className="hidden md:block w-64 flex-shrink-0 pr-6">
      {/* Categories */}
      <div className="mb-8">
        <h2 className="font-medium text-lg text-gray-900 mb-3">Categories</h2>
        
        {/* Breadcrumbs for subcategory navigation */}
        {currentCategory && (
          <div className="mb-4">
            <div className="flex items-center text-sm text-gray-500 mb-2">
              <Link href="/" className="hover:text-primary">All Categories</Link>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-gray-800">{currentCategory.nameEn}</span>
            </div>
          </div>
        )}
        
        {/* Category List */}
        {isLoadingCategories ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {mainCategories?.map((category) => (
              <li key={category.categoryId}>
                <Link 
                  href={`/category/${category.categoryId}`}
                  className={`block px-3 py-2 rounded-md ${
                    categoryId === category.categoryId
                      ? 'bg-primary bg-opacity-10 text-primary font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {category.nameEn}
                </Link>
                
                {/* Subcategories */}
                {categoryId === category.categoryId && subcategories && subcategories.length > 0 && (
                  <ul className="mt-1 ml-4 space-y-1">
                    {subcategories.map((subcat) => (
                      <li key={subcat.categoryId}>
                        <Link 
                          href={`/category/${subcat.categoryId}`}
                          className="block px-3 py-1.5 rounded-md hover:bg-gray-100 text-gray-700"
                        >
                          {subcat.nameEn}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Filters */}
      <div>
        <h2 className="font-medium text-lg text-gray-900 mb-3">Filters</h2>
        
        {/* Nutri-Score Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Nutri-Score</h3>
          <NutriScoreFilter 
            selectedScores={filters.nutriScores}
            onToggleScore={handleToggleNutriScore}
          />
        </div>
        
        {/* Nutrient Filters */}
        <NutrientFilters 
          filters={filters}
          onUpdateFilter={handleUpdateNutrientFilter}
        />
        
        {/* Apply Filters Button */}
        <button 
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary mt-2"
          onClick={onApplyFilters}
        >
          Apply Filters
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
