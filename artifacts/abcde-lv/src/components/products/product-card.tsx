import { useTranslation } from 'react-i18next';
import LangLink from '@/components/routing/LangLink';
import { ProductWithDetails } from '@/types';
import NutrientBar from '@/components/ui/nutrient-bar';
import IngredientIndicator from '@/components/ui/ingredient-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { getPhotoSrc, getPhotoSrcSet } from '@/lib/photoUrl';
import smallA from '@assets/RVB_A_1768766381068.png';
import smallB from '@assets/RVB_B_1768766381068.png';
import smallC from '@assets/RVB_C_1768766381068.png';
import smallD from '@assets/RVB_D_1768766381067.png';
import smallE from '@assets/RVB_E_1768766381067.png';

interface ProductCardProps {
  product: ProductWithDetails;
  priority?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, priority = false }) => {
  const { t } = useTranslation('common');
  const { productId, name, quantityValue, quantityUnit, nutrition, photos } = product;
  
  const mainPhoto = photos?.find(p => p.isPrimary) || photos?.[0];

  const rawPhotoUrl = mainPhoto?.photoUrl;
  const isBarbora = rawPhotoUrl?.includes('barbora.lv');
  // Priority (above-fold / LCP) Barbora images go through the proxy — pre-warmed at startup,
  // so it's a memory cache hit and eliminates CDN geographic latency for the LCP element.
  // Non-priority Barbora images still load directly from CDN to avoid cold-proxy latency
  // on images that weren't warmed.
  const cardSrc = (!priority && isBarbora)
    ? rawPhotoUrl!
    : getPhotoSrc(rawPhotoUrl, 300, t('noImage'));
  const cardSrcSet = (!priority && isBarbora) ? undefined : getPhotoSrcSet(rawPhotoUrl, [150, 300, 450]);

  const quantityFormatted = quantityValue && quantityUnit 
    ? `${quantityValue}${quantityUnit}`
    : '';
  
  const nutriScoreImages = {
    'A': smallA,
    'B': smallB,
    'C': smallC,
    'D': smallD,
    'E': smallE
  };
  
  const slug = product.slug || String(productId);
  const linkUrl = `/product/${slug}`;
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <LangLink href={linkUrl} className="block">
        <div className="relative aspect-[3/2]">
          <img 
            src={cardSrc}
            srcSet={cardSrcSet}
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            alt={mainPhoto?.altText || name}
            width={300}
            height={200}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding={priority ? "sync" : "async"}
            className="w-full h-full object-cover"
          />
          {nutrition?.nutriScoreGrade && (
            <div className="absolute bottom-2 left-2 z-10">
              <img 
                src={nutriScoreImages[nutrition.nutriScoreGrade as keyof typeof nutriScoreImages]} 
                alt={`Nutri-Score ${nutrition.nutriScoreGrade}`}
                width={150}
                height={81}
                className="h-11 md:h-10 w-auto"
              />
            </div>
          )}
          {product.store && (
            <div className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded text-xs font-medium text-white ${
              product.store === 'rimi' ? 'bg-[#D33731]' : 'bg-[#24488B]'
            }`}>
              {product.store === 'rimi' ? 'Rimi' : 'Maxima'}
            </div>
          )}
        </div>
        <div className="p-3">
          <h2 className="font-medium text-gray-900 mb-2 text-sm md:text-base">{name}</h2>
          
          {nutrition && (
            <div className="space-y-1.5 mb-2">
              {nutrition.carbsSugars !== null && (
                <NutrientBar 
                  nutrient="sugar" 
                  value={Number(nutrition.carbsSugars)} 
                  compact
                />
              )}
              
              {nutrition.fatSaturated !== null && (
                <NutrientBar 
                  nutrient="saturatedFat" 
                  value={Number(nutrition.fatSaturated)} 
                  compact
                />
              )}
              
              {nutrition.protein !== null && (
                <NutrientBar 
                  nutrient="protein" 
                  value={Number(nutrition.protein)} 
                  compact
                />
              )}
              
              {nutrition.salt !== null && (
                <NutrientBar 
                  nutrient="salt" 
                  value={Number(nutrition.salt)} 
                  compact
                />
              )}
            </div>
          )}
          
          {product.ingredientCard && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <IngredientIndicator ingredientCard={product.ingredientCard} compact />
            </div>
          )}
        </div>
      </LangLink>
    </div>
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <Skeleton className="w-full aspect-[3/2]" />
      <div className="p-3">
        <Skeleton className="h-6 w-3/4 mb-1" />
        <Skeleton className="h-4 w-1/3 mb-4" />
        
        <div className="space-y-3 mb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center">
              <Skeleton className="h-4 w-8 mr-2" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center">
              <Skeleton className="h-4 w-8 mr-2" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center">
              <Skeleton className="h-4 w-8 mr-2" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-16" />
            <div className="flex items-center">
              <Skeleton className="h-4 w-8 mr-2" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
