import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";

// Define API route schemas
const getCategoriesQuerySchema = z.object({
  level: z.coerce.number().optional(),
  parentId: z.coerce.number().optional()
});

const getProductsQuerySchema = z.object({
  categoryId: z.coerce.number().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(12),
  nutriScores: z.string().optional().transform(val => val ? val.split(',') : undefined),
  sugarMin: z.coerce.number().optional(),
  sugarMax: z.coerce.number().optional(),
  fatMin: z.coerce.number().optional(),
  fatMax: z.coerce.number().optional(),
  proteinMin: z.coerce.number().optional(),
  proteinMax: z.coerce.number().optional(),
  saltMin: z.coerce.number().optional(),
  saltMax: z.coerce.number().optional(),
  sortBy: z.enum(['name', 'nutriScore', 'sugar', 'fat', 'protein', 'salt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().optional()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes - all prefixed with /api
  
  // Category routes
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const { level, parentId } = getCategoriesQuerySchema.parse(req.query);
      
      if (parentId) {
        const categories = await storage.getSubcategories(parentId);
        return res.json(categories);
      }
      
      const categories = await storage.getCategories(level);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  
  app.get("/api/categories/:id", async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id, 10);
      
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      const category = await storage.getCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });
  
  app.get("/api/categories/:id/path", async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id, 10);
      
      if (isNaN(categoryId)) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      const categoryPath = await storage.getCategoryPath(categoryId);
      
      if (!categoryPath.length) {
        return res.status(404).json({ message: "Category path not found" });
      }
      
      res.json(categoryPath);
    } catch (error) {
      console.error("Error fetching category path:", error);
      res.status(500).json({ message: "Failed to fetch category path" });
    }
  });
  
  // Product routes
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const { 
        search, 
        categoryId, 
        page, 
        pageSize, 
        nutriScores, 
        sugarMin, 
        sugarMax, 
        fatMin, 
        fatMax, 
        proteinMin, 
        proteinMax,
        saltMin,
        saltMax,
        sortBy,
        sortOrder
      } = getProductsQuerySchema.parse(req.query);
      
      const options = {
        categoryId,
        page,
        pageSize,
        nutriScores,
        sugarMin,
        sugarMax,
        fatMin,
        fatMax,
        proteinMin,
        proteinMax,
        saltMin,
        saltMax,
        sortBy,
        sortOrder
      };
      
      // If search query is provided, use search endpoint
      if (search) {
        const result = await storage.searchProducts(search, options);
        return res.json(result);
      }
      
      const result = await storage.getProducts(options);
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  
  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id, 10);
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const product = await storage.getProductById(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  
  app.get("/api/products/sku/:sku", async (req: Request, res: Response) => {
    try {
      const { sku } = req.params;
      
      if (!sku) {
        return res.status(400).json({ message: "Invalid product SKU" });
      }
      
      const product = await storage.getProductBySku(sku);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by SKU:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
