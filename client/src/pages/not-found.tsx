import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';
import LangLink from '@/components/routing/LangLink';

export default function NotFound() {
  const { t } = useTranslation('errors');
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">{t('404.title')}</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {t('404.message')}
          </p>
          <div className="mt-6">
            <LangLink 
              href="/" 
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              {t('404.backHome')}
            </LangLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
