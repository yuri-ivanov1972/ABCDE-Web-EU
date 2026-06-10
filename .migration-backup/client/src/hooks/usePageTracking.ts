import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from 'react-i18next';
import { trackPageView } from '@/lib/analytics';

export function usePageTracking() {
  const [location] = useLocation();
  const { i18n } = useTranslation();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (location !== lastTrackedPath.current) {
      lastTrackedPath.current = location;
      
      setTimeout(() => {
        trackPageView({
          pagePath: location,
          pageTitle: document.title,
          language: i18n.language,
        });
      }, 100);
    }
  }, [location, i18n.language]);
}
