import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { addLanguageToPath, getLanguageFromPath, getPathWithoutLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

interface LangLinkProps {
  href: string;
  language?: SupportedLanguage;
  preserveLanguage?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
  replace?: boolean;
  state?: unknown;
}

/**
 * Language-aware Link component that automatically prefixes URLs with the current language
 * or a specified language.
 */
const LangLink: React.FC<LangLinkProps> = ({ 
  href, 
  language, 
  preserveLanguage = true,
  children, 
  ...props 
}) => {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  
  // Safeguard current path and target path
  const currentPath = typeof location === 'string' && location ? location : (typeof window !== 'undefined' ? window.location.pathname : '/');
  const rawHref = href || '/';
  
  // Determine which language to use
  const targetLanguage = language || (preserveLanguage ? getLanguageFromPath(currentPath) : i18n.language as SupportedLanguage);
  
  // Check if the path already has a language prefix
  const pathLang = getLanguageFromPath(rawHref);
  const cleanPath = SUPPORTED_LANGUAGES.includes(pathLang) ? getPathWithoutLanguage(rawHref) : rawHref;
  
  // Create the language-prefixed URL
  const languageAwareHref = addLanguageToPath(cleanPath, targetLanguage);
  
  return (
    <Link href={languageAwareHref} {...props}>
      {children}
    </Link>
  );
};

export default LangLink;