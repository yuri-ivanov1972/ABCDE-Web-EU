import { Link, useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { addLanguageToPath, getLanguageFromPath, getPathWithoutLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

interface LangLinkProps {
  to: string;
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
  to, 
  language, 
  preserveLanguage = true,
  children, 
  ...props 
}) => {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  
  // Determine which language to use
  const targetLanguage = language || (preserveLanguage ? getLanguageFromPath(location) : i18n.language as SupportedLanguage);
  
  // Check if the path already has a language prefix
  const pathLang = getLanguageFromPath(to);
  const cleanPath = SUPPORTED_LANGUAGES.includes(pathLang) ? getPathWithoutLanguage(to) : to;
  
  // Create the language-prefixed URL
  const languageAwareTo = addLanguageToPath(cleanPath, targetLanguage);
  
  return (
    <Link to={languageAwareTo} {...props}>
      {children}
    </Link>
  );
};

export default LangLink;