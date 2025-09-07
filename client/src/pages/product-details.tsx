import React from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { getProductById, getCategoryById, getCategoryPath } from '@/api';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import NutriScoreBadge from '@/components/ui/nutri-score-badge';
import NutrientBar from '@/components/ui/nutrient-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { Category } from '@/types';

const ProductDetails: React.FC = () => {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id, 10);

  // Fetch product details
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['/api/products', productId],
    queryFn: () => getProductById(productId)
  });

  // Fetch category path
  const { data: categoryPath } = useQuery({
    queryKey: ['/api/categories', product?.categoryId, 'path'],
    queryFn: () => getCategoryPath(product!.categoryId),
    enabled: !!product?.categoryId
  });

  if (isLoading) {
    return <ProductDetailsSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Produkts nav atrasts</h1>
          <p className="text-gray-600 mb-6">
            Atvainojiet, mēs nevarējām atrast meklēto produktu.
          </p>
          <Link href="/" className="text-primary hover:text-primary/90 font-medium flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Atpakaļ pie produktiem
          </Link>
        </div>
      </div>
    );
  }

  // Format quantity
  const quantityFormatted = product.quantityValue && product.quantityUnit 
    ? `${product.quantityValue}${product.quantityUnit}`
    : '';

  // Get primary photo or first photo
  const mainPhoto = product.photos?.find(p => p.isPrimary) || product.photos?.[0];
  
  // Format energy value
  const formatEnergy = (kcal?: number | null, kj?: number | null) => {
    if (kcal === null || kcal === undefined) return 'Nav pieejams';
    if (kj === null || kj === undefined) return `${kcal} kcal`;
    return `${kcal} kcal / ${kj} kJ`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link 
          href={product.categoryId ? `/category/${product.categoryId}` : '/'} 
          className="text-primary hover:text-primary/90 font-medium flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Atpakaļ pie produktiem
        </Link>
      </div>

      {/* Breadcrumbs */}
      {categoryPath && categoryPath.length > 0 && (
        <nav className="mb-6">
          <ol className="flex flex-wrap items-center text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-primary">Sākums</Link>
            </li>
            {categoryPath.map((category: Category, index: number) => (
              <li key={category.categoryId} className="flex items-center">
                <ChevronRight className="h-4 w-4 mx-1" />
                {index === categoryPath.length - 1 ? (
                  <span className="font-medium text-gray-700">{category.nameLv}</span>
                ) : (
                  <Link href={`/category/${category.categoryId}`} className="hover:text-primary">
                    {category.nameLv}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="md:flex">
          {/* Product Image */}
          <div className="md:w-1/2 bg-gray-100">
            <img 
              src={mainPhoto?.photoUrl || 'https://via.placeholder.com/600x400?text=Nav+attēla'} 
              alt={mainPhoto?.altText || product.name}
              className="w-full h-full object-contain md:max-h-[500px]"
            />
          </div>

          {/* Product Details */}
          <div className="md:w-1/2 p-6 md:p-8">
            <div className="flex justify-between items-start">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              {product.nutrition?.nutriScoreGrade && (
                <NutriScoreBadge score={product.nutrition.nutriScoreGrade as any} size="large" />
              )}
            </div>

            {quantityFormatted && (
              <p className="text-gray-600 mb-6">{quantityFormatted}</p>
            )}

            {product.nutrition && (
              <>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 mt-8">Uzturvērtības fakti</h2>
                <p className="text-sm text-gray-500 mb-4">Uz 100g/ml</p>

                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Enerģija</p>
                    <p className="text-gray-900">{formatEnergy(product.nutrition.energyKcal, product.nutrition.energyKj)}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Olbaltumvielas</p>
                    <p className="text-gray-900">
                      {product.nutrition.protein !== null ? `${product.nutrition.protein}g` : 'Nav pieejams'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Kopējie tauki</p>
                    <p className="text-gray-900">
                      {product.nutrition.fatTotal !== null ? `${product.nutrition.fatTotal}g` : 'Nav pieejams'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Piesātinātie tauki</p>
                    <p className="text-gray-900">
                      {product.nutrition.fatSaturated !== null ? `${product.nutrition.fatSaturated}g` : 'Nav pieejams'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Kopējie oglhidrāti</p>
                    <p className="text-gray-900">
                      {product.nutrition.carbsTotal !== null ? `${product.nutrition.carbsTotal}g` : 'Nav pieejams'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Cukurs</p>
                    <p className="text-gray-900">
                      {product.nutrition.carbsSugars !== null ? `${product.nutrition.carbsSugars}g` : 'Nav pieejams'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Šķiedrvielas</p>
                    <p className="text-gray-900">
                      {product.nutrition.fiber !== null ? `${product.nutrition.fiber}g` : 'Nav pieejams'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Sāls</p>
                    <p className="text-gray-900">
                      {product.nutrition.salt !== null ? `${product.nutrition.salt}g` : 'Nav pieejams'}
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Uzturvērtības īpatnības</h3>
                  {product.nutrition.carbsSugars !== null && (
                    <NutrientBar nutrient="sugar" value={Number(product.nutrition.carbsSugars)} />
                  )}
                  {product.nutrition.fatTotal !== null && (
                    <NutrientBar nutrient="fat" value={Number(product.nutrition.fatTotal)} />
                  )}
                  {product.nutrition.protein !== null && (
                    <NutrientBar nutrient="protein" value={Number(product.nutrition.protein)} />
                  )}
                  {product.nutrition.salt !== null && (
                    <NutrientBar nutrient="salt" value={Number(product.nutrition.salt)} />
                  )}
                </div>
              </>
            )}

            {product.nutrition?.ingredientsText && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Sastāvdaļas</h2>
                <p className="text-gray-700 text-sm">{product.nutrition.ingredientsText}</p>
              </div>
            )}

            {product.rimiUrl && (
              <div className="mt-8">
                <a 
                  href={product.rimiUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:text-primary/90 font-medium flex items-center"
                >
                  Skatīt Rimi
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Skeleton component for loading state
const ProductDetailsSkeleton: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Skeleton className="h-6 w-32" />
      </div>

      <div className="mb-6">
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2 h-96 md:h-auto">
            <Skeleton className="w-full h-full" />
          </div>

          <div className="md:w-1/2 p-6 md:p-8">
            <div className="flex justify-between items-start">
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>

            <Skeleton className="h-5 w-24 mb-6" />

            <Skeleton className="h-7 w-48 mt-8 mb-4" />
            <Skeleton className="h-4 w-32 mb-4" />

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index}>
                  <Skeleton className="h-5 w-24 mb-1" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-4">
              <Skeleton className="h-6 w-40 mb-3" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex justify-between items-center">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex items-center">
                    <Skeleton className="h-4 w-12 mr-2" />
                    <Skeleton className="h-2 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Skeleton className="h-7 w-32 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
