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
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  // Extract current category ID from URL (considering language prefix)
  const [location] = useLocation();
  const pathWithoutLang = getPathWithoutLanguage(location);
  
  // Check if URL is like /category/123 (after removing language prefix)
  const categoryIdMatch = /^\/category\/(\d+)$/.exec(pathWithoutLang);
  const currentCategoryId = categoryIdMatch ? Number(categoryIdMatch[1]) : undefined;

  const handleSearch = (query: string) => {
    // Additional normalization at the app level
    const trimmedQuery = query.trim();
    setSearchQuery(trimmedQuery);
  };
  
  const toggleMobileFilters = () => {
    setIsMobileFiltersOpen(!isMobileFiltersOpen);
  };

  // Check if current page is the scan page or a page that doesn't show filters
  const isScanPage = pathWithoutLang === '/scan';
  const isHomePage = pathWithoutLang === '/' || pathWithoutLang.startsWith('/category/');

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
          <div className="min-h-screen flex flex-col">
            <Header 
              onSearch={handleSearch}
              categoryId={currentCategoryId}
              isMobileFiltersOpen={isMobileFiltersOpen}
              onToggleMobileFilters={isHomePage ? toggleMobileFilters : undefined}
              hasActiveFilters={hasActiveFilters}
            />
            <div className="flex-grow">
              <LanguageRouter 
                searchQuery={searchQuery}
                isMobileFiltersOpen={isMobileFiltersOpen}
                onCloseMobileFilters={() => setIsMobileFiltersOpen(false)}
                onActiveFiltersChange={setHasActiveFilters}
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
