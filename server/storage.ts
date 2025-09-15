import { 
  users, type User, type InsertUser,
  categories, products, nutritionFacts, productPhotos,
  type Category, type Product, type NutritionFacts, type ProductPhoto
} from "@shared/schema";
import { categoriesDb, productsDb, categoriesPool, productsPool } from "./db";
import { eq, like, and, or, gte, lte, inArray, desc, asc, sql } from "drizzle-orm";
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
};

// Combined product type with related data
export type ProductWithDetails = Product & {
  nutrition?: NutritionFacts;
  photos?: ProductPhoto[];
  category?: Category;
};

export class DatabaseStorage implements IStorage {
  // Original template methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await categoriesDb.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await categoriesDb.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await categoriesDb
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
    let query = categoriesDb
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
    const [category] = await categoriesDb
      .select()
      .from(categories)
      .where(eq(categories.categoryId, id));
    return category;
  }
  
  async getCategoryByCode(code: string): Promise<Category | undefined> {
    const [category] = await categoriesDb
      .select()
      .from(categories)
      .where(eq(categories.rimiCategoryCode, code));
    return category;
  }
  
  async getSubcategories(parentId: number): Promise<Category[]> {
    // Return all subcategories
    return await categoriesDb
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
      const [currentCategory] = await categoriesDb
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
        const [parentCategory] = await categoriesDb
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
      sortOrder = 'asc'
    } = options;
    
    console.log(`GET products with options`, JSON.stringify(options));
    
    try {
      // Step 1: Build category list to include (keep this logic as it's necessary for hierarchical categories)
      let allCategoriesToInclude: number[] = [];
      
      if (categoryId) {
        // Get the current category to determine its level
        const [currentCategory] = await categoriesDb
          .select()
          .from(categories)
          .where(eq(categories.categoryId, categoryId));
        
        if (currentCategory) {
          console.log(`Current category: ${currentCategory.nameLv} (ID: ${currentCategory.categoryId}, Level: ${currentCategory.level})`);
          
          allCategoriesToInclude = [categoryId];
          
          // If this is level 1 or 2, include subcategories
          if (currentCategory.level < 3) {
            const subcategories = await categoriesDb
              .select()
              .from(categories)
              .where(eq(categories.parentCategoryId, categoryId));
            
            allCategoriesToInclude.push(...subcategories.map(c => c.categoryId));
            
            // If level 1, go one level deeper
            if (currentCategory.level === 1) {
              for (const subcat of subcategories) {
                const subsubcategories = await categoriesDb
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
      let whereConditions: any[] = [];
      
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
      
      const mainQuery = await withRetry(async () => {
        console.log(`Executing main query with ${whereConditions.length} WHERE conditions`);
        
        let query = productsDb
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
      
      console.log(`Main query returned ${mainQuery.length} products`);
      
      // Step 5: Get total count of filtered results (not paginated)
      const totalCountQuery = await withRetry(async () => {
        console.log(`Executing count query with ${whereConditions.length} WHERE conditions`);
        
        let countQuery = productsDb
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .leftJoin(nutritionFacts, eq(products.productId, nutritionFacts.productId));
        
        if (whereConditions.length > 0) {
          countQuery = countQuery.where(and(...whereConditions)) as any;
        }
        
        return countQuery;
      });
      
      const totalCount = totalCountQuery[0]?.count || 0;
      console.log(`Total filtered results count: ${totalCount}`);
      
      // Step 6: Fetch additional details (photos and categories) in batch
      const productIds = mainQuery.map(p => p.productId);
      
      let photosMap: Record<number, ProductPhoto[]> = {};
      let categoryMap: Record<number, Category> = {};
      
      if (productIds.length > 0) {
        // Fetch photos and categories in parallel
        const [allPhotos, allCategories] = await Promise.all([
          productsDb
            .select()
            .from(productPhotos)
            .where(inArray(productPhotos.productId, productIds)),
            
          categoriesDb
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
      
      // Step 7: Construct final products with details
      const productsWithDetails: ProductWithDetails[] = mainQuery.map(row => {
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
          category: categoryMap[product.categoryId]
        };
      });
      
      console.log(`GET products with options ${JSON.stringify(options)} returned ${productsWithDetails.length} products, total: ${totalCount}`);
      
      return {
        products: productsWithDetails,
        totalCount
      };
      
    } catch (error) {
      console.error('Error in getProducts:', error);
      return { products: [], totalCount: 0 };
    }
  }
  
  async getProductById(id: number): Promise<ProductWithDetails | undefined> {
    // First get the product
    const [product] = await productsDb
      .select()
      .from(products)
      .where(eq(products.productId, id));
      
    if (!product) return undefined;
    
    // Get all related data in parallel
    const [nutrition, photos, category] = await Promise.all([
      // Get nutrition facts
      productsDb
        .select()
        .from(nutritionFacts)
        .where(eq(nutritionFacts.productId, product.productId))
        .then(results => results[0] || null),
        
      // Get product photos
      productsDb
        .select()
        .from(productPhotos)
        .where(eq(productPhotos.productId, product.productId)),
        
      // Get category
      categoriesDb
        .select()
        .from(categories)
        .where(eq(categories.categoryId, product.categoryId))
        .then(results => results[0] || null)
    ]);
    
    return {
      ...product,
      nutrition,
      photos,
      category
    };
  }
  
  async getProductBySku(sku: string): Promise<ProductWithDetails | undefined> {
    // First get the product
    const [product] = await productsDb
      .select()
      .from(products)
      .where(eq(products.sku, sku));
      
    if (!product) return undefined;
    
    // Get all related data in parallel
    const [nutrition, photos, category] = await Promise.all([
      // Get nutrition facts
      productsDb
        .select()
        .from(nutritionFacts)
        .where(eq(nutritionFacts.productId, product.productId))
        .then(results => results[0] || null),
        
      // Get product photos
      productsDb
        .select()
        .from(productPhotos)
        .where(eq(productPhotos.productId, product.productId)),
        
      // Get category
      categoriesDb
        .select()
        .from(categories)
        .where(eq(categories.categoryId, product.categoryId))
        .then(results => results[0] || null)
    ]);
    
    return {
      ...product,
      nutrition,
      photos,
      category
    };
  }

  async getProductByRimiUrl(rimiUrl: string): Promise<ProductWithDetails | undefined> {
    // First get the product
    const [product] = await productsDb
      .select()
      .from(products)
      .where(eq(products.rimiUrl, rimiUrl));
      
    if (!product) return undefined;
    
    // Get all related data in parallel
    const [nutrition, photos, category] = await Promise.all([
      // Get nutrition facts
      productsDb
        .select()
        .from(nutritionFacts)
        .where(eq(nutritionFacts.productId, product.productId))
        .then(results => results[0] || null),
        
      // Get product photos
      productsDb
        .select()
        .from(productPhotos)
        .where(eq(productPhotos.productId, product.productId)),
        
      // Get category
      categoriesDb
        .select()
        .from(categories)
        .where(eq(categories.categoryId, product.categoryId))
        .then(results => results[0] || null)
    ]);
    
    return {
      ...product,
      nutrition,
      photos,
      category
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
      let nutritionConditions: any[] = [];
      
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
        
        let query = productsDb
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
        
        let countQuery = productsDb
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
          productsDb
            .select()
            .from(productPhotos)
            .where(inArray(productPhotos.productId, productIds)),
            
          categoriesDb
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
          category: categoryMap[product.categoryId]
        };
      });
      
      console.log(`SEARCH products with query "${query}" and options ${JSON.stringify(options)} returned ${productsWithDetails.length} products, total: ${totalCount}`);
      
      return {
        products: productsWithDetails,
        totalCount
      };
      
    } catch (error) {
      console.error('Error in searchProducts:', error);
      return { products: [], totalCount: 0 };
    }
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
}

// Use DatabaseStorage for production
export const storage = new DatabaseStorage();
