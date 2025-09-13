import React from 'react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';

const Footer: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <footer className="bg-white border-t border-gray-200 py-8">
      <div className="container mx-auto px-4">
        <div className="md:flex md:justify-between md:items-center">
          <div className="mb-6 md:mb-0">
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="inline mr-2">
              <rect x="0" y="0" width="24" height="24" rx="4" ry="4" fill="#1e8e3e" />
              <text x="12" y="16" fontFamily="ui-sans-serif, system-ui, sans-serif" fontSize="16" fontWeight="bold" fill="#FFFFFF" textAnchor="middle" dominantBaseline="middle">A</text>
            </svg>
            <span className="font-bold text-gray-800">ABCDE.lv</span>
          </div>
          <div>
            <a href="https://en.wikipedia.org/wiki/Nutri-Score" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 hover:text-primary">{t('footer.aboutNutriScore')}</a>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-200 pt-8 text-center">
          <p className="text-sm text-gray-500">© {new Date().getFullYear()} ABCDE.lv. {t('footer.allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
