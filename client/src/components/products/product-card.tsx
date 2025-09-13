import React from 'react';
import LangLink from '@/components/routing/LangLink';
import { ProductWithDetails } from '@/types';
import NutriScoreBadge from '@/components/ui/nutri-score-badge';
import NutrientBar from '@/components/ui/nutrient-bar';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductCardProps {
  product: ProductWithDetails;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { productId, name, quantityValue, quantityUnit, nutrition, photos } = product;
  
  // Get primary photo or first photo
  const mainPhoto = photos?.find(p => p.isPrimary) || photos?.[0];
  
  // Format quantity
  const quantityFormatted = quantityValue && quantityUnit 
    ? `${quantityValue}${quantityUnit}`
    : '';
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
      <LangLink href={`/product/${productId}`} className="block">
        <div className="relative">
          <img 
            src={mainPhoto?.photoUrl || 'https://via.placeholder.com/300x200?text=No+Image'}
            alt={mainPhoto?.altText || name}
            className="w-full h-40 object-cover"
          />
          {nutrition?.nutriScoreGrade && (
            <div className="absolute top-2 left-2 z-10">
              <NutriScoreBadge score={nutrition.nutriScoreGrade as any} />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-medium text-gray-900 mb-1 text-sm md:text-base">{name}</h3>
          {quantityFormatted && (
            <p className="text-sm text-gray-500 mb-3">{quantityFormatted}</p>
          )}
          
          {/* Nutrition Highlights */}
          {nutrition && (
            <div className="space-y-2 mb-2">
              {nutrition.carbsSugars !== null && (
                <NutrientBar 
                  nutrient="sugar" 
                  value={Number(nutrition.carbsSugars)} 
                />
              )}
              
              {nutrition.fatTotal !== null && (
                <NutrientBar 
                  nutrient="fat" 
                  value={Number(nutrition.fatTotal)} 
                />
              )}
              
              {nutrition.protein !== null && (
                <NutrientBar 
                  nutrient="protein" 
                  value={Number(nutrition.protein)} 
                />
              )}
              
              {nutrition.salt !== null && (
                <NutrientBar 
                  nutrient="salt" 
                  value={Number(nutrition.salt)} 
                />
              )}
            </div>
          )}
        </div>
      </LangLink>
    </div>
  );
};

// Skeleton loader for product card
export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <Skeleton className="w-full h-40" />
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
