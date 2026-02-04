const BASE_URL = 'https://abcde.lv';
const DEFAULT_LANG = 'lv';
const SUPPORTED_LANGUAGES = ['lv', 'en'];

export function generateSeoTags(urlPath: string): string {
  const pathParts = urlPath.split('?')[0].split('/').filter(Boolean);
  const urlLang = SUPPORTED_LANGUAGES.includes(pathParts[0]) ? pathParts[0] : DEFAULT_LANG;
  
  let cleanPath = '';
  if (SUPPORTED_LANGUAGES.includes(pathParts[0])) {
    cleanPath = '/' + pathParts.slice(1).join('/');
  } else {
    cleanPath = '/' + pathParts.join('/');
  }
  
  if (cleanPath !== '/' && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  if (cleanPath === '') cleanPath = '/';
  
  const canonicalUrl = cleanPath === '/'
    ? `${BASE_URL}/${urlLang}`
    : `${BASE_URL}/${urlLang}${cleanPath}`;
  
  const hreflangTags = SUPPORTED_LANGUAGES.map(lang => {
    const url = cleanPath === '/'
      ? `${BASE_URL}/${lang}`
      : `${BASE_URL}/${lang}${cleanPath}`;
    return `<link rel="alternate" hreflang="${lang}" href="${url}" />`;
  });
  
  const xDefaultUrl = cleanPath === '/'
    ? `${BASE_URL}/${DEFAULT_LANG}`
    : `${BASE_URL}/${DEFAULT_LANG}${cleanPath}`;
  hreflangTags.push(`<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`);
  
  return `<link rel="canonical" href="${canonicalUrl}" />\n    ${hreflangTags.join('\n    ')}`;
}

export function injectSeoTags(html: string, urlPath: string): string {
  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    return html;
  }
  
  const seoTags = generateSeoTags(urlPath);
  
  if (html.includes('</title>')) {
    return html.replace('</title>', `</title>\n    ${seoTags}`);
  }
  return html.replace('</head>', `${seoTags}\n  </head>`);
}
