import React, { useState } from 'react';
import { Link } from 'wouter';
import { Search } from 'lucide-react';
import MobileMenu from './mobile-menu';

interface HeaderProps {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  onSearch: (query: string) => void;
}

const Header: React.FC<HeaderProps> = ({ isMobileMenuOpen, toggleMobileMenu, onSearch }) => {
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
            <Link href="/" className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.618 5.984A11.955 11.955 0 0112 2.5c-2.688 0-5.18.885-7.18 2.376m0 0A11.953 11.953 0 012.5 12c0 5.284 3.43 9.772 8.185 11.376.386.126.787.24 1.186.34M7.5 14.25L5.106 5.272M6.5 18h12.53c1.695 0 2.54 0 3.186-.55.646-.55.892-1.385 1.132-3.056.24-1.67.24-1.67-.058-2.044-.298-.375-.3-.375-2.232-.375H14.5" />
              </svg>
              <span className="font-bold text-xl text-gray-800">ABCDE</span>
            </Link>
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
