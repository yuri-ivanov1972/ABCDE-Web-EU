import { Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LangLink from '@/components/routing/LangLink';

export function FloatingActionButton() {
  const { t } = useTranslation('common');
  
  return (
    <LangLink href="/scan">
      <button
        className="fixed bottom-6 right-6 z-40 md:hidden w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        style={{ backgroundColor: '#038141' }}
        aria-label={t('scanButton.label', 'Scan product')}
        data-testid="fab-scan"
      >
        <Camera className="h-6 w-6 text-white" />
      </button>
    </LangLink>
  );
}
