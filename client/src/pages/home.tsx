import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useTranslation } from 'react-i18next';
import { getPathWithoutLanguage } from '@/i18n';
import { SlidersHorizontal } from 'lucide-react';

import { getProducts, getCategoryById } from '@/api';
import { Filters, NutriScoreGrade, SortOption, SortOrder } from '@/types';

import Sidebar from '@/components/layout/sidebar';
import MobileMenu from '@/components/layout/mobile-menu';
import ProductGrid from '@/components/products/product-grid';
import Pagination from '@/components/pagination';
import ActiveFilters from '@/components/filters/active-filters';

interface HomeProps {
  initialSearchQuery?: string;
  categoryId?: number;
  isMobileFiltersOpen?: boolean;
  toggleMobileFilters?: () => void;
  onFiltersChange?: (hasActiveFilters: boolean) => void;
}

const Home: React.FC<HomeProps> = ({ initialSearchQuery = '', categoryId: propCategoryId, isMobileFiltersOpen = false, toggleMobileFilters, onFiltersChange }) => {
  const { t, ready, i18n } = useTranslation(['home', 'common']);
  const [location] = useLocation();
  const params = useParams<{ id?: string }>();
  
  // Get the current path without language prefix to check if we're on a category page
  const pathWithoutLang = getPathWithoutLanguage(location);
  const isCategoryRoute = /^\/category\/\d+$/.test(pathWithoutLang);
  
  // Only use URL category ID if we're actually on a category route
  const urlCategoryId = isCategoryRoute && params.id ? parseInt(params.id, 10) : undefined;
  const categoryId = propCategoryId || urlCategoryId;
  
  // States
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    nutriScores: [],
    sugar: {},
    fat: {},
    protein: {},
    salt: {}
  });
  
  const [sortOption, setSortOption] = useState<SortOption>('nutriScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  
  // Initialize search from props
  useEffect(() => {
    // Trim the search query to remove any leading or trailing spaces
    // This helps ensure consistency between mobile and desktop search
    if (initialSearchQuery) {
      const trimmedQuery = initialSearchQuery.trim();
      setSearchQuery(trimmedQuery.length > 0 ? trimmedQuery : undefined);
    } else {
      setSearchQuery(undefined);
    }
  }, [initialSearchQuery]);

  // Reset page when category changes
  useEffect(() => {
    setPage(1);
  }, [categoryId]);
  
  // Get current category if categoryId is provided
  const { data: category } = useQuery({
    queryKey: ['/api/categories', categoryId],
    queryFn: () => (categoryId ? getCategoryById(categoryId) : null),
    enabled: !!categoryId
  });
  
  // Fetch products with filters
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/products', categoryId, page, filters, sortOption, sortOrder, searchQuery],
    queryFn: () => getProducts({
      categoryId,
      page,
      pageSize: 12,
      nutriScores: filters.nutriScores.length > 0 ? filters.nutriScores : undefined,
      sugarMin: filters.sugar.min,
      sugarMax: filters.sugar.max,
      fatMin: filters.fat.min,
      fatMax: filters.fat.max,
      proteinMin: filters.protein.min,
      proteinMax: filters.protein.max,
      saltMin: filters.salt.min,
      saltMax: filters.salt.max,
      sortBy: sortOption,
      sortOrder,
      search: searchQuery
    })
  });
  
  // Calculate total pages based on API response data
  const calculatedPages = data?.totalCount ? Math.ceil(data.totalCount / 12) : 1;
  // Use real page count from API response to ensure proper pagination with filters
  const totalPages = calculatedPages;
  
  // Check if there are any active filters for the header indicator
  const hasActiveFilters = 
    filters.nutriScores.length > 0 ||
    Object.values(filters.sugar).some(v => v !== undefined) ||
    Object.values(filters.fat).some(v => v !== undefined) ||
    Object.values(filters.protein).some(v => v !== undefined) ||
    Object.values(filters.salt).some(v => v !== undefined);
  
  // Notify parent when filters change
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(hasActiveFilters);
    }
  }, [hasActiveFilters, onFiltersChange]);
  
  // Log data for debugging pagination with filters
  useEffect(() => {
    if (data) {
      console.log('API response - Products count:', data.products.length);
      console.log('API response - Total count:', data.totalCount);
      console.log('Calculated pages:', calculatedPages);
      console.log('Current page:', page, 'Total pages:', totalPages);
    }
  }, [data, calculatedPages, totalPages, page]);
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    console.log('Changing page from', page, 'to', newPage, 'with current filters:', filters);
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Handle filter updates
  const handleUpdateFilters = (newFilters: Filters) => {
    setFilters(newFilters);
  };
  
  // Apply filters (will trigger refetch due to dependency in useQuery)
  const handleApplyFilters = () => {
    // Reset to page 1 when applying filters
    setPage(1);
    console.log('Applying filters:', filters);
    // Refetch products with the current filters
    refetch();
  };
  
  // Handle remove filter
  const handleRemoveFilter = (filterType: 'nutriScores' | 'sugar' | 'fat' | 'protein' | 'salt') => {
    const newFilters = { ...filters };
    
    if (filterType === 'nutriScores') {
      newFilters.nutriScores = [];
    } else {
      newFilters[filterType] = {};
    }
    
    setFilters(newFilters);
    setPage(1);
    console.log('Removed filter:', filterType);
    // Immediately refetch to update results with removed filter
    refetch();
  };
  
  // Clear all filters
  const handleClearAllFilters = () => {
    setFilters({
      nutriScores: [],
      sugar: {},
      fat: {},
      protein: {},
      salt: {}
    });
    setPage(1);
    console.log('Cleared all filters');
    // Immediately refetch to update results with all filters cleared
    refetch();
  };
  
  // Handle mobile filters applied
  const handleMobileFiltersApply = (
    nutriScores: NutriScoreGrade[],
    sugarMin?: number, sugarMax?: number,
    fatMin?: number, fatMax?: number,
    proteinMin?: number, proteinMax?: number,
    saltMin?: number, saltMax?: number
  ) => {
    // Close mobile filters panel
    if (isMobileFiltersOpen && toggleMobileFilters) {
      toggleMobileFilters();
    }
    
    // Apply the filter values to the main filters state
    const newFilters: Filters = {
      nutriScores: nutriScores,
      sugar: { min: sugarMin, max: sugarMax },
      fat: { min: fatMin, max: fatMax },
      protein: { min: proteinMin, max: proteinMax },
      salt: { min: saltMin, max: saltMax }
    };
    
    // Update filters state and trigger refetch
    setFilters(newFilters);
    setPage(1);
    console.log('Applied mobile filters:', newFilters);
    refetch();
  };

  // Handle sort change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === 'name' || value === 'nutri-score' || value === 'sugar' || 
        value === 'fat' || value === 'protein' || value === 'salt') {
      setSortOption(value === 'nutri-score' ? 'nutriScore' : value);
      
      // For nutri-score, lower is better, so default to asc
      // For protein, higher is better, so default to desc
      // For others, default to asc
      if (value === 'protein') {
        setSortOrder('desc');
      } else {
        setSortOrder('asc');
      }
    }
  };

  // Return loading state while translations are loading
  if (!ready) {
    return (
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row">
        <div className="w-64 hidden md:block">
          <div className="bg-gray-100 rounded-md h-96 animate-pulse"></div>
        </div>
        <main className="flex-grow">
          <div className="mb-6">
            <div className="h-8 bg-gray-100 rounded-md w-64 mb-4 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-md h-64 animate-pulse"></div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row">
      {/* Mobile Menu - shown/hidden based on state */}
      <MobileMenu 
        isOpen={isMobileFiltersOpen} 
        categoryId={categoryId}
        onApplyFilters={handleMobileFiltersApply}
      />
      
      {/* Sidebar - desktop only */}
      <Sidebar 
        categoryId={categoryId}
        filters={filters} 
        onUpdateFilters={handleUpdateFilters}
        onApplyFilters={handleApplyFilters}
      />
      
      {/* Main Content */}
      <main className="flex-grow">
        {/* Mobile filter button moved to header, this section is now empty */}

        {/* Title and Active Filters */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {searchQuery && searchQuery.length > 0
              ? `${t('home:searchResults')}"${searchQuery}"`
              : category 
                ? (i18n.language.startsWith('en') ? (category.nameEn || category.nameLv) : category.nameLv)
                : t('home:allProducts')
            }
          </h1>
          
          {/* Active Filters Pills */}
          <ActiveFilters 
            filters={filters}
            onRemoveFilter={handleRemoveFilter}
            onClearAllFilters={handleClearAllFilters}
          />
        </div>

        {/* Product Results */}
        <div className="mb-6">
          {/* Sort Options */}
          <div className="flex justify-end items-center mb-4">
            {/* Loading indicator */}
            {isLoading && (
              <p className="text-sm text-gray-600 mr-auto">
                {t('home:loading')}
              </p>
            )}
            
            {/* Sort Dropdown */}
            <div className="relative">
              <select 
                className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={sortOption === 'nutriScore' ? 'nutri-score' : sortOption}
                onChange={handleSortChange}
              >
                <option value="name">{t('home:sorting.label')} {t('home:sorting.name')}</option>
                <option value="nutri-score">{t('home:sorting.label')} {t('home:sorting.nutriScore')}</option>
                <option value="sugar">{t('home:sorting.label')} {t('home:sorting.sugarLowHigh')}</option>
                <option value="fat">{t('home:sorting.label')} {t('home:sorting.fatLowHigh')}</option>
                <option value="protein">{t('home:sorting.label')} {t('home:sorting.proteinHighLow')}</option>
                <option value="salt">{t('home:sorting.label')} {t('home:sorting.saltLowHigh')}</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <ProductGrid 
            products={data?.products || []} 
            isLoading={isLoading} 
          />
          
          {/* Pagination */}
          <Pagination 
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </main>
    </div>
  );
};

export default Home;
