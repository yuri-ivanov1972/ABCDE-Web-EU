import { 
  users, type User, type InsertUser,
  categories, products, nutritionFacts, productPhotos,
  type Category, type Product, type NutritionFacts, type ProductPhoto
} from "@shared/schema";
import { categoriesDb, productsDb } from "./db";
import { eq, like, and, or, gte, lte, inArray, desc, asc, sql } from "drizzle-orm";

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
      query = query.where(eq(categories.level, level));
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
    
    // Build where conditions
    const whereConditions = [];
    
    if (categoryId) {
      try {
        // Get all subcategories of this category to include their products too
        const allCategoriesToInclude = [categoryId];
        
        // Find all subcategories (level 2)
        const subcategories = await categoriesDb
          .select()
          .from(categories)
          .where(eq(categories.parentCategoryId, categoryId));
        
        // Add subcategory IDs
        allCategoriesToInclude.push(...subcategories.map(c => c.categoryId));
        
        // For each subcategory, find their children (level 3)
        for (const subcat of subcategories) {
          const subsubcategories = await categoriesDb
            .select()
            .from(categories)
            .where(eq(categories.parentCategoryId, subcat.categoryId));
          
          // Add sub-subcategory IDs
          allCategoriesToInclude.push(...subsubcategories.map(c => c.categoryId));
        }
        
        // Use the IN operator to match any category in our list
        whereConditions.push(inArray(products.categoryId, allCategoriesToInclude));
        console.log(`Including products from categories: ${allCategoriesToInclude.join(', ')}`);
      } catch (error) {
        console.error("Error getting subcategories:", error);
        // Fallback to just the current category
        whereConditions.push(eq(products.categoryId, categoryId));
      }
    }
    
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Execute query to get products
    let productsQuery = productsDb
      .select()
      .from(products)
      .limit(pageSize)
      .offset(offset);
      
    if (whereConditions.length > 0) {
      productsQuery = productsQuery.where(and(...whereConditions));
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      productsQuery = productsQuery.orderBy(sortOrder === 'asc' ? asc(products.name) : desc(products.name));
    }
    
    const productsResult = await productsQuery;
    
    // Get total count for pagination
    const [countResult] = await productsDb
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...whereConditions));
    
    const totalCount = countResult?.count || 0;
    
    // Fetch additional details for each product
    const productsWithDetails: ProductWithDetails[] = await Promise.all(
      productsResult.map(async (product) => {
        // Get nutrition facts
        const [nutrition] = await productsDb
          .select()
          .from(nutritionFacts)
          .where(eq(nutritionFacts.productId, product.productId));
        
        // Apply nutrition filters if present
        if (
          (nutriScores && nutrition?.nutriScoreGrade && !nutriScores.includes(nutrition.nutriScoreGrade as NutriScoreGrade)) ||
          (sugarMin !== undefined && (nutrition?.carbsSugars === null || Number(nutrition.carbsSugars) < sugarMin)) ||
          (sugarMax !== undefined && (nutrition?.carbsSugars === null || Number(nutrition.carbsSugars) > sugarMax)) ||
          (fatMin !== undefined && (nutrition?.fatTotal === null || Number(nutrition.fatTotal) < fatMin)) ||
          (fatMax !== undefined && (nutrition?.fatTotal === null || Number(nutrition.fatTotal) > fatMax)) ||
          (proteinMin !== undefined && (nutrition?.protein === null || Number(nutrition.protein) < proteinMin)) ||
          (proteinMax !== undefined && (nutrition?.protein === null || Number(nutrition.protein) > proteinMax)) ||
          (saltMin !== undefined && (nutrition?.salt === null || Number(nutrition.salt) < saltMin)) ||
          (saltMax !== undefined && (nutrition?.salt === null || Number(nutrition.salt) > saltMax))
        ) {
          return null;
        }
        
        // Get product photos
        const photos = await productsDb
          .select()
          .from(productPhotos)
          .where(eq(productPhotos.productId, product.productId));
          
        // Get category
        const [category] = await categoriesDb
          .select()
          .from(categories)
          .where(eq(categories.categoryId, product.categoryId));
        
        return {
          ...product,
          nutrition,
          photos,
          category
        };
      })
    );
    
    // Filter out null products (those that didn't match nutrition filters)
    const filteredProducts = productsWithDetails.filter(Boolean) as ProductWithDetails[];
    
    // Apply nutrition-based sorting if requested
    if (sortBy === 'nutriScore' && filteredProducts.some(p => p.nutrition?.nutriScoreGrade)) {
      const nutriScoreOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
      filteredProducts.sort((a, b) => {
        const scoreA = a.nutrition?.nutriScoreGrade ? nutriScoreOrder[a.nutrition.nutriScoreGrade as keyof typeof nutriScoreOrder] : 999;
        const scoreB = b.nutrition?.nutriScoreGrade ? nutriScoreOrder[b.nutrition.nutriScoreGrade as keyof typeof nutriScoreOrder] : 999;
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      });
    } else if (['sugar', 'fat', 'protein', 'salt'].includes(sortBy) && filteredProducts.length > 0) {
      const nutritionFieldMap = {
        'sugar': 'carbsSugars',
        'fat': 'fatTotal',
        'protein': 'protein',
        'salt': 'salt'
      };
      
      const field = nutritionFieldMap[sortBy as keyof typeof nutritionFieldMap];
      
      filteredProducts.sort((a, b) => {
        const valueA = a.nutrition?.[field as keyof NutritionFacts] as number | null | undefined || 0;
        const valueB = b.nutrition?.[field as keyof NutritionFacts] as number | null | undefined || 0;
        return sortOrder === 'asc' ? Number(valueA) - Number(valueB) : Number(valueB) - Number(valueA);
      });
    }
    
    return { 
      products: filteredProducts,
      totalCount: filteredProducts.length // We need to adjust total count after filtering
    };
  }
  
  async getProductById(id: number): Promise<ProductWithDetails | undefined> {
    const [product] = await productsDb
      .select()
      .from(products)
      .where(eq(products.productId, id));
      
    if (!product) return undefined;
    
    // Get nutrition facts
    const [nutrition] = await productsDb
      .select()
      .from(nutritionFacts)
      .where(eq(nutritionFacts.productId, product.productId));
      
    // Get product photos
    const photos = await productsDb
      .select()
      .from(productPhotos)
      .where(eq(productPhotos.productId, product.productId));
      
    // Get category
    const [category] = await categoriesDb
      .select()
      .from(categories)
      .where(eq(categories.categoryId, product.categoryId));
    
    return {
      ...product,
      nutrition,
      photos,
      category
    };
  }
  
  async getProductBySku(sku: string): Promise<ProductWithDetails | undefined> {
    const [product] = await productsDb
      .select()
      .from(products)
      .where(eq(products.sku, sku));
      
    if (!product) return undefined;
    
    // Get nutrition facts
    const [nutrition] = await productsDb
      .select()
      .from(nutritionFacts)
      .where(eq(nutritionFacts.productId, product.productId));
      
    // Get product photos
    const photos = await productsDb
      .select()
      .from(productPhotos)
      .where(eq(productPhotos.productId, product.productId));
      
    // Get category
    const [category] = await categoriesDb
      .select()
      .from(categories)
      .where(eq(categories.categoryId, product.categoryId));
    
    return {
      ...product,
      nutrition,
      photos,
      category
    };
  }
  
  async searchProducts(query: string, options: GetProductsOptions): Promise<{ products: ProductWithDetails[], totalCount: number }> {
    const { page = 1, pageSize = 12 } = options;
    
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Execute query to search products by name
    const productsResult = await productsDb
      .select()
      .from(products)
      .where(like(products.name, `%${query}%`))
      .limit(pageSize)
      .offset(offset);
    
    // Get total count for pagination
    const [countResult] = await productsDb
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(like(products.name, `%${query}%`));
    
    const totalCount = countResult?.count || 0;
    
    // Fetch additional details for each product
    const productsWithDetails: ProductWithDetails[] = await Promise.all(
      productsResult.map(async (product) => {
        // Get nutrition facts
        const [nutrition] = await productsDb
          .select()
          .from(nutritionFacts)
          .where(eq(nutritionFacts.productId, product.productId));
        
        // Get product photos
        const photos = await productsDb
          .select()
          .from(productPhotos)
          .where(eq(productPhotos.productId, product.productId));
          
        // Get category
        const [category] = await categoriesDb
          .select()
          .from(categories)
          .where(eq(categories.categoryId, product.categoryId));
        
        return {
          ...product,
          nutrition,
          photos,
          category
        };
      })
    );
    
    return { products: productsWithDetails, totalCount };
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
  
  async searchProducts(): Promise<{ products: ProductWithDetails[], totalCount: number }> {
    return { products: [], totalCount: 0 };
  }
}

// Use DatabaseStorage for production
export const storage = new DatabaseStorage();
