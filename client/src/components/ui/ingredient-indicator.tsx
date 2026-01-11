import { useTranslation } from 'react-i18next';
import { ProductIngredientCard } from '@/types';
import { Leaf, AlertTriangle, FlaskConical } from 'lucide-react';

interface IngredientIndicatorProps {
  ingredientCard: ProductIngredientCard;
  compact?: boolean;
}

const IngredientIndicator: React.FC<IngredientIndicatorProps> = ({ ingredientCard, compact = false }) => {
  const { t } = useTranslation('ingredients');
  
  const { naturalCount, processedCount, avoidCount, limitCount, cautionCount } = ingredientCard;
  
  const totalIngredients = naturalCount + processedCount;
  const concernCount = avoidCount + limitCount + cautionCount;
  
  if (totalIngredients === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {naturalCount > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            <Leaf className="w-3 h-3" />
            <span>{naturalCount}</span>
          </span>
        )}
        {processedCount > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
            <FlaskConical className="w-3 h-3" />
            <span>{processedCount}</span>
          </span>
        )}
        {avoidCount > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            <span>{avoidCount}</span>
          </span>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {naturalCount > 0 && (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700"
            title={t('natural.tooltip', { count: naturalCount })}
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>{t('natural.label')}: {naturalCount}</span>
          </span>
        )}
        {processedCount > 0 && (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600"
            title={t('processed.tooltip', { count: processedCount })}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{t('processed.label')}: {processedCount}</span>
          </span>
        )}
      </div>
      
      {concernCount > 0 && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {avoidCount > 0 && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700"
              title={t('avoid.tooltip', { count: avoidCount })}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('avoid.label')}: {avoidCount}</span>
            </span>
          )}
          {limitCount > 0 && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700"
              title={t('limit.tooltip', { count: limitCount })}
            >
              <span>{t('limit.label')}: {limitCount}</span>
            </span>
          )}
          {cautionCount > 0 && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700"
              title={t('caution.tooltip', { count: cautionCount })}
            >
              <span>{t('caution.label')}: {cautionCount}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default IngredientIndicator;
