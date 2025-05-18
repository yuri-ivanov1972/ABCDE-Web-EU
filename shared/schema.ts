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

// Products table schema
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

// Export types
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type NutritionFacts = typeof nutritionFacts.$inferSelect;
export type InsertNutritionFacts = z.infer<typeof insertNutritionFactsSchema>;

export type ProductPhoto = typeof productPhotos.$inferSelect;
export type InsertProductPhoto = z.infer<typeof insertProductPhotoSchema>;

// Combined Product type with relations for frontend use
export type ProductWithDetails = Product & {
  nutrition?: NutritionFacts;
  photos?: ProductPhoto[];
  category?: Category;
};
