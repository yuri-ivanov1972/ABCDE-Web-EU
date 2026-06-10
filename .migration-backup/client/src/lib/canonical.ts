const BASE_URL = 'https://abcde.lv';
const DEFAULT_LANG = 'lv';
const SUPPORTED_LANGUAGES = ['lv', 'en'];

export const getCanonicalUrl = (path: string, _lang: string = DEFAULT_LANG): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (cleanPath === '/') {
    return `${BASE_URL}/${DEFAULT_LANG}`;
  }

  return `${BASE_URL}/${DEFAULT_LANG}${cleanPath}`;
};

export const getHreflangUrls = (path: string): { lang: string; url: string }[] => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  const urls = SUPPORTED_LANGUAGES.map(lang => ({
    lang,
    url: cleanPath === '/' ? `${BASE_URL}/${lang}` : `${BASE_URL}/${lang}${cleanPath}`
  }));
  
  urls.push({
    lang: 'x-default',
    url: cleanPath === '/' ? `${BASE_URL}/${DEFAULT_LANG}` : `${BASE_URL}/${DEFAULT_LANG}${cleanPath}`
  });
  
  return urls;
};

export const BASE_DOMAIN = BASE_URL;
