import { useEffect, lazy, Suspense } from 'react';
import { Route, Switch, Redirect, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguageFromPath, getPathWithoutLanguage, type SupportedLanguage } from '@/i18n';

// Home is the landing page — import directly so it's in the main bundle.
// This eliminates the Suspense spinner → content swap (the primary CLS source)
// that lazy loading causes on cold first visits.
import Home from '@/pages/home';
const ProductDetails = lazy(() => import('@/pages/product-details'));
const ProductSearch = lazy(() => import('@/pages/product-search'));
const ScanPage = lazy(() => import('@/pages/scan'));
const AboutNutriScore = lazy(() => import('@/pages/about-nutriscore'));
const AboutProject = lazy(() => import('@/pages/about-project'));
const WhatLatviansEat = lazy(() => import('@/pages/what-latvians-eat'));
const IceCreamReport = lazy(() => import('@/pages/ice-cream-report'));
const NotFound = lazy(() => import('@/pages/not-found'));
const Debug = lazy(() => import('@/pages/debug'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Ielādē...</p>
    </div>
  </div>
);

interface LanguageRouterProps {
  searchQuery?: string;
  isMobileFiltersOpen?: boolean;
  onCloseMobileFilters?: () => void;
  onActiveFiltersChange?: (hasActive: boolean) => void;
}

const LanguageRouter: React.FC<LanguageRouterProps> = ({ searchQuery = '', isMobileFiltersOpen = false, onCloseMobileFilters, onActiveFiltersChange }) => {
  const [location, setLocation] = useLocation();
  const { i18n } = useTranslation();

  // Get current language from URL
  const currentLanguage = getLanguageFromPath(location);
  
  useEffect(() => {
    // Update i18n language when URL changes
    if (currentLanguage && i18n.language !== currentLanguage) {
      i18n.changeLanguage(currentLanguage);
    }
  }, [currentLanguage, i18n]);

  // Component to handle language-specific routes with additional props
  const LanguageAwareRoute: React.FC<{
    path: string;
    component: React.ComponentType<any>;
    additionalProps?: any;
  }> = ({ path, component: Component, additionalProps = {} }) => {
    return (
      <Route path={`/:lang${path === '/' ? '' : path}`}>
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          
          // Redirect to default language if unsupported language
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}${path === '/' ? '' : path}`} replace />;
          }
          
          return <Component {...params} {...additionalProps} />;
        }}
      </Route>
    );
  };

  return (
    <Switch>
      {/* Root redirect to default language */}
      <Route path="/">
        <Redirect to={`/${DEFAULT_LANGUAGE}`} replace />
      </Route>
      
      {/* Category routes with language prefix */}
      <Route path="/:lang/category/:id">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/category/${params?.id}`} replace />;
          }
          const slug = params?.id || '';
          const parsedCategoryId = /^\d+$/.test(slug) ? Number(slug) : (() => {
            const m = slug.match(/-(\d+)$/);
            return m ? Number(m[1]) : undefined;
          })();
          return (
            <Suspense fallback={<PageLoader />}>
              <Home categoryId={parsedCategoryId} initialSearchQuery={searchQuery} isMobileFiltersOpen={isMobileFiltersOpen} onCloseMobileFilters={onCloseMobileFilters} onActiveFiltersChange={onActiveFiltersChange} {...params} />
            </Suspense>
          );
        }}
      </Route>
      
      {/* Product routes with language prefix */}
      <Route path="/:lang/product/:id">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/product/${params?.id}`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <ProductDetails {...params} />
            </Suspense>
          );
        }}
      </Route>
      
      {/* Product search route with language prefix (handles both /search and /product-search) */}
      <Route path="/:lang/search">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/search`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <ProductSearch />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/:lang/product-search">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/product-search`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <ProductSearch />
            </Suspense>
          );
        }}
      </Route>
      
      {/* Scan route with language prefix */}
      <Route path="/:lang/scan">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/scan`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <ScanPage />
            </Suspense>
          );
        }}
      </Route>
      
      {/* About Nutri-Score route with language prefix */}
      <Route path="/:lang/about-nutriscore">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/about-nutriscore`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <AboutNutriScore />
            </Suspense>
          );
        }}
      </Route>
      
      {/* About Project route with language prefix */}
      <Route path="/:lang/about-project">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/about-project`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <AboutProject />
            </Suspense>
          );
        }}
      </Route>
      
      {/* What Latvians Eat stats page - LV path */}
      <Route path="/:lang/ko-ed-latvija">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/ko-ed-latvija`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <WhatLatviansEat />
            </Suspense>
          );
        }}
      </Route>
      
      {/* What Latvians Eat stats page - EN path */}
      <Route path="/:lang/what-latvians-eat">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/what-latvians-eat`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <WhatLatviansEat />
            </Suspense>
          );
        }}
      </Route>

      {/* Ice cream analysis article - LV path */}
      <Route path="/:lang/raksti/saldejums">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language) || language !== 'lv') {
            return <Redirect to="/lv/raksti/saldejums" replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <IceCreamReport />
            </Suspense>
          );
        }}
      </Route>

      {/* Ice cream analysis article - EN path */}
      <Route path="/:lang/articles/ice-cream">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language) || language !== 'en') {
            return <Redirect to="/en/articles/ice-cream" replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <IceCreamReport />
            </Suspense>
          );
        }}
      </Route>
      
      {/* Debug route with language prefix */}
      <Route path="/:lang/debug">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/debug`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <Debug />
            </Suspense>
          );
        }}
      </Route>
      
      {/* Home route with language prefix */}
      <Route path="/:lang">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}`} replace />;
          }
          return (
            <Suspense fallback={<PageLoader />}>
              <Home initialSearchQuery={searchQuery} isMobileFiltersOpen={isMobileFiltersOpen} onCloseMobileFilters={onCloseMobileFilters} onActiveFiltersChange={onActiveFiltersChange} {...params} />
            </Suspense>
          );
        }}
      </Route>
      
      {/* Handle specific legacy routes without language prefix */}
      <Route path="/category/:id">
        {(params) => <Redirect to={`/${DEFAULT_LANGUAGE}/category/${params?.id}`} replace />}
      </Route>
      
      <Route path="/product/:id">
        {(params) => <Redirect to={`/${DEFAULT_LANGUAGE}/product/${params?.id}`} replace />}
      </Route>
      
      <Route path="/search">
        <Redirect to={`/${DEFAULT_LANGUAGE}/search`} replace />
      </Route>
      
      <Route path="/product-search">
        <Redirect to={`/${DEFAULT_LANGUAGE}/search`} replace />
      </Route>
      
      <Route path="/scan">
        <Redirect to={`/${DEFAULT_LANGUAGE}/scan`} replace />
      </Route>
      
      <Route path="/about-nutriscore">
        <Redirect to={`/${DEFAULT_LANGUAGE}/about-nutriscore`} replace />
      </Route>
      
      <Route path="/about-project">
        <Redirect to={`/${DEFAULT_LANGUAGE}/about-project`} replace />
      </Route>
      
      <Route path="/ko-ed-latvija">
        <Redirect to={`/${DEFAULT_LANGUAGE}/ko-ed-latvija`} replace />
      </Route>
      
      <Route path="/what-latvians-eat">
        <Redirect to={`/${DEFAULT_LANGUAGE}/what-latvians-eat`} replace />
      </Route>
      
      <Route path="/debug">
        <Redirect to={`/${DEFAULT_LANGUAGE}/debug`} replace />
      </Route>
      
      {/* Legacy routes catch-all for specific patterns only */}
      <Route path="/(category|product|search|product-search|scan|debug)/:rest*">
        {(params) => {
          const pathWithoutLang = getPathWithoutLanguage(location);
          const targetPath = pathWithoutLang === '/' ? '' : pathWithoutLang;
          return <Redirect to={`/${DEFAULT_LANGUAGE}${targetPath}`} replace />;
        }}
      </Route>
      
      {/* 404 Not Found */}
      <Route>
        <Suspense fallback={<PageLoader />}>
          <NotFound />
        </Suspense>
      </Route>
    </Switch>
  );
};

export default LanguageRouter;
