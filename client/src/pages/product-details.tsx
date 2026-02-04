import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { getProductById, getCategoryById, getCategoryPath, checkHealthierProducts } from '@/api';
import { ChevronRight, ChevronDown, ArrowLeft, ExternalLink, Search } from 'lucide-react';
import LangLink from '@/components/routing/LangLink';
import { trackPetitionClick, trackHealthierAlternativesClick } from '@/lib/analytics';
import NutrientBar from '@/components/ui/nutrient-bar';
import IngredientIndicator from '@/components/ui/ingredient-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Category } from '@/types';
import { getCanonicalUrl, getHreflangUrls } from '@/lib/canonical';
import NotFound from '@/pages/not-found';
import mediumA from '@assets/RVB_A_1768766381068.png';
import mediumB from '@assets/RVB_B_1768766381068.png';
import mediumC from '@assets/RVB_C_1768766381068.png';
import mediumD from '@assets/RVB_D_1768766381067.png';
import mediumE from '@assets/RVB_E_1768766381067.png';

interface ProductDetailsProps {
  lang?: string;
  id?: string;
}

interface NutritionFactsCollapsibleProps {
  nutrition: {
    energyKcal?: number | null;
    energyKj?: number | null;
    protein?: number | null;
    fatTotal?: number | null;
    fatSaturated?: number | null;
    carbsTotal?: number | null;
    carbsSugars?: number | null;
    fiber?: number | null;
    salt?: number | null;
  };
  formatEnergy: (kcal?: number | null, kj?: number | null) => string;
  t: (key: string) => string;
}

