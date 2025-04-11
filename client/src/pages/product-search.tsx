import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Search, ExternalLink } from 'lucide-react';
import { getProductByRimiUrl } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import NutriScoreBadge from '@/components/ui/nutri-score-badge';

const ProductSearch: React.FC = () => {
  const [url, setUrl] = useState('');
  const [rimiUrl, setRimiUrl] = useState<string | null>(null);
  const [, navigate] = useLocation();

  // Query for fetching product by URL
  const { data: product, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/products/url', rimiUrl],
    queryFn: () => rimiUrl ? getProductByRimiUrl(rimiUrl) : null,
    enabled: !!rimiUrl,
    retry: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      setRimiUrl(url.trim());
    }
  };

  const handleViewProductDetails = () => {
    if (product) {
      navigate(`/product/${product.productId}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Meklēt produktu pēc Rimi URL</h1>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Ievadiet Rimi produkta URL"
                className="pl-10 w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <Button type="submit" className="shrink-0">
              Meklēt
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Piemērs: https://www.rimi.lv/e-veikals/lv/produkti/augli-un-darzeni/svaigi-augli/aboli/aboli-elstar-2sk-nl-kg/p/154980
          </p>
        </form>

        {/* Results */}
        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Meklējam produktu...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-600 font-medium">Produkts netika atrasts</p>
            <p className="text-gray-600 mt-1">Pārbaudiet URL vai mēģiniet citu adresi.</p>
          </div>
        )}

        {product && (
          <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Product Photo */}
              {product.photos && product.photos.length > 0 && (
                <div className="w-full md:w-1/3 flex-shrink-0">
                  <img 
                    src={product.photos[0].photoUrl} 
                    alt={product.photos[0].altText || product.name} 
                    className="rounded-md w-full h-auto object-cover"
                  />
                </div>
              )}
              
              {/* Product Info */}
              <div className="flex-grow">
                <h2 className="text-xl font-bold mb-2">{product.name}</h2>
                
                {product.category && (
                  <div className="mb-3">
                    <Badge variant="outline" className="text-gray-600">
                      {product.category.nameLv}
                    </Badge>
                  </div>
                )}
                
                {/* Nutrition Score */}
                {product.nutrition && product.nutrition.nutriScoreGrade && (
                  <div className="mb-4 flex items-center">
                    <span className="text-sm font-medium text-gray-600 mr-2">Nutri-Score:</span>
                    <NutriScoreBadge score={product.nutrition.nutriScoreGrade} size="medium" />
                  </div>
                )}
                
                {/* Product details */}
                <div className="mb-4">
                  <p className="text-gray-600">
                    {product.quantityValue && product.quantityUnit 
                      ? `${product.quantityValue} ${product.quantityUnit}` 
                      : ''}
                  </p>
                  <p className="text-gray-600">SKU: {product.sku}</p>
                </div>
                
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button onClick={handleViewProductDetails}>
                    Skatīt detaļas
                  </Button>
                  
                  {product.rimiUrl && (
                    <Button variant="outline" className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      <a href={product.rimiUrl} target="_blank" rel="noopener noreferrer">
                        Atvērt Rimi
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSearch;