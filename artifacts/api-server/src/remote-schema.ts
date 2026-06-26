import { pgTable, text, serial, integer, boolean, varchar, decimal, timestamp, char } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categories = pgTable("normalized_categories", {
  categoryId: serial("category_id").primaryKey(),
  rimiCategoryCode: varchar("rimi_category_code", { length: 20 }).notNull().unique(),
  nameLv: text("name_lv").notNull(),
  nameEn: text("name_en").notNull(),
  parentCategoryId: integer("parent_category_id"),
  level: integer("level").notNull(),
});

export const insertCategorySchema = createInsertSchema(categories);
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export const products = pgTable("products", {
  productId: serial("product_id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  name_norm: text("name_norm"),
  rimiUrl: text("rimi_url").unique(),
  categoryId: integer("category_id").notNull(),
  quantityValue: decimal("quantity_value", { precision: 10, scale: 2 }),
  quantityUnit: varchar("quantity_unit", { length: 50 }),
  novaScore: integer("nova_score"),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const insertProductSchema = createInsertSchema(products);
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export const maximaProducts = pgTable("products", {
  productId: serial("product_id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  name_norm: text("name_norm"),
  barboraUrl: text("barbora_url"),
  categoryId: integer("category_id").notNull(),
  rimiCategoryCode: integer("rimi_category_code"),
  quantityValue: decimal("quantity_value", { precision: 10, scale: 2 }),
  quantityUnit: varchar("quantity_unit", { length: 50 }),
  novaScore: integer("nova_score"),
  countryOfOrigin: varchar("country_of_origin", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export type MaximaProduct = typeof maximaProducts.$inferSelect;

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

export const insertNutritionFactsSchema = createInsertSchema(nutritionFacts);
export type NutritionFacts = typeof nutritionFacts.$inferSelect;
export type InsertNutritionFacts = z.infer<typeof insertNutritionFactsSchema>;

export const productPhotos = pgTable("productphotos", {
  photoId: serial("photo_id").primaryKey(),
  productId: integer("product_id").notNull(),
  photoUrl: text("photo_url").notNull(),
  altText: text("alt_text"),
  isPrimary: boolean("is_primary").default(false),
});

export const insertProductPhotoSchema = createInsertSchema(productPhotos);
export type ProductPhoto = typeof productPhotos.$inferSelect;
export type InsertProductPhoto = z.infer<typeof insertProductPhotoSchema>;

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
