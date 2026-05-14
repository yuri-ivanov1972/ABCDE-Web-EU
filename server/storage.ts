import {
  categories, products, maximaProducts, nutritionFacts, productPhotos, productPriceHistory,
  type Category, type Product, type NutritionFacts, type ProductPhoto,
} from "./remote-schema";
import {
  scans,
  type Scan, type InsertScan, type Store, type ProductIngredientCard, type IngredientItem,
} from "@shared/schema";
import { rimiDb, maximaDb, scansDb, rimiPool, maximaPool, scansPool } from "./db";
import { eq, like, and, or, gte, lte, inArray, desc, asc, sql, isNotNull } from "drizzle-orm";
import { normalizeLvText, createSearchPattern } from "./utils/textNormalization";
import { productsCache, PRODUCTS_TTL_MS } from "./cache";

// Categories to exclude from display (Gatavots Rimi and its subcategory)
export const EXCLUDED_CATEGORY_IDS = [5, 40];

/**
 * Utility function to retry database operations with exponential backoff
 * @param operation Function that returns a promise to be retried
 * @param maxRetries Maximum number of retry attempts (default: 3)
 * @returns Result of the operation
 */
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await operation();
    } catch (error: any) {
      console.error(`Database operation failed (attempt ${attempt + 1}/${maxRetries}):`, error?.message || error);
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        // Calculate backoff time: 200ms, 400ms, 800ms, etc.
        const backoffTime = 200 * Math.pow(2, attempt);
        console.log(`Retrying in ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
}

// Storage interface
export interface IStorage {
  // Category methods
  getCategories(level?: number): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  getCategoryByCode(code: string): Promise<Category | undefined>;
  getSubcategories(parentId: number): Promise<Category[]>;
  getCategoryPath(categoryId: number): Promise<Category[]>;
  
  // Product methods
  getProducts(options: GetProductsOptions): Promise<{ products: ProductWithDetails[], totalCount: number }>;
  getProductById(id: number, store?: Store): Promise<ProductWithDetails | undefined>;
  getProductBySku(sku: string): Promise<ProductWithDetails | undefined>;
  getProductByRimiUrl(rimiUrl: string): Promise<ProductWithDetails | undefined>;
  searchProducts(query: string, options: GetProductsOptions): Promise<{ products: ProductWithDetails[], totalCount: number }>;
  
  // Scan methods
  createScan(scan: InsertScan): Promise<Scan>;
  getScanById(scanId: number): Promise<Scan | null>;
  getScanByToken(token: string): Promise<Scan | null>;
  cleanupOldScans(daysOld: number): Promise<number>; // Returns count of deleted scans
}

// Types for the storage methods
export type NutriScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export type GetProductsOptions = {
  categoryId?: number;
  page?: number;
  pageSize?: number;
  nutriScores?: NutriScoreGrade[];
  sugarMin?: number;
  sugarMax?: number;
  fatMin?: number;
  fatMax?: number;
  proteinMin?: number;
  proteinMax?: number;
  saltMin?: number;
  saltMax?: number;
  sortBy?: 'name' | 'nutriScore' | 'sugar' | 'fat' | 'protein' | 'salt';
  sortOrder?: 'asc' | 'desc';
  store?: Store;  // Filter by store: 'rimi', 'maxima', or undefined for both
  madeInLatvia?: boolean;  // Filter to show only products made in Latvia
};

// Combined product type with related data
export type ProductWithDetails = Product & {
  nutrition?: NutritionFacts;
  photos?: ProductPhoto[];
  category?: Category;
  store?: Store;
  externalUrl?: string | null;
  ingredientCard?: ProductIngredientCard;
};

export class DatabaseStorage implements IStorage {
  // Helper to build ingredient card map from query results
  private buildIngredientCardsFromRows(rows: any[]): Map<string, ProductIngredientCard> {
    const ingredientsBySku = new Map<string, IngredientItem[]>();
    
    for (const row of rows) {
      const sku = row.product_sku;
      if (!ingredientsBySku.has(sku)) {
        ingredientsBySku.set(sku, []);
      }
      
      ingredientsBySku.get(sku)!.push({
        id: row.ingredient_id,
        name: row.clean_name || row.ingredient,
        category: row.category || 'uncategorized',
        is_processed: row.is_processed,
        suspicion_level: row.suspicion_level,
        suspicion_category: row.suspicion_category,
        health_note: row.health_note
      });
    }
    
    const ingredientCardsMap = new Map<string, ProductIngredientCard>();
    
    ingredientsBySku.forEach((ingredients, sku) => {
      let naturalCount = 0;
      let processedCount = 0;
      let avoidCount = 0;
      let limitCount = 0;
      let cautionCount = 0;
      
      for (const ing of ingredients) {
        if (ing.category === 'natural') {
          naturalCount++;
        } else if (ing.category === 'processed') {
          processedCount++;
        }
        
        if (ing.suspicion_level === 'avoid') {
          avoidCount++;
        } else if (ing.suspicion_level === 'limit') {
          limitCount++;
        } else if (ing.suspicion_level === 'caution') {
          cautionCount++;
        }
      }
      
      ingredientCardsMap.set(sku, {
        sku,
        name: '',
        categoryId: 0,
        categoryName: null,
        ingredients,
        naturalCount,
        processedCount,
        avoidCount,
        limitCount,
        cautionCount
      });
    });
    
    return ingredientCardsMap;
  }

  // Helper method to fetch ingredient cards for Rimi products
  private async fetchRimiIngredientCardsBySku(skus: string[]): Promise<Map<string, ProductIngredientCard>> {
    if (skus.length === 0) {
      return new Map();
    }
    
    try {
      const placeholders = skus.map((_, i) => `$${i + 1}`).join(', ');
      const query = `
        SELECT 
          ipm.product_sku,
          ia.id as ingredient_id,
          ia.ingredient,
          ia.clean_name,
          ia.category,
          ia.is_processed,
          ia.suspicion_level,
          ia.suspicion_category,
          ia.health_note
        FROM ingredient_product_mapping ipm
        JOIN ingredient_analysis ia ON ipm.ingredient_id = ia.id
        WHERE ipm.product_sku IN (${placeholders})
        ORDER BY ipm.product_sku, ia.id
      `;
      
      const result = await rimiPool.query(query, skus);
      return this.buildIngredientCardsFromRows(result.rows);
    } catch (error) {
      console.error('Error fetching Rimi ingredient cards:', error);
      return new Map();
    }
  }

  // Helper method to fetch ingredient cards for Maxima products
  private async fetchMaximaIngredientCardsBySku(skus: string[]): Promise<Map<string, ProductIngredientCard>> {
    if (skus.length === 0 || !maximaPool) {
      return new Map();
    }
    
    try {
      const placeholders = skus.map((_, i) => `$${i + 1}`).join(', ');
      const query = `
        SELECT 
          ipm.product_sku,
          ia.id as ingredient_id,
          ia.ingredient,
          ia.clean_name,
          ia.category,
          ia.is_processed,
          ia.suspicion_level,
          ia.suspicion_category,
          ia.health_note
        FROM ingredient_product_mapping ipm
        JOIN ingredient_analysis ia ON ipm.ingredient_id = ia.id
        WHERE ipm.product_sku IN (${placeholders})
        ORDER BY ipm.product_sku, ia.id
      `;
      
      const result = await maximaPool.query(query, skus);
      return this.buildIngredientCardsFromRows(result.rows);
    } catch (error) {
      console.error('Error fetching Maxima ingredient cards:', error);
      return new Map();
    }
  }

  // Fetch ingredient cards for products with known stores
  private async fetchIngredientCardsForProducts(products: { sku: string; store?: Store }[]): Promise<Map<string, ProductIngredientCard>> {
    const rimiSkus = products.filter(p => p.store === 'rimi').map(p => p.sku);
    const maximaSkus = products.filter(p => p.store === 'maxima').map(p => p.sku);
    
    const [rimiCards, maximaCards] = await Promise.all([
      this.fetchRimiIngredientCardsBySku(rimiSkus),
      this.fetchMaximaIngredientCardsBySku(maximaSkus)
    ]);
    
    // Merge both maps
    const combinedMap = new Map<string, ProductIngredientCard>();
    rimiCards.forEach((card, sku) => combinedMap.set(sku, card));
    maximaCards.forEach((card, sku) => combinedMap.set(sku, card));
    
    return combinedMap;
  }

  // Category methods
  async getCategories(level?: number): Promise<Category[]> {
    // We'll show all categories but mark which ones have products
    console.log("Getting categories...");
    
    // Build where condition based on level, always excluding hidden categories
    const excludeCondition = sql`${categories.categoryId} NOT IN (${sql.join(EXCLUDED_CATEGORY_IDS.map(id => sql`${id}`), sql`, `)})`;
    
    if (level !== undefined) {
      return await rimiDb
        .select()
        .from(categories)
        .where(and(eq(categories.level, level), excludeCondition))
        .orderBy(categories.nameEn);
    } else {
      return await rimiDb
        .select()
        .from(categories)
        .where(excludeCondition)
        .orderBy(categories.level, categories.nameEn);
    }
  }
  
  async getCategoryById(id: number): Promise<Category | undefined> {
    // Return undefined for excluded categories
    if (EXCLUDED_CATEGORY_IDS.includes(id)) {
      return undefined;
    }
    const [category] = await rimiDb
      .select()
      .from(categories)
      .where(eq(categories.categoryId, id));
    return category;
  }
  
  async getCategoryByCode(code: string): Promise<Category | undefined> {
    const [category] = await rimiDb
      .select()
      .from(categories)
      .where(eq(categories.rimiCategoryCode, code));
    return category;
  }
  
  async getSubcategories(parentId: number): Promise<Category[]> {
    // Return all subcategories, excluding hidden categories
    return await rimiDb
      .select()
      .from(categories)
      .where(and(
        eq(categories.parentCategoryId, parentId),
        sql`${categories.categoryId} NOT IN (${sql.join(EXCLUDED_CATEGORY_IDS.map(id => sql`${id}`), sql`, `)})`
      ))
      .orderBy(categories.nameEn);
  }
  
  async getCategoryPath(categoryId: number): Promise<Category[]> {
    try {
      // Start with an empty path
      const categoryPath: Category[] = [];
      
      // Get the current category
      const [currentCategory] = await rimiDb
        .select()
        .from(categories)
        .where(eq(categories.categoryId, categoryId));
      
      if (!currentCategory) {
        return [];
      }
      
      // Add the current category to the path
      categoryPath.push(currentCategory);
      
      // Get parent category if exists
      let parentId = currentCategory.parentCategoryId;
      
      // Recursively get parent categories
      while (parentId !== null) {
        const [parentCategory] = await rimiDb
          .select()
          .from(categories)
          .where(eq(categories.categoryId, parentId));
        
        if (parentCategory) {
          categoryPath.push(parentCategory);
          parentId = parentCategory.parentCategoryId;
        } else {
          break;
        }
      }
      
      // The path should be in order from root to leaf
      return categoryPath.reverse();
    } catch (error) {
      console.error("Error in getCategoryPath:", error);
      return [];
    }
  }
  
  // Helper to query Maxima products and convert to unified format
  private async getMaximaProducts(
    allCategoriesToInclude: number[],
    nutriScores: NutriScoreGrade[] | undefined,
    hasNutrientFilters: boolean,
    sortBy: string,
    sortOrder: string,
    limit: number,
    offset: number,
    madeInLatvia?: boolean
  ): Promise<{ products: ProductWithDetails[], count: number }> {
    if (!maximaDb) {
      return { products: [], count: 0 };
    }


    try {
      // Build WHERE conditions for Maxima
      let whereConditions: any[] = [
        isNotNull(maximaProducts.rimiCategoryCode),  // Only products with rimi_category_code
        // Only show products that are currently available (latest price history record has is_available = true)
        sql`EXISTS (
          SELECT 1 FROM product_price_history pph 
          WHERE pph.product_id = ${maximaProducts.productId}
          AND pph.is_available = true
          AND pph.recorded_at = (
            SELECT MAX(pph2.recorded_at) 
            FROM product_price_history pph2 
            WHERE pph2.product_id = pph.product_id
          )
        )`
      ];

      if (allCategoriesToInclude.length > 0) {
        whereConditions.push(inArray(maximaProducts.rimiCategoryCode, allCategoriesToInclude));
      }
      
      // Add Nutri-Score filter
      if (nutriScores && nutriScores.length > 0) {
        whereConditions.push(inArray(nutritionFacts.nutriScoreGrade, nutriScores));
      }
      
      // Add madeInLatvia filter for Maxima
      if (madeInLatvia) {
        whereConditions.push(sql`${maximaProducts.countryOfOrigin} = 'Latvija'`);
      }

      // Build ORDER BY clause for Maxima (now includes nutrition data via INNER JOIN)
      let orderByClause: any;
      if (sortBy === 'name') {
        orderByClause = sortOrder === 'asc' ? asc(maximaProducts.name) : desc(maximaProducts.name);
      } else if (sortBy === 'nutriScore') {
        orderByClause = sortOrder === 'asc' 
          ? asc(nutritionFacts.nutriScoreGrade)
          : desc(nutritionFacts.nutriScoreGrade);
      } else if (sortBy === 'sugar') {
        orderByClause = sortOrder === 'asc' 
          ? asc(nutritionFacts.carbsSugars)
          : desc(nutritionFacts.carbsSugars);
      } else if (sortBy === 'fat') {
        orderByClause = sortOrder === 'asc' 
          ? asc(nutritionFacts.fatTotal)
          : desc(nutritionFacts.fatTotal);
      } else if (sortBy === 'protein') {
        orderByClause = sortOrder === 'asc' 
          ? asc(nutritionFacts.protein)
          : desc(nutritionFacts.protein);
      } else if (sortBy === 'salt') {
        orderByClause = sortOrder === 'asc' 
          ? asc(nutritionFacts.salt)
          : desc(nutritionFacts.salt);
      } else {
        orderByClause = asc(maximaProducts.name);
      }

      // Query Maxima products with INNER JOIN to only get products with Nutri-Score
      const maximaQuery = await maximaDb
        .select({
          productId: maximaProducts.productId,
          sku: maximaProducts.sku,
          name: maximaProducts.name,
          nameNorm: maximaProducts.name_norm,
          categoryId: maximaProducts.rimiCategoryCode,  // Use rimi_category_code as categoryId
          barboraUrl: maximaProducts.barboraUrl,
          quantityValue: maximaProducts.quantityValue,
          quantityUnit: maximaProducts.quantityUnit,
          createdAt: maximaProducts.createdAt,
          updatedAt: maximaProducts.updatedAt,
          nutriScoreGrade: nutritionFacts.nutriScoreGrade,
        })
        .from(maximaProducts)
        .innerJoin(nutritionFacts, eq(maximaProducts.productId, nutritionFacts.productId))
        .where(and(...whereConditions, isNotNull(nutritionFacts.nutriScoreGrade)))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      // Get count of products with Nutri-Score
      const countQuery = await maximaDb
        .select({ count: sql<number>`count(*)` })
        .from(maximaProducts)
        .innerJoin(nutritionFacts, eq(maximaProducts.productId, nutritionFacts.productId))
        .where(and(...whereConditions, isNotNull(nutritionFacts.nutriScoreGrade)));

      const count = Number(countQuery[0]?.count) || 0;

      // Get photos and nutrition for Maxima products
      const productIds = maximaQuery.map(p => p.productId);
      let photosMap: Record<number, ProductPhoto[]> = {};
      let nutritionMap: Record<number, NutritionFacts> = {};
      
      if (productIds.length > 0) {
        // Fetch photos and nutrition in parallel
        const [allPhotos, allNutrition] = await Promise.all([
          maximaDb
            .select()
            .from(productPhotos)
            .where(inArray(productPhotos.productId, productIds)),
          maximaDb
            .select()
            .from(nutritionFacts)
            .where(inArray(nutritionFacts.productId, productIds))
        ]);
        
        photosMap = allPhotos.reduce((map, photo) => {
          if (!map[photo.productId]) {
            map[photo.productId] = [];
          }
          map[photo.productId].push(photo);
          return map;
        }, {} as Record<number, ProductPhoto[]>);
        
        nutritionMap = allNutrition.reduce((map, nutrition) => {
          map[nutrition.productId] = nutrition;
          return map;
        }, {} as Record<number, NutritionFacts>);
      }

      // Get categories from Rimi DB (they're shared)
      const categoryIds = maximaQuery.map(p => p.categoryId).filter(id => id !== null) as number[];
      let categoryMap: Record<number, Category> = {};
      
      if (categoryIds.length > 0) {
        const allCategories = await rimiDb
          .select()
          .from(categories)
          .where(inArray(categories.categoryId, categoryIds));
        
        categoryMap = allCategories.reduce((map, cat) => {
          map[cat.categoryId] = cat;
          return map;
        }, {} as Record<number, Category>);
      }

      // Convert to ProductWithDetails format (already filtered by INNER JOIN)
      const productsWithDetails: ProductWithDetails[] = maximaQuery.map(row => ({
        productId: row.productId,
        sku: row.sku,
        name: row.name,
        name_norm: row.nameNorm,
        categoryId: row.categoryId || 0,
        rimiUrl: null,  // Maxima doesn't have rimiUrl
        quantityValue: row.quantityValue,
        quantityUnit: row.quantityUnit,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        nutrition: nutritionMap[row.productId],
        photos: photosMap[row.productId] || [],
        category: row.categoryId ? categoryMap[row.categoryId] : undefined,
        store: 'maxima' as Store,
        externalUrl: row.barboraUrl
      }));

      return { products: productsWithDetails, count };
    } catch (error) {
      console.error('Error fetching Maxima products:', error);
      return { products: [], count: 0 };
    }
  }

  // Product methods
  async getProducts(options: GetProductsOptions): Promise<{ products: ProductWithDetails[], totalCount: number }> {
    const {
      categoryId,
      page = 1,
      pageSize = 12,
      nutriScores,
      sugarMin,
      sugarMax,
      fatMin,
      fatMax,
      proteinMin,
      proteinMax,
      saltMin,
      saltMax,
      sortBy = 'name',
      sortOrder = 'asc',
      store,
      madeInLatvia
    } = options;
    
    console.log(`GET products with options`, JSON.stringify(options));
    
    try {
      // Cache lookup — return instantly for identical queries within TTL
      const cacheKey = JSON.stringify({
        categoryId: options.categoryId,
        page: options.page ?? 1,
        pageSize: options.pageSize ?? 12,
        nutriScores: options.nutriScores,
        sugarMin: options.sugarMin, sugarMax: options.sugarMax,
        fatMin: options.fatMin, fatMax: options.fatMax,
        proteinMin: options.proteinMin, proteinMax: options.proteinMax,
        saltMin: options.saltMin, saltMax: options.saltMax,
        sortBy: options.sortBy ?? 'name',
        sortOrder: options.sortOrder ?? 'asc',
        store: options.store,
        madeInLatvia: options.madeInLatvia,
      });
      const cached = productsCache.get(cacheKey);
      if (cached) {
        console.log(`GET products cache HIT for key length ${cacheKey.length}`);
        return cached;
      }

      // Step 1: Build category list to include (keep this logic as it's necessary for hierarchical categories)
      let allCategoriesToInclude: number[] = [];
      
      if (categoryId) {
        // Get the current category to determine its level
        const [currentCategory] = await rimiDb
          .select()
          .from(categories)
          .where(eq(categories.categoryId, categoryId));
        
        if (currentCategory) {
          console.log(`Current category: ${currentCategory.nameLv} (ID: ${currentCategory.categoryId}, Level: ${currentCategory.level})`);
          
          allCategoriesToInclude = [categoryId];
          
          // If this is level 1 or 2, include subcategories
          if (currentCategory.level < 3) {
            const subcategories = await rimiDb
              .select()
              .from(categories)
              .where(eq(categories.parentCategoryId, categoryId));
            
            allCategoriesToInclude.push(...subcategories.map(c => c.categoryId));
            
            // If level 1, go one level deeper — single batch query instead of N+1 loop
            if (currentCategory.level === 1 && subcategories.length > 0) {
              const subsubcategories = await rimiDb
                .select()
                .from(categories)
                .where(inArray(categories.parentCategoryId, subcategories.map(s => s.categoryId)));
              allCategoriesToInclude.push(...subsubcategories.map(c => c.categoryId));
            }
          }
          
          console.log(`Including products from categories: ${allCategoriesToInclude.join(', ')}`);
        }
      }
      
      // Step 2: Build WHERE conditions for nutritional filters
      let whereConditions: any[] = [
        isNotNull(nutritionFacts.nutriScoreGrade),  // Only show products with Nutri-Score
        // Only show currently-available products.
        // Non-correlated DISTINCT ON subquery runs once and returns a set of IDs —
        // far cheaper than the old correlated EXISTS with a nested MAX per row.
        sql`${products.productId} IN (
          SELECT product_id FROM (
            SELECT DISTINCT ON (product_id) product_id, is_available
            FROM product_price_history
            ORDER BY product_id, recorded_at DESC
          ) latest
          WHERE latest.is_available = true
        )`,
        // Exclude hidden categories
        sql`${products.categoryId} NOT IN (${sql.join(EXCLUDED_CATEGORY_IDS.map(id => sql`${id}`), sql`, `)})`
      ];
      
      // Add category filter if specified
      if (categoryId) {
        // Filter out excluded categories from the list
        const filteredCategories = allCategoriesToInclude.filter(id => !EXCLUDED_CATEGORY_IDS.includes(id));
        if (filteredCategories.length > 0) {
          whereConditions.push(inArray(products.categoryId, filteredCategories));
        } else {
          // If user explicitly requested an excluded category, return 0 results
          return { products: [], totalCount: 0 };
        }
      }
      
      // Add nutritional filters
      if (nutriScores && nutriScores.length > 0) {
        whereConditions.push(inArray(nutritionFacts.nutriScoreGrade, nutriScores));
      }
      
      if (sugarMin !== undefined) {
        whereConditions.push(sql`${nutritionFacts.carbsSugars} >= ${sugarMin}`);
      }
      if (sugarMax !== undefined) {
        whereConditions.push(sql`${nutritionFacts.carbsSugars} <= ${sugarMax}`);
      }
      
      if (fatMin !== undefined) {
        whereConditions.push(sql`${nutritionFacts.fatTotal} >= ${fatMin}`);
      }
      if (fatMax !== undefined) {
        whereConditions.push(sql`${nutritionFacts.fatTotal} <= ${fatMax}`);
      }
      
      if (proteinMin !== undefined) {
        whereConditions.push(sql`${nutritionFacts.protein} >= ${proteinMin}`);
      }
      if (proteinMax !== undefined) {
        whereConditions.push(sql`${nutritionFacts.protein} <= ${proteinMax}`);
      }
      
      if (saltMin !== undefined) {
        whereConditions.push(sql`${nutritionFacts.salt} >= ${saltMin}`);
      }
      if (saltMax !== undefined) {
        whereConditions.push(sql`${nutritionFacts.salt} <= ${saltMax}`);
      }
      
      // Add madeInLatvia filter
      if (madeInLatvia) {
        whereConditions.push(sql`${products}.country_of_origin = 'Latvija'`);
      }
      
      // Step 3: Build ORDER BY clause
      let orderByClause: any;
      
      if (sortBy === 'name') {
        orderByClause = sortOrder === 'asc' ? asc(products.name) : desc(products.name);
      } else if (sortBy === 'nutriScore') {
        orderByClause = sortOrder === 'asc' 
          ? sql`CASE WHEN ${nutritionFacts.nutriScoreGrade} IS NULL THEN 'Z' ELSE ${nutritionFacts.nutriScoreGrade} END ASC`
          : sql`CASE WHEN ${nutritionFacts.nutriScoreGrade} IS NULL THEN 'Z' ELSE ${nutritionFacts.nutriScoreGrade} END DESC`;
      } else if (sortBy === 'sugar') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.carbsSugars} ASC NULLS LAST`
          : sql`${nutritionFacts.carbsSugars} DESC NULLS LAST`;
      } else if (sortBy === 'fat') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.fatTotal} ASC NULLS LAST`
          : sql`${nutritionFacts.fatTotal} DESC NULLS LAST`;
      } else if (sortBy === 'protein') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.protein} ASC NULLS LAST`
          : sql`${nutritionFacts.protein} DESC NULLS LAST`;
      } else if (sortBy === 'salt') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.salt} ASC NULLS LAST`
          : sql`${nutritionFacts.salt} DESC NULLS LAST`;
      } else {
        // Default to name sorting
        orderByClause = asc(products.name);
      }
      
      // Step 4: Execute main query with JOIN, WHERE, ORDER BY, and pagination
      const offset = (page - 1) * pageSize;
      
      // For combined store view, fetch more products to enable proper merged pagination
      const isCombinedMode = store === undefined && maximaDb !== null;
      const queryLimit = isCombinedMode ? offset + pageSize : pageSize;
      const queryOffset = isCombinedMode ? 0 : offset;
      
      const mainQuery = await withRetry(async () => {
        console.log(`Executing main query with ${whereConditions.length} WHERE conditions, limit=${queryLimit}, offset=${queryOffset}`);
        
        let query = rimiDb
          .select({
            // Product fields
            productId: products.productId,
            sku: products.sku,
            name: products.name,
            nameNorm: products.name_norm,
            categoryId: products.categoryId,
            rimiUrl: products.rimiUrl,
            quantityValue: products.quantityValue,
            quantityUnit: products.quantityUnit,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
            // Nutrition facts fields
            nutritionId: nutritionFacts.nutritionId,
            ingredientsText: nutritionFacts.ingredientsText,
            energyKcal: nutritionFacts.energyKcal,
            energyKj: nutritionFacts.energyKj,
            fatTotal: nutritionFacts.fatTotal,
            fatSaturated: nutritionFacts.fatSaturated,
            carbsTotal: nutritionFacts.carbsTotal,
            carbsSugars: nutritionFacts.carbsSugars,
            protein: nutritionFacts.protein,
            salt: nutritionFacts.salt,
            fiber: nutritionFacts.fiber,
            nutriScoreGrade: nutritionFacts.nutriScoreGrade,
            nutriScorePoints: nutritionFacts.nutriScorePoints,
            dataSourceDate: nutritionFacts.dataSourceDate
          })
          .from(products)
          .leftJoin(nutritionFacts, eq(products.productId, nutritionFacts.productId));
        
        if (whereConditions.length > 0) {
          query = query.where(and(...whereConditions)) as any;
        }
        
        return query
          .orderBy(orderByClause)
          .limit(queryLimit)
          .offset(queryOffset);
      });
      
      console.log(`Main query returned ${mainQuery.length} products`);
      
      // Step 5: Get total count of filtered results (not paginated)
      const totalCountQuery = await withRetry(async () => {
        console.log(`Executing count query with ${whereConditions.length} WHERE conditions`);
        
        let countQuery = rimiDb
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .leftJoin(nutritionFacts, eq(products.productId, nutritionFacts.productId));
        
        if (whereConditions.length > 0) {
          countQuery = countQuery.where(and(...whereConditions)) as any;
        }
        
        return countQuery;
      });
      
      const totalCount = Number(totalCountQuery[0]?.count) || 0;
      console.log(`Total filtered results count: ${totalCount}`);
      
      // Step 6: Fetch additional details (photos and categories) in batch
      const productIds = mainQuery.map(p => p.productId);
      
      let photosMap: Record<number, ProductPhoto[]> = {};
      let categoryMap: Record<number, Category> = {};
      
      if (productIds.length > 0) {
        // Fetch photos and categories in parallel
        const [allPhotos, allCategories] = await Promise.all([
          rimiDb
            .select()
            .from(productPhotos)
            .where(inArray(productPhotos.productId, productIds)),
            
          rimiDb
            .select()
            .from(categories)
            .where(inArray(categories.categoryId, mainQuery.map(p => p.categoryId)))
        ]);
        
        // Group photos by product ID
        photosMap = allPhotos.reduce((map, photo) => {
          if (!map[photo.productId]) {
            map[photo.productId] = [];
          }
          map[photo.productId].push(photo);
          return map;
        }, {} as Record<number, ProductPhoto[]>);
        
        // Create category map
        categoryMap = allCategories.reduce((map, cat) => {
          map[cat.categoryId] = cat;
          return map;
        }, {} as Record<number, Category>);
      }
      
      // Step 7: Construct final Rimi products with details
      const rimiProductsWithDetails: ProductWithDetails[] = mainQuery.map(row => {
        // Extract product data
        const product: Product = {
          productId: row.productId,
          sku: row.sku,
          name: row.name,
          name_norm: row.nameNorm,
          categoryId: row.categoryId,
          rimiUrl: row.rimiUrl,
          quantityValue: row.quantityValue,
          quantityUnit: row.quantityUnit,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
        
        // Extract nutrition data if available
        const nutrition: NutritionFacts | undefined = row.nutritionId ? {
          nutritionId: row.nutritionId,
          productId: row.productId,
          ingredientsText: row.ingredientsText,
          energyKcal: row.energyKcal,
          energyKj: row.energyKj,
          fatTotal: row.fatTotal,
          fatSaturated: row.fatSaturated,
          carbsTotal: row.carbsTotal,
          carbsSugars: row.carbsSugars,
          protein: row.protein,
          salt: row.salt,
          fiber: row.fiber,
          nutriScoreGrade: row.nutriScoreGrade,
          nutriScorePoints: row.nutriScorePoints,
          dataSourceDate: row.dataSourceDate
        } : undefined;
        
        return {
          ...product,
          nutrition,
          photos: photosMap[product.productId] || [],
          category: categoryMap[product.categoryId],
          store: 'rimi' as Store,
          externalUrl: row.rimiUrl
        };
      });
      
      // Step 8: If store filter is not 'rimi', also fetch Maxima products
      let allProducts = rimiProductsWithDetails;
      let finalTotalCount = totalCount;
      
      if (store !== 'rimi' && maximaDb) {
        // Check if nutrient filters are applied
        const hasNutrientFilters = !!(nutriScores?.length || sugarMin !== undefined || sugarMax !== undefined || 
          fatMin !== undefined || fatMax !== undefined || proteinMin !== undefined || 
          proteinMax !== undefined || saltMin !== undefined || saltMax !== undefined);
        
        // If store is 'maxima', we should not include Rimi products
        if (store === 'maxima') {
          const maximaResult = await this.getMaximaProducts(
            allCategoriesToInclude, nutriScores, hasNutrientFilters, sortBy, sortOrder, pageSize, offset, madeInLatvia
          );
          allProducts = maximaResult.products;
          finalTotalCount = maximaResult.count;
        } else {
          // Combined view: fetch enough products from Maxima to cover the current page
          // We need offset + pageSize products from each store to properly paginate
          const combinedLimit = offset + pageSize;
          
          const maximaResult = await this.getMaximaProducts(
            allCategoriesToInclude, nutriScores, hasNutrientFilters, sortBy, sortOrder, combinedLimit, 0, madeInLatvia
          );
          
          // Merge and sort the combined results
          allProducts = [...rimiProductsWithDetails, ...maximaResult.products];
          finalTotalCount = Number(totalCount) + Number(maximaResult.count);
          
          // Sort the merged results according to sortBy/sortOrder
          // Use secondary sort by name to interleave products from both stores when primary values are equal
          allProducts.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'name') {
              comparison = a.name.localeCompare(b.name, 'lv');
            } else if (sortBy === 'nutriScore') {
              const gradeA = a.nutrition?.nutriScoreGrade || 'Z';
              const gradeB = b.nutrition?.nutriScoreGrade || 'Z';
              comparison = gradeA.localeCompare(gradeB);
              // Secondary sort by name when grades are equal
              if (comparison === 0) {
                comparison = a.name.localeCompare(b.name, 'lv');
              }
            } else if (sortBy === 'sugar') {
              const valA = parseFloat(String(a.nutrition?.carbsSugars || 9999));
              const valB = parseFloat(String(b.nutrition?.carbsSugars || 9999));
              comparison = valA - valB;
              if (comparison === 0) {
                comparison = a.name.localeCompare(b.name, 'lv');
              }
            } else if (sortBy === 'fat') {
              const valA = parseFloat(String(a.nutrition?.fatTotal || 9999));
              const valB = parseFloat(String(b.nutrition?.fatTotal || 9999));
              comparison = valA - valB;
              if (comparison === 0) {
                comparison = a.name.localeCompare(b.name, 'lv');
              }
            } else if (sortBy === 'protein') {
              const valA = parseFloat(String(a.nutrition?.protein || 0));
              const valB = parseFloat(String(b.nutrition?.protein || 0));
              comparison = valA - valB;  // Same direction as other nutrients
              if (comparison === 0) {
                comparison = a.name.localeCompare(b.name, 'lv');
              }
            } else if (sortBy === 'salt') {
              const valA = parseFloat(String(a.nutrition?.salt || 9999));
              const valB = parseFloat(String(b.nutrition?.salt || 9999));
              comparison = valA - valB;
              if (comparison === 0) {
                comparison = a.name.localeCompare(b.name, 'lv');
              }
            }
            return sortOrder === 'desc' ? -comparison : comparison;
          });
          
          // Slice from offset to offset + pageSize for proper pagination
          allProducts = allProducts.slice(offset, offset + pageSize);
        }
      }
      
      // Step 9: Enrich products with ingredient card data (both stores)
      const ingredientCardsMap = await this.fetchIngredientCardsForProducts(
        allProducts.map(p => ({ sku: p.sku, store: p.store }))
      );
      
      // Attach ingredient cards to products
      const enrichedProducts = allProducts.map(p => ({
        ...p,
        ingredientCard: ingredientCardsMap.get(p.sku)
      }));
      
      const result = { products: enrichedProducts, totalCount: finalTotalCount };
      productsCache.set(cacheKey, result, PRODUCTS_TTL_MS);
      console.log(`GET products with options ${JSON.stringify(options)} returned ${enrichedProducts.length} products, total: ${finalTotalCount} (stored in cache)`);
      return result;
      
    } catch (error) {
      console.error('Error in getProducts:', error);
      return { products: [], totalCount: 0 };
    }
  }
  
  async getProductById(id: number, store?: Store): Promise<ProductWithDetails | undefined> {
    // If store is 'maxima' or not specified, try Maxima first if it's a Maxima ID
    if (store === 'maxima' && maximaDb) {
      return this.getMaximaProductById(id);
    }
    
    // First try Rimi
    const [product] = await rimiDb
      .select()
      .from(products)
      .where(eq(products.productId, id));
      
    if (product) {
      // Get all related data in parallel (including ingredient card)
      const [nutrition, photos, category, ingredientCardsMap] = await Promise.all([
        rimiDb
          .select()
          .from(nutritionFacts)
          .where(eq(nutritionFacts.productId, product.productId))
          .then(results => results[0] || null),
        rimiDb
          .select()
          .from(productPhotos)
          .where(eq(productPhotos.productId, product.productId)),
        rimiDb
          .select()
          .from(categories)
          .where(eq(categories.categoryId, product.categoryId))
          .then(results => results[0] || null),
        this.fetchRimiIngredientCardsBySku([product.sku])
      ]);
      
      return {
        ...product,
        nutrition,
        photos,
        category,
        store: 'rimi' as Store,
        externalUrl: product.rimiUrl,
        ingredientCard: ingredientCardsMap.get(product.sku)
      };
    }
    
    // If not found in Rimi and store not specified, try Maxima
    if (!store && maximaDb) {
      return this.getMaximaProductById(id);
    }
    
    return undefined;
  }
  
  private async getMaximaProductById(id: number): Promise<ProductWithDetails | undefined> {
    if (!maximaDb) return undefined;
    
    const [maximaProduct] = await maximaDb
      .select()
      .from(maximaProducts)
      .where(eq(maximaProducts.productId, id));
      
    if (!maximaProduct) return undefined;
    
    // Get nutrition, photos, ingredient cards from Maxima DB and category from Rimi DB
    const [nutrition, photos, category, ingredientCardsMap] = await Promise.all([
      maximaDb
        .select()
        .from(nutritionFacts)
        .where(eq(nutritionFacts.productId, maximaProduct.productId))
        .then(results => results[0] || null),
      maximaDb
        .select()
        .from(productPhotos)
        .where(eq(productPhotos.productId, maximaProduct.productId)),
      maximaProduct.rimiCategoryCode 
        ? rimiDb
            .select()
            .from(categories)
            .where(eq(categories.categoryId, maximaProduct.rimiCategoryCode))
            .then(results => results[0] || null)
        : Promise.resolve(null),
      this.fetchMaximaIngredientCardsBySku([maximaProduct.sku])
    ]);
    
    return {
      productId: maximaProduct.productId,
      sku: maximaProduct.sku,
      name: maximaProduct.name,
      name_norm: maximaProduct.name_norm,
      categoryId: maximaProduct.rimiCategoryCode || 0,
      rimiUrl: null,
      quantityValue: maximaProduct.quantityValue,
      quantityUnit: maximaProduct.quantityUnit,
      createdAt: maximaProduct.createdAt,
      updatedAt: maximaProduct.updatedAt,
      nutrition: nutrition || undefined,
      photos,
      category: category || undefined,
      store: 'maxima' as Store,
      externalUrl: maximaProduct.barboraUrl,
      ingredientCard: ingredientCardsMap.get(maximaProduct.sku)
    };
  }
  
  async getProductBySku(sku: string): Promise<ProductWithDetails | undefined> {
    // First get the product
    const [product] = await rimiDb
      .select()
      .from(products)
      .where(eq(products.sku, sku));
      
    if (!product) return undefined;
    
    // Get all related data in parallel (including ingredient card)
    const [nutrition, photos, category, ingredientCardsMap] = await Promise.all([
      // Get nutrition facts
      rimiDb
        .select()
        .from(nutritionFacts)
        .where(eq(nutritionFacts.productId, product.productId))
        .then(results => results[0] || null),
        
      // Get product photos
      rimiDb
        .select()
        .from(productPhotos)
        .where(eq(productPhotos.productId, product.productId)),
        
      // Get category
      rimiDb
        .select()
        .from(categories)
        .where(eq(categories.categoryId, product.categoryId))
        .then(results => results[0] || null),
        
      // Get ingredient card (Rimi products only in this method)
      this.fetchRimiIngredientCardsBySku([sku])
    ]);
    
    return {
      ...product,
      nutrition,
      photos,
      category,
      store: 'rimi' as Store,
      externalUrl: product.rimiUrl,
      ingredientCard: ingredientCardsMap.get(sku)
    };
  }

  async getProductByRimiUrl(rimiUrl: string): Promise<ProductWithDetails | undefined> {
    // First get the product
    const [product] = await rimiDb
      .select()
      .from(products)
      .where(eq(products.rimiUrl, rimiUrl));
      
    if (!product) return undefined;
    
    // Get all related data in parallel (including ingredient card)
    const [nutrition, photos, category, ingredientCardsMap] = await Promise.all([
      // Get nutrition facts
      rimiDb
        .select()
        .from(nutritionFacts)
        .where(eq(nutritionFacts.productId, product.productId))
        .then(results => results[0] || null),
        
      // Get product photos
      rimiDb
        .select()
        .from(productPhotos)
        .where(eq(productPhotos.productId, product.productId)),
        
      // Get category
      rimiDb
        .select()
        .from(categories)
        .where(eq(categories.categoryId, product.categoryId))
        .then(results => results[0] || null),
        
      // Get ingredient card (Rimi products only in this method)
      this.fetchRimiIngredientCardsBySku([product.sku])
    ]);
    
    return {
      ...product,
      nutrition,
      photos,
      category,
      store: 'rimi' as Store,
      externalUrl: product.rimiUrl,
      ingredientCard: ingredientCardsMap.get(product.sku)
    };
  }
  
  async searchProducts(query: string, options: GetProductsOptions): Promise<{ products: ProductWithDetails[], totalCount: number }> {
    const {
      page = 1,
      pageSize = 12,
      nutriScores,
      sugarMin,
      sugarMax,
      fatMin,
      fatMax,
      proteinMin,
      proteinMax,
      saltMin,
      saltMax,
      sortBy = 'name',
      sortOrder = 'asc',
      madeInLatvia
    } = options;
    
    console.log(`SEARCH products with query "${query}" and options`, JSON.stringify(options));
    
    try {
      // Step 1: Prepare search conditions
      const normalizedQuery = normalizeLvText(query);
      console.log(`Search query: "${query}" normalized to: "${normalizedQuery}"`);
      
      const searchPattern = `%${normalizedQuery}%`;
      const exactMatchPattern = `%${query}%`;
      
      // Step 2: Build nutritional filter conditions (same as getProducts)
      let nutritionConditions: any[] = [
        isNotNull(nutritionFacts.nutriScoreGrade),  // Only show products with Nutri-Score
        // Only show products that are currently available (latest price history record has is_available = true)
        sql`EXISTS (
          SELECT 1 FROM product_price_history pph 
          WHERE pph.product_id = ${products.productId}
          AND pph.is_available = true
          AND pph.recorded_at = (
            SELECT MAX(pph2.recorded_at) 
            FROM product_price_history pph2 
            WHERE pph2.product_id = pph.product_id
          )
        )`,
        // Exclude hidden categories
        sql`${products.categoryId} NOT IN (${sql.join(EXCLUDED_CATEGORY_IDS.map(id => sql`${id}`), sql`, `)})`
      ];
      
      if (nutriScores && nutriScores.length > 0) {
        nutritionConditions.push(inArray(nutritionFacts.nutriScoreGrade, nutriScores));
      }
      
      if (sugarMin !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.carbsSugars} >= ${sugarMin}`);
      }
      if (sugarMax !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.carbsSugars} <= ${sugarMax}`);
      }
      
      if (fatMin !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.fatTotal} >= ${fatMin}`);
      }
      if (fatMax !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.fatTotal} <= ${fatMax}`);
      }
      
      if (proteinMin !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.protein} >= ${proteinMin}`);
      }
      if (proteinMax !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.protein} <= ${proteinMax}`);
      }
      
      if (saltMin !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.salt} >= ${saltMin}`);
      }
      if (saltMax !== undefined) {
        nutritionConditions.push(sql`${nutritionFacts.salt} <= ${saltMax}`);
      }
      
      // Add madeInLatvia filter
      if (madeInLatvia) {
        nutritionConditions.push(sql`${products}.country_of_origin = 'Latvija'`);
      }
      
      // Step 3: Build search conditions
      const searchConditions = [
        or(
          // Original query (exact match, case insensitive)
          sql`${products.name} ILIKE ${exactMatchPattern}`,
          
          // Use the pre-normalized name_norm column for efficient matching
          sql`${products.name_norm} LIKE ${searchPattern}`
        )
      ];
      
      // Step 4: Build sorting conditions (same as getProducts)
      let orderByClause: any;
      
      if (sortBy === 'name') {
        orderByClause = sortOrder === 'asc' ? asc(products.name) : desc(products.name);
      } else if (sortBy === 'nutriScore') {
        orderByClause = sortOrder === 'asc' 
          ? sql`CASE WHEN ${nutritionFacts.nutriScoreGrade} IS NULL THEN 'Z' ELSE ${nutritionFacts.nutriScoreGrade} END ASC`
          : sql`CASE WHEN ${nutritionFacts.nutriScoreGrade} IS NULL THEN 'Z' ELSE ${nutritionFacts.nutriScoreGrade} END DESC`;
      } else if (sortBy === 'sugar') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.carbsSugars} ASC NULLS LAST`
          : sql`${nutritionFacts.carbsSugars} DESC NULLS LAST`;
      } else if (sortBy === 'fat') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.fatTotal} ASC NULLS LAST`
          : sql`${nutritionFacts.fatTotal} DESC NULLS LAST`;
      } else if (sortBy === 'protein') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.protein} ASC NULLS LAST`
          : sql`${nutritionFacts.protein} DESC NULLS LAST`;
      } else if (sortBy === 'salt') {
        orderByClause = sortOrder === 'asc' 
          ? sql`${nutritionFacts.salt} ASC NULLS LAST`
          : sql`${nutritionFacts.salt} DESC NULLS LAST`;
      } else {
        // Default to name sorting
        orderByClause = asc(products.name);
      }
      
      // Step 5: Prepare for merged search across both databases
      const offset = (page - 1) * pageSize;
      
      // Combine all WHERE conditions
      const whereConditions = [...searchConditions, ...nutritionConditions];
      
      // Step 6: Search all products from both databases, merge, sort, then paginate
      // For search, we need to fetch ALL results from both databases, merge, sort, then paginate
      // This is necessary because we can't correctly paginate across two separate databases
      
      // First, get ALL Rimi search results (without pagination)
      const allRimiQuery = await withRetry(async () => {
        let query = rimiDb
          .select({
            productId: products.productId,
            sku: products.sku,
            name: products.name,
            nameNorm: products.name_norm,
            categoryId: products.categoryId,
            rimiUrl: products.rimiUrl,
            quantityValue: products.quantityValue,
            quantityUnit: products.quantityUnit,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
            nutritionId: nutritionFacts.nutritionId,
            ingredientsText: nutritionFacts.ingredientsText,
            energyKcal: nutritionFacts.energyKcal,
            energyKj: nutritionFacts.energyKj,
            fatTotal: nutritionFacts.fatTotal,
            fatSaturated: nutritionFacts.fatSaturated,
            carbsTotal: nutritionFacts.carbsTotal,
            carbsSugars: nutritionFacts.carbsSugars,
            protein: nutritionFacts.protein,
            salt: nutritionFacts.salt,
            fiber: nutritionFacts.fiber,
            nutriScoreGrade: nutritionFacts.nutriScoreGrade,
            nutriScorePoints: nutritionFacts.nutriScorePoints,
            dataSourceDate: nutritionFacts.dataSourceDate
          })
          .from(products)
          .leftJoin(nutritionFacts, eq(products.productId, nutritionFacts.productId));
        
        if (whereConditions.length > 0) {
          query = query.where(and(...whereConditions)) as any;
        }
        
        return query;
      });
      
      // Fetch Rimi photos and categories
      const rimiProductIds = allRimiQuery.map(p => p.productId);
      let rimiPhotosMap: Record<number, ProductPhoto[]> = {};
      let rimiCategoryMap: Record<number, Category> = {};
      
      if (rimiProductIds.length > 0) {
        const [rimiPhotos, rimiCategories] = await Promise.all([
          rimiDb.select().from(productPhotos).where(inArray(productPhotos.productId, rimiProductIds)),
          rimiDb.select().from(categories).where(inArray(categories.categoryId, allRimiQuery.map(p => p.categoryId)))
        ]);
        
        rimiPhotosMap = rimiPhotos.reduce((map, photo) => {
          if (!map[photo.productId]) map[photo.productId] = [];
          map[photo.productId].push(photo);
          return map;
        }, {} as Record<number, ProductPhoto[]>);
        
        rimiCategoryMap = rimiCategories.reduce((map, c) => {
          map[c.categoryId] = c;
          return map;
        }, {} as Record<number, Category>);
      }
      
      // Convert Rimi results to ProductWithDetails
      let allProducts: ProductWithDetails[] = allRimiQuery.map(row => {
        const nutrition: NutritionFacts | undefined = row.nutritionId ? {
          nutritionId: row.nutritionId,
          productId: row.productId,
          ingredientsText: row.ingredientsText,
          energyKcal: row.energyKcal,
          energyKj: row.energyKj,
          fatTotal: row.fatTotal,
          fatSaturated: row.fatSaturated,
          carbsTotal: row.carbsTotal,
          carbsSugars: row.carbsSugars,
          protein: row.protein,
          salt: row.salt,
          fiber: row.fiber,
          nutriScoreGrade: row.nutriScoreGrade,
          nutriScorePoints: row.nutriScorePoints,
          dataSourceDate: row.dataSourceDate
        } : undefined;
        
        return {
          productId: row.productId,
          sku: row.sku,
          name: row.name,
          name_norm: row.nameNorm,
          categoryId: row.categoryId,
          rimiUrl: row.rimiUrl,
          quantityValue: row.quantityValue,
          quantityUnit: row.quantityUnit,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          nutrition,
          photos: rimiPhotosMap[row.productId] || [],
          category: rimiCategoryMap[row.categoryId],
          store: 'rimi' as Store,
          externalUrl: row.rimiUrl
        };
      });
      
      // Search Maxima products if available
      if (maximaDb) {
        try {
          // Build Maxima search conditions
          const maximaSearchConditions = [
            isNotNull(maximaProducts.rimiCategoryCode),
            or(
              sql`${maximaProducts.name} ILIKE ${exactMatchPattern}`,
              sql`${maximaProducts.name_norm} LIKE ${searchPattern}`
            ),
            sql`EXISTS (
              SELECT 1 FROM product_price_history pph 
              WHERE pph.product_id = ${maximaProducts.productId}
              AND pph.is_available = true
              AND pph.recorded_at = (
                SELECT MAX(pph2.recorded_at) 
                FROM product_price_history pph2 
                WHERE pph2.product_id = pph.product_id
              )
            )`
          ];
          
          const maximaNutritionConditions = [isNotNull(nutritionFacts.nutriScoreGrade)];
          if (nutriScores && nutriScores.length > 0) {
            maximaNutritionConditions.push(inArray(nutritionFacts.nutriScoreGrade, nutriScores));
          }
          
          // Get ALL Maxima search results (without pagination)
          const allMaximaQuery = await maximaDb
            .select({
              productId: maximaProducts.productId,
              sku: maximaProducts.sku,
              name: maximaProducts.name,
              nameNorm: maximaProducts.name_norm,
              categoryId: maximaProducts.rimiCategoryCode,
              barboraUrl: maximaProducts.barboraUrl,
              quantityValue: maximaProducts.quantityValue,
              quantityUnit: maximaProducts.quantityUnit,
              createdAt: maximaProducts.createdAt,
              updatedAt: maximaProducts.updatedAt,
              nutritionId: nutritionFacts.nutritionId,
              ingredientsText: nutritionFacts.ingredientsText,
              energyKcal: nutritionFacts.energyKcal,
              energyKj: nutritionFacts.energyKj,
              fatTotal: nutritionFacts.fatTotal,
              fatSaturated: nutritionFacts.fatSaturated,
              carbsTotal: nutritionFacts.carbsTotal,
              carbsSugars: nutritionFacts.carbsSugars,
              protein: nutritionFacts.protein,
              salt: nutritionFacts.salt,
              fiber: nutritionFacts.fiber,
              nutriScoreGrade: nutritionFacts.nutriScoreGrade,
              nutriScorePoints: nutritionFacts.nutriScorePoints,
              dataSourceDate: nutritionFacts.dataSourceDate
            })
            .from(maximaProducts)
            .innerJoin(nutritionFacts, eq(maximaProducts.productId, nutritionFacts.productId))
            .where(and(...maximaSearchConditions, ...maximaNutritionConditions));
          
          // Fetch Maxima photos and categories
          const maximaProductIds = allMaximaQuery.map(p => p.productId);
          let maximaPhotosMap: Record<number, ProductPhoto[]> = {};
          let maximaCategoryMap: Record<number, Category> = {};
          
          if (maximaProductIds.length > 0) {
            const maximaPhotos = await maximaDb.select().from(productPhotos).where(inArray(productPhotos.productId, maximaProductIds));
            maximaPhotosMap = maximaPhotos.reduce((map, photo) => {
              if (!map[photo.productId]) map[photo.productId] = [];
              map[photo.productId].push(photo);
              return map;
            }, {} as Record<number, ProductPhoto[]>);
            
            const categoryIds = allMaximaQuery.map(p => p.categoryId).filter(id => id !== null) as number[];
            if (categoryIds.length > 0) {
              const cats = await rimiDb.select().from(categories).where(inArray(categories.categoryId, categoryIds));
              maximaCategoryMap = cats.reduce((map, c) => { map[c.categoryId] = c; return map; }, {} as Record<number, Category>);
            }
          }
          
          // Convert Maxima results to ProductWithDetails
          const maximaProductsList: ProductWithDetails[] = allMaximaQuery.map(row => {
            const nutrition: NutritionFacts | undefined = row.nutritionId ? {
              nutritionId: row.nutritionId,
              productId: row.productId,
              ingredientsText: row.ingredientsText,
              energyKcal: row.energyKcal,
              energyKj: row.energyKj,
              fatTotal: row.fatTotal,
              fatSaturated: row.fatSaturated,
              carbsTotal: row.carbsTotal,
              carbsSugars: row.carbsSugars,
              protein: row.protein,
              salt: row.salt,
              fiber: row.fiber,
              nutriScoreGrade: row.nutriScoreGrade,
              nutriScorePoints: row.nutriScorePoints,
              dataSourceDate: row.dataSourceDate
            } : undefined;
            
            return {
              productId: row.productId,
              sku: row.sku,
              name: row.name,
              name_norm: row.nameNorm,
              categoryId: row.categoryId || 0,
              rimiUrl: null,
              quantityValue: row.quantityValue,
              quantityUnit: row.quantityUnit,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              nutrition,
              photos: maximaPhotosMap[row.productId] || [],
              category: row.categoryId ? maximaCategoryMap[row.categoryId] : undefined,
              store: 'maxima' as Store,
              externalUrl: row.barboraUrl
            };
          });
          
          // Merge all products
          allProducts = [...allProducts, ...maximaProductsList];
          console.log(`Added ${maximaProductsList.length} Maxima products to search results`);
        } catch (err) {
          console.error('Error searching Maxima products:', err);
        }
      }
      
      // Sort merged results based on sortBy parameter
      allProducts.sort((a, b) => {
        let comparison = 0;
        
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name, 'lv');
        } else if (sortBy === 'nutriScore') {
          const gradeA = a.nutrition?.nutriScoreGrade || 'Z';
          const gradeB = b.nutrition?.nutriScoreGrade || 'Z';
          comparison = gradeA.localeCompare(gradeB);
        } else if (sortBy === 'sugar') {
          const sugarA = a.nutrition?.carbsSugars == null ? 999 : Number(a.nutrition.carbsSugars);
          const sugarB = b.nutrition?.carbsSugars == null ? 999 : Number(b.nutrition.carbsSugars);
          comparison = sugarA - sugarB;
        } else if (sortBy === 'fat') {
          const fatA = a.nutrition?.fatTotal == null ? 999 : Number(a.nutrition.fatTotal);
          const fatB = b.nutrition?.fatTotal == null ? 999 : Number(b.nutrition.fatTotal);
          comparison = fatA - fatB;
        } else if (sortBy === 'protein') {
          const proteinA = a.nutrition?.protein == null ? -1 : Number(a.nutrition.protein);
          const proteinB = b.nutrition?.protein == null ? -1 : Number(b.nutrition.protein);
          comparison = proteinA - proteinB;
        } else if (sortBy === 'salt') {
          const saltA = a.nutrition?.salt == null ? 999 : Number(a.nutrition.salt);
          const saltB = b.nutrition?.salt == null ? 999 : Number(b.nutrition.salt);
          comparison = saltA - saltB;
        } else {
          comparison = a.name.localeCompare(b.name, 'lv');
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
      
      // Get total count from merged results
      const finalTotalCount = allProducts.length;
      
      // Apply pagination to merged and sorted results
      const paginatedProducts = allProducts.slice(offset, offset + pageSize);
      
      console.log(`Search merged ${allProducts.length} total products, returning page ${page} with ${paginatedProducts.length} items`);
      
      // Enrich paginated products with ingredient card data (both stores)
      const ingredientCardsMap = await this.fetchIngredientCardsForProducts(
        paginatedProducts.map(p => ({ sku: p.sku, store: p.store }))
      );
      
      // Attach ingredient cards to products
      const enrichedProducts = paginatedProducts.map(p => ({
        ...p,
        ingredientCard: ingredientCardsMap.get(p.sku)
      }));
      
      console.log(`SEARCH products with query "${query}" and options ${JSON.stringify(options)} returned ${enrichedProducts.length} products, total: ${finalTotalCount}`);
      
      return {
        products: enrichedProducts,
        totalCount: finalTotalCount
      };
      
    } catch (error) {
      console.error('Error in searchProducts:', error);
      return { products: [], totalCount: 0 };
    }
  }
  
  // Scan methods
  async createScan(scan: InsertScan): Promise<Scan> {
    const [createdScan] = await scansDb
      .insert(scans)
      .values(scan)
      .returning();
    return createdScan;
  }
  
  async getScanById(scanId: number): Promise<Scan | null> {
    const [scan] = await scansDb
      .select()
      .from(scans)
      .where(eq(scans.scanId, scanId));
    return scan || null;
  }
  
  async getScanByToken(token: string): Promise<Scan | null> {
    const [scan] = await scansDb
      .select()
      .from(scans)
      .where(eq(scans.photoAccessToken, token));
    return scan || null;
  }
  
  async cleanupOldScans(daysOld: number): Promise<number> {
    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Get old scans with photo URLs
    const oldScans = await scansDb
      .select({ photoUrl: scans.photoUrl })
      .from(scans)
      .where(sql`${scans.createdAt} < ${cutoffDate.toISOString()}`);
    
    // Delete photos from object storage
    if (oldScans.length > 0) {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      for (const scan of oldScans) {
        if (scan.photoUrl) {
          try {
            await objectStorageService.deleteImageByUrl(scan.photoUrl);
            console.log(`Deleted photo from storage: ${scan.photoUrl}`);
          } catch (err) {
            console.error(`Failed to delete photo ${scan.photoUrl}:`, err);
            // Continue with cleanup even if photo deletion fails
          }
        }
      }
    }
    
    // Delete from database
    await scansDb
      .delete(scans)
      .where(sql`${scans.createdAt} < ${cutoffDate.toISOString()}`);
    
    console.log(`Cleaned up ${oldScans.length} old scans from database and storage`);
    return oldScans.length;
  }
}

// Use DatabaseStorage for production
export const storage = new DatabaseStorage();
