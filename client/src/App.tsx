import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useState } from "react";
import Home from "@/pages/home";
import ProductDetails from "@/pages/product-details";
import ProductSearch from "@/pages/product-search";
import NotFound from "@/pages/not-found";
import DebugPage from "@/pages/debug";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

function Router({ searchQuery }: { searchQuery: string }) {
  return (
    <Switch>
      <Route path="/">
        {() => <Home initialSearchQuery={searchQuery} />}
      </Route>
      <Route path="/category/:id">
        {(params) => <Home categoryId={Number(params.id)} initialSearchQuery={searchQuery} />}
      </Route>
      <Route path="/product/:id" component={ProductDetails} />
      <Route path="/product-search" component={ProductSearch} />
      <Route path="/debug" component={DebugPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract current category ID from URL
  const [location] = useLocation();
  // Check if URL is like /category/123
  const categoryIdMatch = /^\/category\/(\d+)$/.exec(location);
  const currentCategoryId = categoryIdMatch ? Number(categoryIdMatch[1]) : undefined;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleSearch = (query: string) => {
    // Additional normalization at the app level
    const trimmedQuery = query.trim();
    setSearchQuery(trimmedQuery);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header 
          isMobileMenuOpen={isMobileMenuOpen} 
          toggleMobileMenu={toggleMobileMenu}
          onSearch={handleSearch}
          categoryId={currentCategoryId}
        />
        <div className="flex-grow">
          <Router searchQuery={searchQuery} />
        </div>
        <Footer />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
