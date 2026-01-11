import { pgTable, text, serial, integer, boolean, varchar, decimal, timestamp, unique, foreignKey, primaryKey, char } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Original users table - keeping it as required by the template
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Categories table schema
export const categories = pgTable("normalized_categories", {
  categoryId: serial("category_id").primaryKey(),
  rimiCategoryCode: varchar("rimi_category_code", { length: 20 }).notNull().unique(),
  nameLv: text("name_lv").notNull(),
  nameEn: text("name_en").notNull(),
  parentCategoryId: integer("parent_category_id"),
  level: integer("level").notNull(),
});

// Products table schema (Rimi)
export const products = pgTable("products", {
  productId: serial("product_id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  name_norm: text("name_norm"),  // Normalized name for case-insensitive search
  rimiUrl: text("rimi_url").unique(),
  categoryId: integer("category_id").notNull(),
  quantityValue: decimal("quantity_value", { precision: 10, scale: 2 }),
  quantityUnit: varchar("quantity_unit", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// Maxima products table schema (different column names)
export const maximaProducts = pgTable("products", {
  productId: serial("product_id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  name_norm: text("name_norm"),
  barboraUrl: text("barbora_url"),  // Different column name in Maxima DB
  categoryId: integer("category_id").notNull(),
  rimiCategoryCode: integer("rimi_category_code"),  // Maps to Rimi categories
  quantityValue: decimal("quantity_value", { precision: 10, scale: 2 }),
  quantityUnit: varchar("quantity_unit", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// Nutrition facts table schema
export const nutritionFacts = pgTable("nutritionfacts", {
  nutritionId: serial("nutrition_id").primaryKey(),
  productId: integer("product_id").notNull().unique(),
  ingredientsText: text("ingredients_text"),
  energyKcal: integer("energy_kcal"),
  energyKj: integer("energy_kj"),
  fatTotal: decimal("fat_total", { precision: 10, scale: 2 }),
  fatSaturated: decimal("fat_saturated", { precision: 10, scale: 2 }),
  carbsTotal: decimal("carbs_total", { precision: 10, scale: 2 }),
  carbsSugars: decimal("carbs_sugars", { precision: 10, scale: 2 }),
  protein: decimal("protein", { precision: 10, scale: 2 }),
  salt: decimal("salt", { precision: 10, scale: 2 }),
  fiber: decimal("fiber", { precision: 10, scale: 2 }),
  nutriScoreGrade: char("nutri_score_grade", { length: 1 }),
  nutriScorePoints: integer("nutri_score_points"),
  dataSourceDate: timestamp("data_source_date", { withTimezone: true }),
});

// Product photos table schema
export const productPhotos = pgTable("productphotos", {
  photoId: serial("photo_id").primaryKey(),
  productId: integer("product_id").notNull(),
  photoUrl: text("photo_url").notNull(),
  altText: text("alt_text"),
  isPrimary: boolean("is_primary").default(false),
});

// Product price history table schema (for availability tracking)
export const productPriceHistory = pgTable("product_price_history", {
  priceHistoryId: serial("price_history_id").primaryKey(),
  productId: integer("product_id").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  isAvailable: boolean("is_available").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  dataSource: varchar("data_source", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }),
  pricePerUnitType: varchar("price_per_unit_type", { length: 20 }),
  discountPrice: decimal("discount_price", { precision: 10, scale: 2 }),
  discountPricePerUnit: decimal("discount_price_per_unit", { precision: 10, scale: 2 }),
});

// Scans table schema - stores scan photos and metadata for debugging
export const scans = pgTable("scans", {
  scanId: serial("scan_id").primaryKey(),
  photoAccessToken: varchar("photo_access_token", { length: 36 }).notNull().unique().$defaultFn(() => crypto.randomUUID()),
  photoUrl: text("photo_url"), // Nullable - only saved if object storage is configured
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // OCR data
  ocrText: text("ocr_text"), // Detected text segments
  // Matched product info (if successful)
  productId: integer("product_id"), // Reference to matched product
  matchConfidence: decimal("match_confidence", { precision: 5, scale: 2 }), // 0-100
  // Scan result
  success: boolean("success").notNull(), // Whether product was matched
  // Language context
  language: varchar("language", { length: 10 }), // lv or en
});

// Define relations between tables
export const productRelations = {
  category: {
    relationship: () => ({
      foreignKey: products.categoryId,
      referencedKey: categories.categoryId,
    }),
  },
  nutritionFacts: {
    relationship: () => ({
      foreignKey: nutritionFacts.productId,
      referencedKey: products.productId,
    }),
  },
  photos: {
    relationship: () => ({
      foreignKey: productPhotos.productId,
      referencedKey: products.productId,
    }),
  },
};

export const categoryRelations = {
  parentCategory: {
    relationship: () => ({
      foreignKey: categories.parentCategoryId,
      referencedKey: categories.categoryId,
    }),
  },
  childCategories: {
    relationship: () => ({
      foreignKey: categories.parentCategoryId,
      referencedKey: categories.categoryId,
    }),
  },
};

// Create insert schemas
export const insertCategorySchema = createInsertSchema(categories);
export const insertProductSchema = createInsertSchema(products);
export const insertNutritionFactsSchema = createInsertSchema(nutritionFacts);
export const insertProductPhotoSchema = createInsertSchema(productPhotos);
export const insertScanSchema = createInsertSchema(scans).omit({
  scanId: true,
  photoAccessToken: true,
  createdAt: true,
});

// Export types
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type NutritionFacts = typeof nutritionFacts.$inferSelect;
export type InsertNutritionFacts = z.infer<typeof insertNutritionFactsSchema>;

export type ProductPhoto = typeof productPhotos.$inferSelect;
export type InsertProductPhoto = z.infer<typeof insertProductPhotoSchema>;

export type Scan = typeof scans.$inferSelect;
export type InsertScan = z.infer<typeof insertScanSchema>;

// Store type for multi-store support
export type Store = 'rimi' | 'maxima';

// Maxima product type
export type MaximaProduct = typeof maximaProducts.$inferSelect;

// Ingredient analysis types for product cards
export type IngredientItem = {
  id: number;
  name: string;
  category: 'natural' | 'processed' | 'uncategorized';
  is_processed: boolean | null;
  suspicion_level: 'avoid' | 'limit' | 'caution' | 'clean' | null;
  suspicion_category: string | null;
  health_note: string | null;
};

export type ProductIngredientCard = {
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
};

// Combined Product type with relations for frontend use
export type ProductWithDetails = Product & {
  nutrition?: NutritionFacts;
  photos?: ProductPhoto[];
  category?: Category;
  store?: Store;
  externalUrl?: string | null;  // rimiUrl or barboraUrl depending on store
  ingredientCard?: ProductIngredientCard;  // Ingredient analysis data
};
