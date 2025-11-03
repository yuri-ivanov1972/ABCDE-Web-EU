export const getCanonicalUrl = (path: string): string => {
  const baseUrl = 'https://abcde.lv';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
};
