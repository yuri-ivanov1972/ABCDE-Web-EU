import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

// Supported languages
export const SUPPORTED_LANGUAGES = ['lv', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Default language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'lv';

// Namespaces
export const NAMESPACES = [
  'common',
  'header', 
  'home',
  'product',
  'filters',
  'categories',
  'pagination',
  'errors'
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
    .use(resourcesToBackend((language: string, namespace: string) => {
      return import(`../locales/${language}/${namespace}.json`);
    }))
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
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
        escapeValue: false, // React already escapes values
      },
      
      // Return empty string for missing keys in development
      returnEmptyString: false,
      returnNull: false,
      
      // React configuration
      react: {
        useSuspense: false, // We'll handle loading states manually
      }
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
  const rtlLanguages: SupportedLanguage[] = []; // Add RTL languages here in future
  return rtlLanguages.includes(language);
};

export default i18n;