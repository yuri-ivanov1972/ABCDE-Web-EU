// Category types
export interface Category {
  categoryId: number;
  rimiCategoryCode: string;
  nameLv: string;
  nameEn: string;
  parentCategoryId: number | null;
  level: number;
  slug?: string;
}

// Product types
export interface Product {
  productId: number;
  sku: string;
  name: string;
  rimiUrl: string | null;
  categoryId: number;
  quantityValue: number | null;
  quantityUnit: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Nutrition facts types
export interface NutritionFacts {
  nutritionId: number;
  productId: number;
  ingredientsText: string | null;
  energyKcal: number | null;
  energyKj: number | null;
  fatTotal: number | null;
  fatSaturated: number | null;
  carbsTotal: number | null;
  carbsSugars: number | null;
  protein: number | null;
  salt: number | null;
  fiber: number | null;
  nutriScoreGrade: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  nutriScorePoints: number | null;
  dataSourceDate: string | null;
}

// Product photo types
export interface ProductPhoto {
  photoId: number;
  productId: number;
  photoUrl: string;
  altText: string | null;
  isPrimary: boolean;
}

// Store type
export type Store = 'rimi' | 'maxima';

// Ingredient analysis types
export interface IngredientItem {
  id: number;
  name: string;
  category: 'natural' | 'processed' | 'uncategorized';
  is_processed: boolean | null;
  suspicion_level: 'avoid' | 'limit' | 'caution' | 'clean' | null;
  suspicion_category: string | null;
  health_note: string | null;
}

export interface ProductIngredientCard {
  sku: string;
  name: string;
  categoryId: number;
  categoryName: string | null;
  ingredients: IngredientItem[];
  naturalCount: number;
  processedCount: number;
  avoidCount: number;
  limitCount: number;
  cautionCount: number;
}

// Combined product type with relations for frontend use
export interface ProductWithDetails extends Product {
  nutrition?: NutritionFacts;
  photos?: ProductPhoto[];
  category?: Category;
  store?: Store;
  externalUrl?: string | null;
  ingredientCard?: ProductIngredientCard;
  slug?: string;
  novaScore?: number | null;
}

// Filter types
export type NutriScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface Filters {
  nutriScores: NutriScoreGrade[];
  madeInLatvia?: boolean;
}

export interface ProductsResponse {
  products: ProductWithDetails[];
  totalCount: number;
}

// Sorting options
export type SortOption = 'name' | 'nutriScore' | 'sugar' | 'fat' | 'protein' | 'salt';
export type SortOrder = 'asc' | 'desc';
