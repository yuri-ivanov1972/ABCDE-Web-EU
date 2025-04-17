import React, { useState } from 'react';
import { Link } from 'wouter';
import { Search } from 'lucide-react';
import MobileMenu from './mobile-menu';
import abcdeLogo from '@assets/abcde_logo.svg';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  onSearch: (query: string) => void;
  categoryId?: number;
}

const Header: React.FC<HeaderProps> = ({ isMobileMenuOpen, toggleMobileMenu, onSearch, categoryId }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src={abcdeLogo} alt="ABCDE Logo" className="h-10" />
            </Link>
            <nav className="ml-6 hidden md:flex space-x-4">
              <Link href="/product-search" className="text-gray-600 hover:text-primary">
                Meklēt pēc URL
              </Link>
            </nav>
          </div>

          {/* Search Bar - Desktop */}
          <form 
            onSubmit={handleSearchSubmit}
            className="hidden md:block flex-grow max-w-2xl mx-4"
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Meklēt produktus..."
                className="w-full px-4 py-2 pr-10 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchQuery}
                onChange={handleSearchInput}
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>

          {/* Mobile menu button */}
          <button 
            className="md:hidden text-gray-500 focus:outline-none"
            onClick={toggleMobileMenu}
            aria-label="Izvēlne"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Search Bar - Mobile */}
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative">
              <input
                type="text"
                placeholder="Meklēt produktus..."
                className="w-full px-4 py-2 pr-10 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={searchQuery}
                onChange={handleSearchInput}
              />
              <button 
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} />
    </>
  );
};

export default Header;
