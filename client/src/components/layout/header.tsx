import React, { useState } from 'react';
import { Search, X, ExternalLink, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangLink from '@/components/routing/LangLink';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import nutriScoreLogo from '@assets/RVB_neutre_1768766381066.png';
import { trackPetitionClick } from '@/lib/analytics';

interface HeaderProps {
  onSearch: (query: string) => void;
  categoryId?: number;
  isMobileFiltersOpen?: boolean;
  onToggleMobileFilters?: () => void;
  hasActiveFilters?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onSearch, categoryId, isMobileFiltersOpen, onToggleMobileFilters, hasActiveFilters }) => {
  const { t, ready, i18n } = useTranslation(['header', 'common']);
  const [searchQuery, setSearchQuery] = useState('');

  // Return loading state while translations are loading
  if (!ready) {
    return (
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <LangLink href="/" className="flex items-center">
              <img src={nutriScoreLogo} alt="ABCDE.lv" className="h-[5.2rem] md:h-[6.5rem]" />
            </LangLink>
          </div>
          <div className="hidden md:block flex-grow max-w-2xl">
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
            <LanguageSwitcher compact={true} />
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
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center shrink-0">
            <LangLink href="/" className="flex items-center">
              <img src={nutriScoreLogo} alt={t('header:logo.alt')} className="h-[5.2rem] md:h-[6.5rem]" />
            </LangLink>
          </div>

          {/* Search Bar - Desktop */}
          <form 
            onSubmit={handleSearchSubmit}
            className="hidden md:block flex-grow max-w-2xl"
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

          {/* Right side: Petition Link and Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Petition Link */}
            <a 
              href={t('header:petition.url')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs md:text-sm text-primary hover:text-primary/80 transition-colors text-right leading-tight"
              data-testid="petition-link"
              onClick={() => {
                trackPetitionClick({
                  linkUrl: t('header:petition.url'),
                  linkText: t('header:petition.text').replace(/<br\/>/g, ' '),
                  language: i18n.language || 'unknown',
                });
              }}
            >
              <span dangerouslySetInnerHTML={{ __html: t('header:petition.text') }} />
              <ExternalLink className="h-3 w-3 hidden md:inline ml-1" style={{ display: 'inline' }} />
            </a>

            {/* Language Switcher + Mobile Filter Toggle */}
            <div className="flex items-center gap-2">
              {/* Language Switcher - Desktop */}
              <div className="hidden md:block">
                <LanguageSwitcher />
              </div>
              
              {/* Language Switcher - Mobile */}
              <div className="md:hidden">
                <LanguageSwitcher compact={true} />
              </div>
              
              {/* Mobile Filter Toggle - Icon only */}
              {onToggleMobileFilters && (
                <button
                  onClick={onToggleMobileFilters}
                  className="md:hidden relative h-9 w-9 flex items-center justify-center text-gray-600 hover:text-primary transition-colors border border-gray-300 rounded-md"
                  aria-label={t('header:filters.toggle')}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full"></span>
                  )}
                </button>
              )}
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

      {/* Mobile Menu is now rendered in the Home component and triggered via header button */}
    </>
  );
};

export default Header;
