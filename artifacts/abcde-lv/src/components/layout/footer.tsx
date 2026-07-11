import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import LangLink from '@/components/routing/LangLink';
import { getCategories } from '@/api';
import { Category } from '@/types';

const Footer: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const isEn = i18n.language?.startsWith('en');
  const statsPath = isEn ? '/what-latvians-eat' : '/ko-ed-latvija';
  const iceCreamPath = isEn ? '/articles/ice-cream' : '/raksti/saldejums';
  const iceCreamLabel = isEn ? 'Healthiest Ice Cream?' : 'Veselīgākais saldējums?';

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['/api/categories', { level: 1 }],
    queryFn: () => getCategories(1),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <footer className="bg-white border-t border-gray-200 pt-8 pb-6">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Categories column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              {t('categories:title')}
            </h3>
            <ul className="space-y-2">
              {categories.map((category) => (
                <li key={category.categoryId}>
                  <LangLink
                    href={`/category/${category.slug || category.categoryId}`}
                    className="text-sm text-gray-600 hover:text-primary transition-colors"
                  >
                    {isEn ? (category.nameEn || category.nameLv) : category.nameLv}
                  </LangLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Pages column */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              {t('footer.pagesHeading')}
            </h3>
            <ul className="space-y-2">
              <li>
                <LangLink href="/about-nutriscore" className="text-sm text-gray-600 hover:text-primary transition-colors">
                  {t('footer.aboutNutriScore')}
                </LangLink>
              </li>
              <li>
                <LangLink href={statsPath} className="text-sm text-gray-600 hover:text-primary transition-colors">
                  {t('footer.whatLatviansEat')}
                </LangLink>
              </li>
              <li>
                <LangLink href="/about-project" className="text-sm text-gray-600 hover:text-primary transition-colors">
                  {t('footer.aboutProject')}
                </LangLink>
              </li>
              <li>
                <LangLink href={iceCreamPath} className="text-sm text-gray-600 hover:text-primary transition-colors">
                  {iceCreamLabel}
                </LangLink>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500 text-center">
            © {new Date().getFullYear()} <a href="https://company.lursoft.lv/lv/abcde-open-food-data-lab/40008356414" target="_blank" rel="noopener noreferrer" className="hover:underline">{t('footer.orgName')}</a>. {t('footer.allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
