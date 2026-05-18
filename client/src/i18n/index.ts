import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ── Latvian ──────────────────────────────────────────────────────────────────
import lvCommon from '../locales/lv/common.json';
import lvHeader from '../locales/lv/header.json';
import lvHome from '../locales/lv/home.json';
import lvProduct from '../locales/lv/product.json';
import lvFilters from '../locales/lv/filters.json';
import lvCategories from '../locales/lv/categories.json';
import lvPagination from '../locales/lv/pagination.json';
import lvErrors from '../locales/lv/errors.json';
import lvScan from '../locales/lv/scan.json';
import lvIngredients from '../locales/lv/ingredients.json';
import lvAboutNutriScore from '../locales/lv/aboutNutriScore.json';
import lvAboutProject from '../locales/lv/aboutProject.json';
import lvStats from '../locales/lv/stats.json';

// ── English ──────────────────────────────────────────────────────────────────
import enCommon from '../locales/en/common.json';
import enHeader from '../locales/en/header.json';
import enHome from '../locales/en/home.json';
import enProduct from '../locales/en/product.json';
import enFilters from '../locales/en/filters.json';
import enCategories from '../locales/en/categories.json';
import enPagination from '../locales/en/pagination.json';
import enErrors from '../locales/en/errors.json';
import enScan from '../locales/en/scan.json';
import enIngredients from '../locales/en/ingredients.json';
import enAboutNutriScore from '../locales/en/aboutNutriScore.json';
import enAboutProject from '../locales/en/aboutProject.json';
import enStats from '../locales/en/stats.json';

// Supported languages
export const SUPPORTED_LANGUAGES = ['lv', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'lv';

// All namespaces (kept for reference)
export const NAMESPACES = [
  'common', 'header', 'home', 'product', 'filters', 'categories',
  'pagination', 'errors', 'scan', 'ingredients', 'aboutNutriScore',
  'aboutProject', 'stats',
] as const;

// Language detection configuration
const detectionOptions = {
  order: ['path', 'querystring', 'localStorage', 'navigator'],
  lookupFromPathIndex: 0,
  lookupQuerystring: 'lng',
  lookupLocalStorage: 'i18nextLng',
  caches: ['localStorage'],
  excludeCacheFor: ['cimode'],
};

// Initialize i18next (guard against double initialization)
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      // All translations bundled inline — zero extra network requests
      resources: {
        lv: {
          common: lvCommon,
          header: lvHeader,
          home: lvHome,
          product: lvProduct,
          filters: lvFilters,
          categories: lvCategories,
          pagination: lvPagination,
          errors: lvErrors,
          scan: lvScan,
          ingredients: lvIngredients,
          aboutNutriScore: lvAboutNutriScore,
          aboutProject: lvAboutProject,
          stats: lvStats,
        },
        en: {
          common: enCommon,
          header: enHeader,
          home: enHome,
          product: enProduct,
          filters: enFilters,
          categories: enCategories,
          pagination: enPagination,
          errors: enErrors,
          scan: enScan,
          ingredients: enIngredients,
          aboutNutriScore: enAboutNutriScore,
          aboutProject: enAboutProject,
          stats: enStats,
        },
      },

      supportedLngs: SUPPORTED_LANGUAGES,
      fallbackLng: DEFAULT_LANGUAGE,
      debug: import.meta.env.DEV,

      // Language detection
      detection: detectionOptions,

      // Namespace configuration
      ns: NAMESPACES,
      defaultNS: 'common',

      // Interpolation
      interpolation: {
        escapeValue: false,
      },

      returnEmptyString: false,
      returnNull: false,

      // useSuspense: true is the default — React suspends once, renders once,
      // no re-renders, no CLS, no TBT spike.
    });
}

// Helper function to get current language from URL
export const getLanguageFromPath = (pathname?: string): SupportedLanguage => {
  if (!pathname) return DEFAULT_LANGUAGE;

  const pathLang = pathname.split('/')[1] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(pathLang) ? pathLang : DEFAULT_LANGUAGE;
};

// Helper function to get path without language prefix
export const getPathWithoutLanguage = (pathname?: string): string => {
  if (!pathname) return '/';

  const pathLang = pathname.split('/')[1];
  if (SUPPORTED_LANGUAGES.includes(pathLang as SupportedLanguage)) {
    return pathname.replace(`/${pathLang}`, '') || '/';
  }
  return pathname;
};

// Helper function to add language prefix to path
export const addLanguageToPath = (path: string, language: SupportedLanguage): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${language}${cleanPath === '/' ? '' : cleanPath}`;
};

// Helper function to check if language is RTL (for future use)
export const isRTL = (language: SupportedLanguage): boolean => {
  const rtlLanguages: SupportedLanguage[] = [];
  return rtlLanguages.includes(language);
};

export default i18n;
