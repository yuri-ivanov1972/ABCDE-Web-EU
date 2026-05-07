import { pgTable, text, serial, integer, boolean, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type {
  User, InsertUser,
  Category, InsertCategory,
  Product, InsertProduct,
  MaximaProduct,
  NutritionFacts, InsertNutritionFacts,
  ProductPhoto, InsertProductPhoto,
} from "../server/remote-schema";

export const scans = pgTable("scans", {
  scanId: serial("scan_id").primaryKey(),
  photoAccessToken: varchar("photo_access_token", { length: 36 }).notNull().unique().$defaultFn(() => crypto.randomUUID()),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  ocrText: text("ocr_text"),
  productId: integer("product_id"),
  matchConfidence: decimal("match_confidence", { precision: 5, scale: 2 }),
  success: boolean("success").notNull(),
  language: varchar("language", { length: 10 }),
});

export const insertScanSchema = createInsertSchema(scans).omit({
  scanId: true,
  photoAccessToken: true,
  createdAt: true,
});

export type Scan = typeof scans.$inferSelect;
export type InsertScan = z.infer<typeof insertScanSchema>;

export type Store = 'rimi' | 'maxima';

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

import type { Product, NutritionFacts, ProductPhoto, Category } from "../server/remote-schema";

export type ProductWithDetails = Product & {
  nutrition?: NutritionFacts;
  photos?: ProductPhoto[];
  category?: Category;
  store?: Store;
  externalUrl?: string | null;
  ingredientCard?: ProductIngredientCard;
};
