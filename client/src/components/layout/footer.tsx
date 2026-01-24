import React from 'react';
import { useTranslation } from 'react-i18next';
import LangLink from '@/components/routing/LangLink';

const Footer: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const statsPath = i18n.language === 'en' ? '/what-latvians-eat' : '/ko-ed-latvija';
  
  return (
    <footer className="bg-white border-t border-gray-200 py-6">
      <div className="container mx-auto px-4">
        <div className="flex justify-center gap-6 mb-4 flex-wrap">
          <LangLink href="/about-nutriscore" className="text-gray-700 hover:text-primary font-medium">{t('footer.aboutNutriScore')}</LangLink>
          <LangLink href={statsPath} className="text-gray-700 hover:text-primary font-medium">{t('footer.whatLatviansEat')}</LangLink>
          <LangLink href="/about-project" className="text-gray-700 hover:text-primary font-medium">{t('footer.aboutProject')}</LangLink>
        </div>
        <p className="text-sm text-gray-500 text-center">© {new Date().getFullYear()} ABCDE.lv. {t('footer.allRightsReserved')}</p>
      </div>
    </footer>
  );
};

export default Footer;
