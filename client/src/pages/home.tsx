import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { SlidersHorizontal } from 'lucide-react';

import { getProducts, getCategoryById } from '@/api';
import { Filters, NutriScoreGrade, SortOption, SortOrder } from '@/types';

import Sidebar from '@/components/layout/sidebar';
import ProductGrid from '@/components/products/product-grid';
import Pagination from '@/components/pagination';
import ActiveFilters from '@/components/filters/active-filters';

interface HomeProps {
  initialSearchQuery?: string;
  categoryId?: number;
}

const Home: React.FC<HomeProps> = ({ initialSearchQuery = '', categoryId: propCategoryId }) => {
  const params = useParams<{ id?: string }>();
  const urlCategoryId = params.id ? parseInt(params.id, 10) : undefined;
  const categoryId = propCategoryId || urlCategoryId;
  
  // States
  const [page, setPage] = useState(1);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    nutriScores: [],
    sugar: {},
    fat: {},
    protein: {},
    salt: {}
  });
  
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState<string | undefined>(undefined);
  
  // Initialize search from props
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
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
  
  // Calculate total pages
  const totalPages = data?.totalCount ? Math.ceil(data.totalCount / 12) : 1;
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Handle filter updates
  const handleUpdateFilters = (newFilters: Filters) => {
    setFilters(newFilters);
  };
  
  // Apply filters (will trigger refetch due to dependency in useQuery)
  const handleApplyFilters = () => {
    setPage(1);
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

  return (
    <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row">
      {/* Sidebar - desktop only */}
      <Sidebar 
        categoryId={categoryId}
        filters={filters} 
        onUpdateFilters={handleUpdateFilters}
        onApplyFilters={handleApplyFilters}
      />
      
      {/* Main Content */}
      <main className="flex-grow">
        {/* Mobile filter button */}
        <div className="md:hidden mb-4">
          <button 
            className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 rounded-md px-4 py-2 text-gray-600 hover:bg-gray-50"
            onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
          >
            <SlidersHorizontal className="h-5 w-5" />
            <span>Filters</span>
          </button>
        </div>

        {/* Title and Active Filters */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {searchQuery 
              ? `Meklēšanas rezultāti: "${searchQuery}"`
              : category 
                ? category.nameLv 
                : 'Visi produkti'
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
                Ielādē produktus...
              </p>
            )}
            
            {/* Sort Dropdown */}
            <div className="relative">
              <select 
                className="appearance-none bg-white border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={sortOption === 'nutriScore' ? 'nutri-score' : sortOption}
                onChange={handleSortChange}
              >
                <option value="name">Kārtot pēc: Nosaukuma</option>
                <option value="nutri-score">Kārtot pēc: Nutri-Score</option>
                <option value="sugar">Kārtot pēc: Cukura (no zema uz augstu)</option>
                <option value="fat">Kārtot pēc: Tauki (no zema uz augstu)</option>
                <option value="protein">Kārtot pēc: Olbaltumvielas (no augsta uz zemu)</option>
                <option value="salt">Kārtot pēc: Sāls (no zema uz augstu)</option>
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
