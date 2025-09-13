import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Globe } from 'lucide-react';
import { getLanguageFromPath, getPathWithoutLanguage, addLanguageToPath, type SupportedLanguage, SUPPORTED_LANGUAGES } from '@/i18n';

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '', showLabel = false, compact = false }) => {
  const { t, i18n } = useTranslation(['header']);
  const [location, navigate] = useLocation();
  
  const currentLanguage = getLanguageFromPath(location) as SupportedLanguage;
  const targetLanguage: SupportedLanguage = currentLanguage === 'lv' ? 'en' : 'lv';
  
  const handleLanguageSwitch = () => {
    // Get current path without language prefix
    const pathWithoutLang = getPathWithoutLanguage(location);
    
    // Create new path with target language
    const newPath = addLanguageToPath(pathWithoutLang, targetLanguage);
    
    // Change i18next language
    i18n.changeLanguage(targetLanguage);
    
    // Navigate to new path
    navigate(newPath, { replace: true });
  };

  return (
    <button
      onClick={handleLanguageSwitch}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-md transition-colors ${className}`}
      aria-label={t('header:language.switch')}
      data-testid="language-switcher"
    >
      {!compact && <Globe className="h-4 w-4" />}
      {showLabel && !compact && (
        <span className="hidden sm:inline">
          {t('header:language.switch')}
        </span>
      )}
      <span className={compact ? "text-xs font-bold" : "font-semibold"}>
        {compact 
          ? (targetLanguage === 'en' ? 'EN' : 'LV')
          : (targetLanguage === 'en' ? t('header:language.english') : t('header:language.latvian'))
        }
      </span>
    </button>
  );
};

export default LanguageSwitcher;