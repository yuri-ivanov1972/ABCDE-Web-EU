import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getPathWithoutLanguage } from '@/i18n';
import { getCanonicalUrl, getHreflangUrls } from '@/lib/canonical';

import { getProducts, getCategoryById } from '@/api';
import { Filters, NutriScoreGrade, ProductsResponse, SortOption, SortOrder, Store } from '@/types';

// Read server-injected initial product data (eliminates the first API round-trip)
function getServerInitialData(): ProductsResponse | undefined {
  try {
    const el = document.getElementById('__ABCDE_INITIAL_DATA__');
    if (el?.textContent) return JSON.parse(el.textContent) as ProductsResponse;
  } catch { /* ignore parse errors */ }
  return undefined;
}
const serverInitialData = getServerInitialData();

import Sidebar from '@/components/layout/sidebar';
import MobileMenu from '@/components/layout/mobile-menu';
import ProductGrid from '@/components/products/product-grid';
import Pagination from '@/components/pagination';
import ActiveFilters from '@/components/filters/active-filters';

interface HomeProps {
  initialSearchQuery?: string;
  categoryId?: number;
  isMobileFiltersOpen?: boolean;
  onCloseMobileFilters?: () => void;
  onActiveFiltersChange?: (hasActive: boolean) => void;
}

