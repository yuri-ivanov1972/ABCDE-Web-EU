import { Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useState, Suspense } from "react";
import LanguageRouter from "@/components/routing/LanguageRouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { FloatingActionButton } from "@/components/ui/FloatingActionButton";
import { getLanguageFromPath, getPathWithoutLanguage } from "@/i18n";

function App() {
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Extract current category ID from URL (considering language prefix)
  const [location] = useLocation();
  const pathWithoutLang = getPathWithoutLanguage(location);
  
  // Check if URL is like /category/123 (after removing language prefix)
  const categoryIdMatch = /^\/category\/(\d+)$/.exec(pathWithoutLang);
  const currentCategoryId = categoryIdMatch ? Number(categoryIdMatch[1]) : undefined;

  // Clear search query only when clicking logo or "All categories" link
  // This effect has been removed to allow search functionality on the home page

  const toggleMobileFilters = () => {
    setIsMobileFiltersOpen(!isMobileFiltersOpen);
  };

  const handleSearch = (query: string) => {
    // Additional normalization at the app level
    const trimmedQuery = query.trim();
    setSearchQuery(trimmedQuery);
  };

  const handleFiltersChange = (hasFilters: boolean) => {
    setHasActiveFilters(hasFilters);
  };

  // Check if current page is the scan page
  const isScanPage = pathWithoutLang === '/scan';

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
          <div className="min-h-screen flex flex-col">
            <Header 
              isMobileFiltersOpen={isMobileFiltersOpen} 
              toggleMobileFilters={toggleMobileFilters}
              onSearch={handleSearch}
              categoryId={currentCategoryId}
              hasActiveFilters={hasActiveFilters}
            />
            <div className="flex-grow">
              <LanguageRouter 
                searchQuery={searchQuery} 
                isMobileFiltersOpen={isMobileFiltersOpen}
                toggleMobileFilters={toggleMobileFilters}
                onFiltersChange={handleFiltersChange}
              />
            </div>
            <Footer />
          </div>
        </Suspense>
        <Toaster />
        {/* Show FAB on all pages except scan page (mobile only) */}
        {!isScanPage && <FloatingActionButton />}
      </Router>
    </QueryClientProvider>
  );
}

export default App;
