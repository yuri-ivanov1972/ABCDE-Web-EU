import React, { useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangLink from '@/components/routing/LangLink';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import MobileMenu from './mobile-menu';
import abcdeLogo from '@assets/abcde_logo.svg';
import { NutriScoreGrade } from '@/types';

interface HeaderProps {
  isMobileFiltersOpen: boolean;
  toggleMobileFilters: () => void;
  onSearch: (query: string) => void;
  categoryId?: number;
  onApplyMobileFilters?: (nutriScores: NutriScoreGrade[], sugarMin?: number, sugarMax?: number, 
    fatMin?: number, fatMax?: number, proteinMin?: number, proteinMax?: number, 
    saltMin?: number, saltMax?: number) => void;
  hasActiveFilters?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isMobileFiltersOpen, toggleMobileFilters, onSearch, categoryId, onApplyMobileFilters, hasActiveFilters = false }) => {
  const { t, ready } = useTranslation(['header', 'common']);
  const [searchQuery, setSearchQuery] = useState('');

  // Return loading state while translations are loading
  if (!ready) {
    return (
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex flex-col items-start">
            <div className="flex items-center">
              <LangLink href="/" className="flex items-center">
                <img src={abcdeLogo} alt="ABCDE.lv" className="h-10" />
              </LangLink>
            </div>
          </div>
          <div className="hidden md:block flex-grow max-w-2xl mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Loading..."
                className="w-full px-4 py-2 pr-16 rounded-md border border-gray-300 opacity-50"
                disabled
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="md:hidden text-gray-500" disabled>
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Normalize search query by trimming whitespace
    const trimmedQuery = searchQuery.trim();
    onSearch(trimmedQuery);
  };

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo and Tagline */}
          <div className="flex flex-col items-start">
            <div className="flex items-center">
              <LangLink href="/" className="flex items-center">
                <img src={abcdeLogo} alt={t('header:logo.alt')} className="h-10" />
              </LangLink>
            </div>
            <p className="text-xs text-gray-600 mt-1 hidden md:block">
              {t('header:tagline')}
            </p>
          </div>

          {/* Search Bar - Desktop */}
          <form 
            onSubmit={handleSearchSubmit}
            className="hidden md:block flex-grow max-w-2xl mx-4"
          >
            <div className="relative">
              <input
                type="text"
                placeholder={t('header:search.placeholder')}
                className="w-full px-4 py-2 pr-16 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchQuery}
                onChange={handleSearchInput}
              />
              {searchQuery && (
                <button 
                  type="button"
                  className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
                  onClick={() => {
                    setSearchQuery('');
                    onSearch(''); // Clear search results
                  }}
                  aria-label={t('header:search.clear')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
                aria-label={t('header:search.button')}
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>

          {/* Desktop Language Switcher and Mobile Actions */}
          <div className="flex items-center gap-3">
            {/* Language Switcher - Desktop */}
            <div className="hidden md:block">
              <LanguageSwitcher />
            </div>
            
            {/* Mobile Actions - Language + Filter */}
            <div className="md:hidden flex items-center gap-2">
              {/* Compact Language Switcher */}
              <LanguageSwitcher compact={true} />
              
              {/* Filter button */}
              <button 
                className="relative text-gray-600 hover:text-primary focus:outline-none transition-colors p-2"
                onClick={toggleMobileFilters}
                aria-label={t('header:filters.toggle')}
                data-testid="mobile-filter-button"
              >
                <SlidersHorizontal className="h-5 w-5" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full"></span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <input
                type="text"
                placeholder={t('header:search.placeholder')}
                className="w-full px-4 py-2 pr-16 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchQuery}
                onChange={handleSearchInput}
                data-testid="mobile-search-input"
              />
              {searchQuery && (
                <button 
                  type="button"
                  className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
                  onClick={() => {
                    setSearchQuery('');
                    onSearch(''); // Clear search results
                  }}
                  aria-label={t('header:search.clear')}
                  data-testid="clear-search-button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
                aria-label={t('header:search.button')}
                data-testid="mobile-search-button"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* 
        Mobile Menu is now handled directly in the Home component 
        to allow direct access to filter state
      */}
      {/* 
      <MobileMenu 
        isOpen={isMobileMenuOpen} 
        categoryId={categoryId} 
        onApplyFilters={onApplyMobileFilters} 
      />
      */}
    </>
  );
};

export default Header;
