import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ── Latvian (homepage namespaces — bundled synchronously) ─────────────────────
import lvCommon from '../locales/lv/common.json';
import lvHeader from '../locales/lv/header.json';
import lvHome from '../locales/lv/home.json';
import lvProduct from '../locales/lv/product.json';
import lvFilters from '../locales/lv/filters.json';
import lvCategories from '../locales/lv/categories.json';
import lvPagination from '../locales/lv/pagination.json';
import lvErrors from '../locales/lv/errors.json';

// ── English (homepage namespaces — bundled synchronously) ─────────────────────
import enCommon from '../locales/en/common.json';
import enHeader from '../locales/en/header.json';
import enHome from '../locales/en/home.json';
import enProduct from '../locales/en/product.json';
import enFilters from '../locales/en/filters.json';
import enCategories from '../locales/en/categories.json';
import enPagination from '../locales/en/pagination.json';
import enErrors from '../locales/en/errors.json';

// Supported languages
export const SUPPORTED_LANGUAGES = ['lv', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'lv';

// All namespaces (reference — lazy ones are loaded on demand)
export const NAMESPACES = [
  'common', 'header', 'home', 'product', 'filters', 'categories',
  'pagination', 'errors', 'scan', 'ingredients', 'aboutNutriScore',
  'aboutProject', 'stats',
] as const;

// Namespaces bundled in the initial chunk (needed on the homepage)
const INITIAL_NAMESPACES = [
  'common', 'header', 'home', 'product', 'filters', 'categories',
  'pagination', 'errors',
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
        },
      },

      supportedLngs: SUPPORTED_LANGUAGES,
      fallbackLng: DEFAULT_LANGUAGE,
      debug: import.meta.env.DEV,

      detection: detectionOptions,

      ns: INITIAL_NAMESPACES,
      defaultNS: 'common',

      interpolation: {
        escapeValue: false,
      },

      returnEmptyString: false,
      returnNull: false,

      // useSuspense: false — prevents i18next from throwing a Promise (React Suspense)
      // when init isn't complete yet. With bundled translations, init finishes in <1ms
      // anyway, but the Suspense mechanism still activates the <PageLoader> full-screen
      // spinner in LanguageRouter, which causes CLS.
      // With useSuspense: false, useTranslation() returns ready=false immediately.
      useSuspense: false,
    });
}

// ── Lazy namespace loaders ────────────────────────────────────────────────────
// Page-specific namespaces are NOT in the initial bundle. Each page that needs
// one calls lazyLoadNamespace(ns) on mount — this dynamic import creates a
// separate Vite chunk that is only fetched when that page is first visited.

type LazyNS = 'scan' | 'ingredients' | 'aboutNutriScore' | 'aboutProject' | 'stats';

const lazyLoaders: Record<LazyNS, () => Promise<void>> = {
  scan: async () => {
    const [lv, en] = await Promise.all([
      import('../locales/lv/scan.json'),
      import('../locales/en/scan.json'),
    ]);
    i18n.addResourceBundle('lv', 'scan', lv.default, true, false);
    i18n.addResourceBundle('en', 'scan', en.default, true, false);
  },
  ingredients: async () => {
    const [lv, en] = await Promise.all([
      import('../locales/lv/ingredients.json'),
      import('../locales/en/ingredients.json'),
    ]);
    i18n.addResourceBundle('lv', 'ingredients', lv.default, true, false);
    i18n.addResourceBundle('en', 'ingredients', en.default, true, false);
  },
  aboutNutriScore: async () => {
    const [lv, en] = await Promise.all([
      import('../locales/lv/aboutNutriScore.json'),
      import('../locales/en/aboutNutriScore.json'),
    ]);
    i18n.addResourceBundle('lv', 'aboutNutriScore', lv.default, true, false);
    i18n.addResourceBundle('en', 'aboutNutriScore', en.default, true, false);
  },
  aboutProject: async () => {
    const [lv, en] = await Promise.all([
      import('../locales/lv/aboutProject.json'),
      import('../locales/en/aboutProject.json'),
    ]);
    i18n.addResourceBundle('lv', 'aboutProject', lv.default, true, false);
    i18n.addResourceBundle('en', 'aboutProject', en.default, true, false);
  },
  stats: async () => {
    const [lv, en] = await Promise.all([
      import('../locales/lv/stats.json'),
      import('../locales/en/stats.json'),
    ]);
    i18n.addResourceBundle('lv', 'stats', lv.default, true, false);
    i18n.addResourceBundle('en', 'stats', en.default, true, false);
  },
};

// In-flight promise cache so parallel calls don't double-fetch
const loadingPromises: Partial<Record<string, Promise<void>>> = {};

export async function lazyLoadNamespace(namespace: string): Promise<void> {
  if (i18n.hasResourceBundle('lv', namespace)) return;
  if (loadingPromises[namespace]) return loadingPromises[namespace];
  const loader = lazyLoaders[namespace as LazyNS];
  if (!loader) return;
  loadingPromises[namespace] = loader();
  return loadingPromises[namespace];
}

// ── Path helpers ──────────────────────────────────────────────────────────────

export const getLanguageFromPath = (pathname?: string): SupportedLanguage => {
  if (!pathname) return DEFAULT_LANGUAGE;
  const pathLang = pathname.split('/')[1] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(pathLang) ? pathLang : DEFAULT_LANGUAGE;
};

export const getPathWithoutLanguage = (pathname?: string): string => {
  if (!pathname) return '/';
  const pathLang = pathname.split('/')[1];
  if (SUPPORTED_LANGUAGES.includes(pathLang as SupportedLanguage)) {
    return pathname.replace(`/${pathLang}`, '') || '/';
  }
  return pathname;
};

export const addLanguageToPath = (path: string, language: SupportedLanguage): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/${language}${cleanPath === '/' ? '' : cleanPath}`;
};

export const isRTL = (language: SupportedLanguage): boolean => {
  const rtlLanguages: SupportedLanguage[] = [];
  return rtlLanguages.includes(language);
};

export default i18n;
