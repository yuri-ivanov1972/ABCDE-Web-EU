import { 
  users, type User, type InsertUser,
  categories, products, maximaProducts, nutritionFacts, productPhotos, productPriceHistory, scans,
  type Category, type Product, type NutritionFacts, type ProductPhoto, type Scan, type InsertScan, type Store,
  type ProductIngredientCard, type IngredientItem
} from "@shared/schema";
import { rimiDb, maximaDb, scansDb, rimiPool, scansPool } from "./db";
import { eq, like, and, or, gte, lte, inArray, desc, asc, sql, isNotNull } from "drizzle-orm";
import { normalizeLvText, createSearchPattern } from "./utils/textNormalization";

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
  // Original template methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Category methods
  getCategories(level?: number): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  getCategoryByCode(code: string): Promise<Category | undefined>;
  getSubcategories(parentId: number): Promise<Category[]>;
  getCategoryPath(categoryId: number): Promise<Category[]>;
  
  // Product methods
  getProducts(options: GetProductsOptions): Promise<{ products: ProductWithDetails[], totalCount: number }>;
  getProductById(id: number): Promise<ProductWithDetails | undefined>;
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
  // Helper method to get category ID from Rimi category code (for Maxima products)
  private async getCategoryIdByRimiCode(rimiCategoryCode: number): Promise<number | null> {
    const [category] = await rimiDb
      .select({ categoryId: categories.categoryId })
      .from(categories)
      .where(eq(categories.categoryId, rimiCategoryCode));
    return category?.categoryId || null;
  }

  // Helper method to fetch ingredient cards for a batch of SKUs by joining tables
  private async fetchIngredientCardsBySku(skus: string[]): Promise<Map<string, ProductIngredientCard>> {
    if (skus.length === 0) {
      return new Map();
    }
    
    try {
      // Query ingredient_product_mapping joined with ingredient_analysis
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
      
      // Group ingredients by SKU and calculate counts
      const ingredientsBySku = new Map<string, IngredientItem[]>();
      
      for (const row of result.rows) {
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
      
      // Build ingredient cards map with counts
      const ingredientCardsMap = new Map<string, ProductIngredientCard>();
      
      for (const [sku, ingredients] of ingredientsBySku) {
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
          name: '', // Name would come from product table
          categoryId: 0, // Category would come from product table
          categoryName: null,
          ingredients,
          naturalCount,
          processedCount,
          avoidCount,
          limitCount,
          cautionCount
        });
      }
      
      return ingredientCardsMap;
    } catch (error) {
      console.error('Error fetching ingredient cards:', error);
      return new Map();
    }
  }

  // Original template methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await rimiDb.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await rimiDb.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await rimiDb
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Category methods
  async getCategories(level?: number): Promise<Category[]> {
    // We'll show all categories but mark which ones have products
    console.log("Getting categories...");
    
    // Prepare the query based on level
    let query = rimiDb
      .select()
      .from(categories);
    
    if (level !== undefined) {
      query = query.where(eq(categories.level, level)) as any;
    }
    
    // Execute the query with the order by clause
    if (level !== undefined) {
      return await query.orderBy(categories.nameEn);
    } else {
      return await query.orderBy(categories.level, categories.nameEn);
    }
  }
  
  async getCategoryById(id: number): Promise<Category | undefined> {
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
    // Return all subcategories
    return await rimiDb
      .select()
      .from(categories)
      .where(eq(categories.parentCategoryId, parentId))
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
    offset: number
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
      store
    } = options;
    
    console.log(`GET products with options`, JSON.stringify(options));
    
    try {
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
            
            // If level 1, go one level deeper
            if (currentCategory.level === 1) {
              for (const subcat of subcategories) {
                const subsubcategories = await rimiDb
                  .select()
                  .from(categories)
                  .where(eq(categories.parentCategoryId, subcat.categoryId));
                
                allCategoriesToInclude.push(...subsubcategories.map(c => c.categoryId));
              }
            }
          }
          
          console.log(`Including products from categories: ${allCategoriesToInclude.join(', ')}`);
        }
      }
      
      // Step 2: Build WHERE conditions for nutritional filters
      let whereConditions: any[] = [
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
        )`
      ];
      
      // Add category filter if specified
      if (allCategoriesToInclude.length > 0) {
        whereConditions.push(inArray(products.categoryId, allCategoriesToInclude));
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
            allCategoriesToInclude, nutriScores, hasNutrientFilters, sortBy, sortOrder, pageSize, offset
          );
          allProducts = maximaResult.products;
          finalTotalCount = maximaResult.count;
        } else {
          // Combined view: fetch enough products from Maxima to cover the current page
          // We need offset + pageSize products from each store to properly paginate
          const combinedLimit = offset + pageSize;
          
          const maximaResult = await this.getMaximaProducts(
            allCategoriesToInclude, nutriScores, hasNutrientFilters, sortBy, sortOrder, combinedLimit, 0
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
      
      // Step 9: Enrich products with ingredient card data (Rimi products only)
      const rimiSkus = allProducts
        .filter(p => p.store === 'rimi')
        .map(p => p.sku);
      
      const ingredientCardsMap = await this.fetchIngredientCardsBySku(rimiSkus);
      
      // Attach ingredient cards to products
      const enrichedProducts = allProducts.map(p => ({
        ...p,
        ingredientCard: ingredientCardsMap.get(p.sku)
      }));
      
      console.log(`GET products with options ${JSON.stringify(options)} returned ${enrichedProducts.length} products, total: ${finalTotalCount}`);
      
      return {
        products: enrichedProducts,
        totalCount: finalTotalCount
      };
      
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
        this.fetchIngredientCardsBySku([product.sku])
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
    
    // Get nutrition, photos from Maxima DB and category from Rimi DB
    const [nutrition, photos, category] = await Promise.all([
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
        : Promise.resolve(null)
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
      externalUrl: maximaProduct.barboraUrl
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
        
      // Get ingredient card
      this.fetchIngredientCardsBySku([sku])
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
        
      // Get ingredient card
      this.fetchIngredientCardsBySku([product.sku])
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
      sortOrder = 'asc'
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
        )`
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
      
      // Step 5: Execute main search query with JOIN, WHERE, ORDER BY, and pagination
      const offset = (page - 1) * pageSize;
      
      // Combine all WHERE conditions
      const whereConditions = [...searchConditions, ...nutritionConditions];
      
      // Main search query: LEFT JOIN with nutritionFacts, apply all filters, sorting, and pagination
      const searchQuery = await withRetry(async () => {
        console.log(`Executing main search query with ${whereConditions.length} conditions`);
        
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
          .limit(pageSize)
          .offset(offset);
      });
      
      console.log(`Search query returned ${searchQuery.length} products`);
      
      // Step 6: Get total count of filtered search results (not paginated)
      const totalCountQuery = await withRetry(async () => {
        console.log(`Executing search count query with ${whereConditions.length} conditions`);
        
        let countQuery = rimiDb
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .leftJoin(nutritionFacts, eq(products.productId, nutritionFacts.productId));
        
        if (whereConditions.length > 0) {
          countQuery = countQuery.where(and(...whereConditions)) as any;
        }
        
        return countQuery;
      });
      
      const totalCount = totalCountQuery[0]?.count || 0;
      console.log(`Total filtered search results count: ${totalCount}`);
      
      // Step 7: Fetch additional details (photos and categories) in batch
      const productIds = searchQuery.map(p => p.productId);
      
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
            .where(inArray(categories.categoryId, searchQuery.map(p => p.categoryId)))
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
      
      // Step 8: Construct final products with details
      const productsWithDetails: ProductWithDetails[] = searchQuery.map(row => {
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
          externalUrl: product.rimiUrl
        };
      });
      
      // Step 9: Also search Maxima products and merge results
      let allProducts = productsWithDetails;
      let finalTotalCount = Number(totalCount);
      
      if (maximaDb) {
        try {
          // Build Maxima search conditions
          const maximaSearchConditions = [
            isNotNull(maximaProducts.rimiCategoryCode),  // Only products with rimi_category_code
            or(
              sql`${maximaProducts.name} ILIKE ${exactMatchPattern}`,
              sql`${maximaProducts.name_norm} LIKE ${searchPattern}`
            ),
            // Only show products that are currently available
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
          
          // Add Nutri-Score filter for Maxima
          const maximaNutritionConditions = [isNotNull(nutritionFacts.nutriScoreGrade)];
          if (nutriScores && nutriScores.length > 0) {
            maximaNutritionConditions.push(inArray(nutritionFacts.nutriScoreGrade, nutriScores));
          }
          
          // Query Maxima products with INNER JOIN to only get products with Nutri-Score
          const maximaSearchQuery = await maximaDb
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
              nutriScoreGrade: nutritionFacts.nutriScoreGrade,
            })
            .from(maximaProducts)
            .innerJoin(nutritionFacts, eq(maximaProducts.productId, nutritionFacts.productId))
            .where(and(...maximaSearchConditions, ...maximaNutritionConditions))
            .orderBy(sortBy === 'name' 
              ? (sortOrder === 'asc' ? asc(maximaProducts.name) : desc(maximaProducts.name))
              : (sortOrder === 'asc' ? asc(nutritionFacts.nutriScoreGrade) : desc(nutritionFacts.nutriScoreGrade)))
            .limit(pageSize)
            .offset(offset);
          
          // Get Maxima count
          const maximaCountQuery = await maximaDb
            .select({ count: sql<number>`count(*)` })
            .from(maximaProducts)
            .innerJoin(nutritionFacts, eq(maximaProducts.productId, nutritionFacts.productId))
            .where(and(...maximaSearchConditions, ...maximaNutritionConditions));
          
          const maximaCount = Number(maximaCountQuery[0]?.count) || 0;
          
          // Get nutrition and photos for Maxima products
          const maximaProductIds = maximaSearchQuery.map(p => p.productId);
          let maximaPhotosMap: Record<number, ProductPhoto[]> = {};
          let maximaNutritionMap: Record<number, NutritionFacts> = {};
          let maximaCategoryMap: Record<number, Category> = {};
          
          if (maximaProductIds.length > 0) {
            const [maximaPhotos, maximaNutrition] = await Promise.all([
              maximaDb.select().from(productPhotos).where(inArray(productPhotos.productId, maximaProductIds)),
              maximaDb.select().from(nutritionFacts).where(inArray(nutritionFacts.productId, maximaProductIds))
            ]);
            
            maximaPhotosMap = maximaPhotos.reduce((map, photo) => {
              if (!map[photo.productId]) map[photo.productId] = [];
              map[photo.productId].push(photo);
              return map;
            }, {} as Record<number, ProductPhoto[]>);
            
            maximaNutritionMap = maximaNutrition.reduce((map, n) => {
              map[n.productId] = n;
              return map;
            }, {} as Record<number, NutritionFacts>);
            
            // Get categories from Rimi DB
            const categoryIds = maximaSearchQuery.map(p => p.categoryId).filter(id => id !== null) as number[];
            if (categoryIds.length > 0) {
              const cats = await rimiDb.select().from(categories).where(inArray(categories.categoryId, categoryIds));
              maximaCategoryMap = cats.reduce((map, c) => { map[c.categoryId] = c; return map; }, {} as Record<number, Category>);
            }
          }
          
          // Convert Maxima products to ProductWithDetails
          const maximaProducts_: ProductWithDetails[] = maximaSearchQuery.map(row => ({
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
            nutrition: maximaNutritionMap[row.productId],
            photos: maximaPhotosMap[row.productId] || [],
            category: row.categoryId ? maximaCategoryMap[row.categoryId] : undefined,
            store: 'maxima' as Store,
            externalUrl: row.barboraUrl
          }));
          
          // Merge results
          allProducts = [...productsWithDetails, ...maximaProducts_];
          finalTotalCount = Number(totalCount) + maximaCount;
          
          // Sort merged results by name
          allProducts.sort((a, b) => {
            let comparison = a.name.localeCompare(b.name, 'lv');
            return sortOrder === 'desc' ? -comparison : comparison;
          });
          
          // Limit to pageSize
          allProducts = allProducts.slice(0, pageSize);
          
          console.log(`Added ${maximaProducts_.length} Maxima products to search results`);
        } catch (err) {
          console.error('Error searching Maxima products:', err);
        }
      }
      
      // Enrich products with ingredient card data (Rimi products only)
      const rimiSkus = allProducts
        .filter(p => p.store === 'rimi')
        .map(p => p.sku);
      
      const ingredientCardsMap = await this.fetchIngredientCardsBySku(rimiSkus);
      
      // Attach ingredient cards to products
      const enrichedProducts = allProducts.map(p => ({
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

// Create memory storage for fallback if needed
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Stub methods for categories and products
  async getCategories(): Promise<Category[]> {
    return [];
  }
  
  async getCategoryById(): Promise<Category | undefined> {
    return undefined;
  }
  
  async getCategoryByCode(): Promise<Category | undefined> {
    return undefined;
  }
  
  async getSubcategories(): Promise<Category[]> {
    return [];
  }
  
  async getCategoryPath(): Promise<Category[]> {
    return [];
  }
  
  async getProducts(): Promise<{ products: ProductWithDetails[], totalCount: number }> {
    return { products: [], totalCount: 0 };
  }
  
  async getProductById(): Promise<ProductWithDetails | undefined> {
    return undefined;
  }
  
  async getProductBySku(): Promise<ProductWithDetails | undefined> {
    return undefined;
  }
  
  async getProductByRimiUrl(): Promise<ProductWithDetails | undefined> {
    return undefined;
  }
  
  async searchProducts(): Promise<{ products: ProductWithDetails[], totalCount: number }> {
    return { products: [], totalCount: 0 };
  }
  
  async createScan(): Promise<Scan> {
    throw new Error("Not implemented");
  }
  
  async getScanById(): Promise<Scan | null> {
    return null;
  }
  
  async getScanByToken(token: string): Promise<Scan | null> {
    return null;
  }
  
  async cleanupOldScans(): Promise<number> {
    return 0;
  }
}

// Use DatabaseStorage for production
export const storage = new DatabaseStorage();
