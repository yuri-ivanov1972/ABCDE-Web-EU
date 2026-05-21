import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import LangLink from '@/components/routing/LangLink';
import { ChevronLeft, ExternalLink, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCanonicalUrl, getHreflangUrls } from '@/lib/canonical';
import { useLazyNamespace } from '@/hooks/useLazyNamespace';

export default function AboutProject() {
  const nsReady = useLazyNamespace('aboutProject');
  const { t, i18n } = useTranslation('aboutProject');
  const currentLang = i18n.language?.split('-')[0] || 'lv';
  const hreflangUrls = getHreflangUrls('/about-project');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!nsReady) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;

  return (
    <>
      <Helmet>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
        <link rel="canonical" href={getCanonicalUrl('/about-project', currentLang)} />
        {hreflangUrls.map(({ lang, url }) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={url} />
        ))}
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <LangLink href="/">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('backToHome')}
                </Button>
              </LangLink>
            </div>
            <div className="mt-4">
              <h1 className="text-2xl md:text-3xl font-bold">{t('title')}</h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-3xl space-y-8">
            <section>
              <p className="text-gray-700">{t('intro')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('goal.title')}</h2>
              <p className="text-gray-700">{t('goal.description')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('support.title')}</h2>
              <p className="text-gray-700 mb-3">{t('support.description')}</p>
              <a 
                href="https://manabalss.lv/i/3716"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
              >
                https://manabalss.lv/i/3716
                <ExternalLink className="h-4 w-4" />
              </a>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('technical.title')}</h2>
              <p className="text-gray-700 mb-2">{t('technical.hosting')}</p>
              <p className="text-gray-700">{t('technical.disclaimer')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 mb-3">{t('contact.title')}</h2>
              <p className="text-gray-700 mb-2">{t('contact.description')}</p>
              <a 
                href="mailto:admin@abcde.lv"
                className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium"
              >
                <Mail className="h-4 w-4" />
                admin@abcde.lv
              </a>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