const NutritionFactsCollapsible: React.FC<NutritionFactsCollapsibleProps> = ({ nutrition, formatEnergy, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-6">
      <CollapsibleTrigger className="flex items-center gap-2 text-primary hover:text-primary/90 font-medium text-sm">
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        {isOpen ? t('product:nutrition.hideFacts') : t('product:nutrition.showFacts')}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('product:nutrition.facts')}</h2>
        <p className="text-sm text-gray-500 mb-4">{t('common:per100g')}</p>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.energy')}</p>
            <p className="text-gray-900">{formatEnergy(nutrition.energyKcal, nutrition.energyKj)}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.protein')}</p>
            <p className="text-gray-900">
              {nutrition.protein != null ? `${nutrition.protein}g` : t('common:notAvailable')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.fatTotal')}</p>
            <p className="text-gray-900">
              {nutrition.fatTotal != null ? `${nutrition.fatTotal}g` : t('common:notAvailable')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.fatSaturated')}</p>
            <p className="text-gray-900">
              {nutrition.fatSaturated != null ? `${nutrition.fatSaturated}g` : t('common:notAvailable')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.carbsTotal')}</p>
            <p className="text-gray-900">
              {nutrition.carbsTotal != null ? `${nutrition.carbsTotal}g` : t('common:notAvailable')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.sugar')}</p>
            <p className="text-gray-900">
              {nutrition.carbsSugars != null ? `${nutrition.carbsSugars}g` : t('common:notAvailable')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.fiber')}</p>
            <p className="text-gray-900">
              {nutrition.fiber != null ? `${nutrition.fiber}g` : t('common:notAvailable')}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700">{t('product:nutrition.salt')}</p>
            <p className="text-gray-900">
              {nutrition.salt != null ? `${nutrition.salt}g` : t('common:notAvailable')}
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ProductDetails: React.FC<ProductDetailsProps> = ({ lang, id }) => {
  const { t, ready, i18n } = useTranslation(['product', 'common', 'header']);
  
  const productId = Number(id);
  
  const urlParams = new URLSearchParams(window.location.search);
  const store = urlParams.get('store') as 'rimi' | 'maxima' | undefined;
  
  // Always call all hooks first before any early returns
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['/api/products', productId, store],
    queryFn: () => getProductById(productId, store || undefined),
    enabled: ready && Number.isFinite(productId) && productId > 0 && !!id && !isNaN(productId)
  });

  // Fetch category path
  const { data: categoryPath } = useQuery({
    queryKey: ['/api/categories', product?.categoryId, 'path'],
    queryFn: () => getCategoryPath(product!.categoryId),
    enabled: !!product?.categoryId
  });

  // Check for healthier products in the same category (only for C, D, E grades)
  const nutriScoreGrade = product?.nutrition?.nutriScoreGrade;
  const productStore = product?.store;
  const shouldCheckAlternatives = !!(nutriScoreGrade && ['C', 'D', 'E'].includes(nutriScoreGrade));
  
  const { data: healthierProductsData } = useQuery({
    queryKey: ['/api/categories', product?.categoryId, 'has-healthier-products', nutriScoreGrade, productStore],
    queryFn: () => checkHealthierProducts(product!.categoryId, nutriScoreGrade!, productStore),
    enabled: !!product?.categoryId && shouldCheckAlternatives
  });

  // Scroll to top when navigating to product page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  // Now handle early returns after all hooks are called
  if (!id || isNaN(productId) || productId <= 0) {
    return <NotFound />;
  }

  // Don't render until translations are ready
  if (!ready) {
    return <ProductDetailsSkeleton />;
  }

  if (isLoading) {
    return <ProductDetailsSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('product:notFound')}</h1>
          <p className="text-gray-600 mb-6">
            {t('product:notFoundMessage')}
          </p>
          <Link href={`/${lang}`} className="text-primary hover:text-primary/90 font-medium flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('product:backToProducts')}
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
    if (kcal === null || kcal === undefined) return t('common:notAvailable');
    if (kj === null || kj === undefined) return `${kcal} kcal`;
    return `${kcal} kcal / ${kj} kJ`;
  };

  // Get Nutri-Score image
  const nutriScoreImages = {
    'A': mediumA,
    'B': mediumB,
    'C': mediumC,
    'D': mediumD,
    'E': mediumE
  };

  const currentLang = i18n.language?.split('-')[0] || 'lv';
  const hreflangUrls = getHreflangUrls(`/product/${productId}`);

  return (
    <>
      <Helmet>
        <link rel="canonical" href={getCanonicalUrl(`/product/${productId}`, currentLang)} />
        {hreflangUrls.map(({ lang, url }) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={url} />
        ))}
      </Helmet>
      <div className="container mx-auto px-4 py-8">
        {/* Back link */}
        <div className="mb-6">
          <Link 
            href={product.categoryId ? `/${lang}/category/${product.categoryId}` : `/${lang}`} 
            className="text-primary hover:text-primary/90 font-medium flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('product:backToProducts')}
          </Link>
        </div>

      {/* Breadcrumbs */}
      {categoryPath && categoryPath.length > 0 && (
        <nav className="mb-6">
          <ol className="flex flex-wrap items-center text-sm text-gray-500">
            <li>
              <Link href={`/${lang}`} className="hover:text-primary">{t('common:backToHome')}</Link>
            </li>
            {categoryPath.map((category: Category, index: number) => (
              <li key={category.categoryId} className="flex items-center">
                <ChevronRight className="h-4 w-4 mx-1" />
                {index === categoryPath.length - 1 ? (
                  <span className="font-medium text-gray-700">
                    {i18n.language.startsWith('en') ? (category.nameEn || category.nameLv) : category.nameLv}
                  </span>
                ) : (
                  <Link href={`/${lang}/category/${category.categoryId}`} className="hover:text-primary">
                    {i18n.language.startsWith('en') ? (category.nameEn || category.nameLv) : category.nameLv}
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
          <div className="md:w-1/2 bg-gray-100 relative aspect-[3/2] md:aspect-auto">
            <img 
              src={mainPhoto?.photoUrl || `https://via.placeholder.com/600x400?text=${encodeURIComponent(t('common:noImage'))}`} 
              alt={mainPhoto?.altText || product.name}
              width={600}
              height={400}
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-contain md:max-h-[500px]"
            />
          </div>

          {/* Product Details */}
          <div className="md:w-1/2 p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>

            {product.nutrition?.nutriScoreGrade && (
              <div className="mb-6">
                <div className="flex items-start gap-4">
                  <img 
                    src={nutriScoreImages[product.nutrition.nutriScoreGrade as keyof typeof nutriScoreImages]} 
                    alt={`Nutri-Score ${product.nutrition.nutriScoreGrade}`}
                    width={150}
                    height={81}
                    className="h-16 w-auto flex-shrink-0"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    {t(`product:nutriScore.${product.nutrition.nutriScoreGrade}`)}
                  </p>
                </div>
                
                {/* Better alternatives button/message for C, D, E grades */}
                {shouldCheckAlternatives && healthierProductsData && (
                  <div className="mt-4">
                    {healthierProductsData.hasHealthierProducts ? (
                      <LangLink
                        href={`/category/${product.categoryId}?sortBy=nutriScore&nutriScores=${healthierProductsData.betterGrades.join(',')}${productStore ? `&store=${productStore}` : ''}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
                        onClick={() => {
                          trackHealthierAlternativesClick({
                            productId: productId,
                            productName: product.name || '',
                            currentGrade: product.nutrition?.nutriScoreGrade || '',
                            categoryId: product.categoryId || 0,
                            betterGrades: healthierProductsData.betterGrades,
                            alternativesCount: healthierProductsData.count || 0,
                            store: productStore || 'unknown',
                            language: i18n.language || 'unknown',
                          });
                        }}
                      >
                        <Search className="h-4 w-4" />
                        {t('product:alternatives.button')}
                      </LangLink>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        {t('product:alternatives.noAlternatives')}
                      </p>
                    )}
                  </div>
                )}
                
                <a 
                  href={t('header:petition.url')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors mt-3"
                  onClick={() => {
                    trackPetitionClick({
                      linkUrl: t('header:petition.url'),
                      linkText: t('product:petition.text'),
                      language: i18n.language || 'unknown',
                    });
                  }}
                >
                  {t('product:petition.text')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {product.nutrition && (
              <>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-800">{t('product:nutrition.characteristics')}</h3>
                  <p className="text-sm text-gray-500">{t('common:per100g')}</p>
                  {product.nutrition.carbsSugars != null && (
                    <NutrientBar nutrient="sugar" value={Number(product.nutrition.carbsSugars)} />
                  )}
                  {product.nutrition.fatSaturated != null && (
                    <NutrientBar nutrient="saturatedFat" value={Number(product.nutrition.fatSaturated)} />
                  )}
                  {product.nutrition.protein != null && (
                    <NutrientBar nutrient="protein" value={Number(product.nutrition.protein)} />
                  )}
                  {product.nutrition.salt != null && (
                    <NutrientBar nutrient="salt" value={Number(product.nutrition.salt)} />
                  )}
                </div>

                <NutritionFactsCollapsible 
                  nutrition={product.nutrition} 
                  formatEnergy={formatEnergy}
                  t={t}
                />
              </>
            )}

            {product.nutrition?.ingredientsText && (
              <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">{t('product:ingredients')}</h2>
                <p className="text-gray-700 text-sm">{product.nutrition.ingredientsText}</p>
                
                {product.ingredientCard && (
                  <div className="mt-4">
                    <IngredientIndicator ingredientCard={product.ingredientCard} />
                  </div>
                )}
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
                  {t('product:viewOnRimi')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </div>
            )}

            {product.store === 'maxima' && product.externalUrl && (
              <div className="mt-8">
                <a 
                  href={product.externalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:text-primary/90 font-medium flex items-center"
                >
                  {t('product:viewOnBarbora')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
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
