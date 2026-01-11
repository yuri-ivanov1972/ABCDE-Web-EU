import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProductIngredientCard, IngredientItem } from '@/types';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface IngredientIndicatorProps {
  ingredientCard: ProductIngredientCard;
  compact?: boolean;
}

const IngredientIndicator: React.FC<IngredientIndicatorProps> = ({ ingredientCard, compact = false }) => {
  const { t } = useTranslation('ingredients');
  const [expanded, setExpanded] = useState(false);
  
  const { avoidCount, limitCount, cautionCount, ingredients } = ingredientCard;
  
  const concernCount = avoidCount + limitCount + cautionCount;
  
  if (concernCount === 0) {
    return null;
  }

  const concernIngredients = ingredients.filter(
    ing => ing.suspicion_level === 'avoid' || ing.suspicion_level === 'limit' || ing.suspicion_level === 'caution'
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {avoidCount > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            <span>{avoidCount}</span>
          </span>
        )}
        {limitCount > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
            <span>{limitCount}</span>
          </span>
        )}
        {cautionCount > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
            <span>{cautionCount}</span>
          </span>
        )}
      </div>
    );
  }
  
  const getSuspicionStyle = (level: string | null) => {
    switch (level) {
      case 'avoid':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'limit':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'caution':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-2">
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
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>{t('hideDetails')}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>{t('showDetails')}</span>
            </>
          )}
        </button>
      </div>
      
      {expanded && concernIngredients.length > 0 && (
        <div className="space-y-1.5 pl-1">
          {concernIngredients.map((ing) => (
            <div 
              key={ing.id} 
              className={`text-xs p-2 rounded border ${getSuspicionStyle(ing.suspicion_level)}`}
            >
              <div className="font-medium capitalize">{ing.name}</div>
              {ing.health_note && (
                <div className="mt-0.5 opacity-80">{ing.health_note}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IngredientIndicator;
