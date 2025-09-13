import { useEffect } from 'react';
import { Route, Switch, Redirect, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getLanguageFromPath, getPathWithoutLanguage, type SupportedLanguage } from '@/i18n';

import Home from '@/pages/home';
import ProductDetails from '@/pages/product-details';
import ProductSearch from '@/pages/product-search';
import NotFound from '@/pages/not-found';
import Debug from '@/pages/debug';

interface LanguageRouterProps {
  searchQuery?: string;
}

const LanguageRouter: React.FC<LanguageRouterProps> = ({ searchQuery = '' }) => {
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
          return <Home categoryId={Number(params?.id)} initialSearchQuery={searchQuery} {...params} />;
        }}
      </Route>
      
      {/* Product routes with language prefix */}
      <Route path="/:lang/product/:id">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}/product/${params?.id}`} replace />;
          }
          return <ProductDetails {...params} />;
        }}
      </Route>
      
      {/* Product search route with language prefix (handles both /search and /product-search) */}
      <LanguageAwareRoute path="/search" component={ProductSearch} />
      <LanguageAwareRoute path="/product-search" component={ProductSearch} />
      
      {/* Debug route with language prefix */}
      <LanguageAwareRoute path="/debug" component={Debug} />
      
      {/* Home route with language prefix */}
      <Route path="/:lang">
        {(params) => {
          const language = params?.lang as SupportedLanguage;
          if (!SUPPORTED_LANGUAGES.includes(language)) {
            return <Redirect to={`/${DEFAULT_LANGUAGE}`} replace />;
          }
          return <Home initialSearchQuery={searchQuery} {...params} />;
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
      
      <Route path="/debug">
        <Redirect to={`/${DEFAULT_LANGUAGE}/debug`} replace />
      </Route>
      
      {/* Legacy routes catch-all for specific patterns only */}
      <Route path="/(category|product|search|product-search|debug)/:rest*">
        {(params) => {
          const pathWithoutLang = getPathWithoutLanguage(location);
          const targetPath = pathWithoutLang === '/' ? '' : pathWithoutLang;
          return <Redirect to={`/${DEFAULT_LANGUAGE}${targetPath}`} replace />;
        }}
      </Route>
      
      {/* 404 Not Found */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
};

export default LanguageRouter;