const Home: React.FC<HomeProps> = ({ initialSearchQuery = '', categoryId: propCategoryId, isMobileFiltersOpen = false, onCloseMobileFilters, onActiveFiltersChange }) => {
  const { t, i18n } = useTranslation(['home', 'common']);
  const [location] = useLocation();
  const params = useParams<{ id?: string }>();
  
  // Get the current path without language prefix to check if we're on a category page
  const pathWithoutLang = getPathWithoutLanguage(location);
  const isCategoryRoute = /^\/category\/[a-z0-9-]+$/i.test(pathWithoutLang);
  
  // Only use URL category ID if we're actually on a category route (parse from slug or numeric)
  const urlCategoryId = isCategoryRoute && params.id ? (() => {
    const s = params.id;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const m = s.match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : undefined;
  })() : undefined;
  const categoryId = propCategoryId || urlCategoryId;
  
  // States
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    nutriScores: []
  });
  
  const [sortOption, setSortOption] = useState<SortOption>('nutriScore');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  const [selectedStore, setSelectedStore] = useState<Store | undefined>('rimi');
  
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
  
  // Initialize filters from URL query parameters (for links from product details page)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Parse nutriScores from URL
    const nutriScoresParam = urlParams.get('nutriScores');
    if (nutriScoresParam) {
      const grades = nutriScoresParam.split(',').filter(g => ['A', 'B', 'C', 'D', 'E'].includes(g)) as NutriScoreGrade[];
      if (grades.length > 0) {
        setFilters(prev => ({ ...prev, nutriScores: grades }));
      }
    }
    
    // Parse sortBy from URL
    const sortByParam = urlParams.get('sortBy');
    if (sortByParam && ['name', 'nutriScore', 'sugar', 'fat', 'protein', 'salt'].includes(sortByParam)) {
      setSortOption(sortByParam as SortOption);
    }
    
    // Parse store from URL
    const storeParam = urlParams.get('store');
    if (storeParam && ['rimi', 'maxima'].includes(storeParam)) {
      setSelectedStore(storeParam as Store);
    }
  }, []);

  // Reset page when category or search query changes
  useEffect(() => {
    setPage(1);
  }, [categoryId, searchQuery]);
  
  // Get current category if categoryId is provided
  const { data: category } = useQuery({
    queryKey: ['/api/categories', categoryId],
    queryFn: () => (categoryId ? getCategoryById(categoryId) : null),
    enabled: !!categoryId
  });
  
  // Use server-injected data as placeholder when query matches the default homepage state
  const isDefaultQuery = !categoryId && page === 1 && filters.nutriScores.length === 0
    && !filters.madeInLatvia && sortOption === 'nutriScore' && sortOrder === 'asc'
    && !searchQuery && selectedStore === 'rimi';

  // Fetch products with filters
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/products', categoryId, page, filters, sortOption, sortOrder, searchQuery, selectedStore],
    queryFn: () => getProducts({
      categoryId,
      page,
      pageSize: 12,
      nutriScores: filters.nutriScores.length > 0 ? filters.nutriScores : undefined,
      sortBy: sortOption,
      sortOrder,
      search: searchQuery,
      store: selectedStore,
      madeInLatvia: filters.madeInLatvia
    }),
    // initialData (not placeholderData) prevents an immediate background refetch that would
    // replace the server-injected products with slightly different fresh data → CLS 0.37.
    // initialDataUpdatedAt: Date.now() marks the data as fresh so staleTime applies.
    // After staleTime the query refetches silently in the background (well past CLS window).
    initialData: isDefaultQuery ? serverInitialData : undefined,
    initialDataUpdatedAt: isDefaultQuery && serverInitialData ? Date.now() : undefined,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate total pages based on API response data
  const calculatedPages = data?.totalCount ? Math.ceil(data.totalCount / 12) : 1;
  // Use real page count from API response to ensure proper pagination with filters
  const totalPages = calculatedPages;
  
  // Check if there are any active filters
  const hasActiveFilters = filters.nutriScores.length > 0 || !!filters.madeInLatvia;
  
  // Report active filters state to parent
  useEffect(() => {
    if (onActiveFiltersChange) {
      onActiveFiltersChange(hasActiveFilters);
    }
  }, [hasActiveFilters, onActiveFiltersChange]);
  
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
  const handleRemoveFilter = (filterType: 'nutriScores') => {
    const newFilters = { ...filters };
    newFilters.nutriScores = [];
    
    setFilters(newFilters);
    setPage(1);
    console.log('Removed filter:', filterType);
    refetch();
  };
  
  // Handle remove madeInLatvia filter
  const handleRemoveMadeInLatviaFilter = () => {
    setFilters({ ...filters, madeInLatvia: false });
    setPage(1);
    refetch();
  };
  
  // Clear all filters
  const handleClearAllFilters = () => {
    setFilters({
      nutriScores: [],
      madeInLatvia: false
    });
    setPage(1);
    console.log('Cleared all filters');
    refetch();
  };
  
  // Handle mobile filters applied
  const handleMobileFiltersApply = (nutriScores: NutriScoreGrade[], madeInLatvia?: boolean) => {
    // Close mobile filters panel
    if (onCloseMobileFilters) {
      onCloseMobileFilters();
    }
    
    // Apply the filter values to the main filters state
    const newFilters: Filters = {
      nutriScores: nutriScores,
      madeInLatvia: madeInLatvia
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

  const canonicalPath = category?.slug ? `/category/${category.slug}` : (categoryId ? `/category/${categoryId}` : '/');
  const currentLang = i18n.language?.split('-')[0] || 'lv';
  const hreflangUrls = getHreflangUrls(canonicalPath);

  return (
    <>
      <Helmet>
        <link rel="canonical" href={getCanonicalUrl(canonicalPath, currentLang)} />
        {hreflangUrls.map(({ lang, url }) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={url} />
        ))}
      </Helmet>
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row">
        {/* Mobile Menu - shown/hidden based on state */}
        <MobileMenu 
          isOpen={isMobileFiltersOpen} 
          categoryId={categoryId}
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onApplyFilters={handleMobileFiltersApply}
        />
        
        {/* Sidebar - desktop only */}
        <Sidebar 
          categoryId={categoryId}
          filters={filters} 
          onUpdateFilters={handleUpdateFilters}
          onApplyFilters={handleApplyFilters}
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
        />
      
      {/* Main Content */}
      <main className="flex-grow">
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
          <div className="flex flex-col-reverse md:flex-row md:justify-end md:items-center gap-2 mb-4">
            {/* Loading indicator */}
            {isLoading && (
              <p className="text-sm text-gray-600 md:mr-auto">
                {t('home:loading')}
              </p>
            )}
            
            {/* Sort Dropdown */}
            <div className="relative self-end md:self-auto">
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
    </>
  );
};

export default Home;
