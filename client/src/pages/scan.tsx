import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Scanner } from '@/components/scanner/scanner';
import LangLink from '@/components/routing/LangLink';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCanonicalUrl, getHreflangUrls } from '@/lib/canonical';
import { useLazyNamespace } from '@/hooks/useLazyNamespace';

export default function ScanPage() {
  const nsReady = useLazyNamespace('scan');
  const { t, i18n } = useTranslation('scan');
  const currentLang = i18n.language?.split('-')[0] || 'lv';
  const hreflangUrls = getHreflangUrls('/scan');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!nsReady) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;

  const handleCapture = (imageData: string) => {
    // For now, just log the image data
    // In the future, this will send to backend for processing
    console.log('Image captured, size:', imageData.length);
  };

  return (
    <>
      <Helmet>
        <link rel="canonical" href={getCanonicalUrl('/scan', currentLang)} />
        {hreflangUrls.map(({ lang, url }) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={url} />
        ))}
      </Helmet>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <LangLink href="/">
              <Button variant="ghost" size="sm" data-testid="link-back-home">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('backToHome')}
              </Button>
            </LangLink>
          </div>
          <div className="mt-4">
            <h1 className="text-2xl font-bold" data-testid="text-title">{t('title')}</h1>
            <p className="text-muted-foreground mt-1" data-testid="text-description">
              {t('description')}
            </p>
          </div>
        </div>
      </div>

      {/* Scanner */}
      <div className="container mx-auto px-4 py-2">
        <Scanner onCapture={handleCapture} />
      </div>
      </div>
    </>
  );
}
