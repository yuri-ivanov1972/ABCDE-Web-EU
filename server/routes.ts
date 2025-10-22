import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { categoriesDb, productsDb } from "./db";
import { normalizeLvText } from "./utils/textNormalization";

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

  // Debug route to check database connectivity
  app.get("/api/debug/db-status", async (_req: Request, res: Response) => {
    try {
      let categoriesConnected = false;
      let productsConnected = false;
      let categoriesCount = 0;
      let productsCount = 0;
      let errors = [];
      let testCategoryData = null;
      let testProductData = null;

      try {
        // Check categories database
        const categoriesResult = await categoriesDb.execute(sql`SELECT 1 as check`);
        categoriesConnected = !!categoriesResult;
        
        // Get categories count if connected
        const categoriesCountResult = await categoriesDb.execute(sql`SELECT COUNT(*) as count FROM normalized_categories`);
        categoriesCount = categoriesCountResult && 
          typeof categoriesCountResult === 'object' && 
          Array.isArray(categoriesCountResult) && 
          categoriesCountResult.length > 0 ? 
            Number(categoriesCountResult[0].count) : 0;
            
        // Get first category for testing
        if (categoriesCount > 0) {
          const firstCategoryResult = await categoriesDb.execute(sql`
            SELECT * FROM normalized_categories 
            ORDER BY category_id ASC 
            LIMIT 1
          `);
          testCategoryData = firstCategoryResult && Array.isArray(firstCategoryResult) && firstCategoryResult.length > 0 ? 
            firstCategoryResult[0] : null;
        }
      } catch (err) {
        console.error("Categories DB error:", err);
        errors.push({
          type: "categories",
          message: err instanceof Error ? err.message : String(err)
        });
      }

      try {
        // Check products database
        const productsResult = await productsDb.execute(sql`SELECT 1 as check`);
        productsConnected = !!productsResult;
        
        // Get products count if connected
        const productsCountResult = await productsDb.execute(sql`SELECT COUNT(*) as count FROM products`);
        productsCount = productsCountResult && 
          typeof productsCountResult === 'object' && 
          Array.isArray(productsCountResult) && 
          productsCountResult.length > 0 ? 
            Number(productsCountResult[0].count) : 0;
            
        // Get first product for testing
        if (productsCount > 0) {
          const firstProductResult = await productsDb.execute(sql`
            SELECT * FROM products 
            ORDER BY product_id ASC 
            LIMIT 1
          `);
          testProductData = firstProductResult && Array.isArray(firstProductResult) && firstProductResult.length > 0 ? 
            firstProductResult[0] : null;
        }
      } catch (err) {
        console.error("Products DB error:", err);
        errors.push({
          type: "products",
          message: err instanceof Error ? err.message : String(err)
        });
      }

      res.json({
        status: errors.length > 0 ? "error" : (categoriesCount > 0 && productsCount > 0 ? "ok" : "warning"),
        connections: {
          categories: categoriesConnected,
          products: productsConnected
        },
        counts: {
          categories: categoriesCount,
          products: productsCount
        },
        env: {
          categoriesUrl: !!process.env.CATEGORIES_DB_URL,
          productsUrl: !!process.env.PRODUCTS_DB_URL
        },
        // Add test data for debugging
        testData: {
          category: testCategoryData,
          product: testProductData
        },
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 
          ? "Database connection errors occurred" 
          : (categoriesCount === 0 || productsCount === 0 
              ? "One or more databases appear to be empty" 
              : "Database connections successful")
      });
    } catch (error) {
      console.error("Error checking database status:", error);
      res.status(500).json({ 
        status: "error", 
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
  
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
      
      // Cast nutriScores to the correct type (A, B, C, D, E)
      const validGrades = ['A', 'B', 'C', 'D', 'E'];
      const validatedNutriScores = nutriScores?.filter(grade => 
          validGrades.includes(grade.toUpperCase())
        ).map(grade => grade.toUpperCase() as any);
      
      const options = {
        categoryId,
        page,
        pageSize,
        nutriScores: validatedNutriScores,
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
        console.log(`Search query "${search}" returned ${result.products.length} products, total: ${result.totalCount}`);
        return res.json(result);
      }
      
      const result = await storage.getProducts(options);
      console.log(`GET products with options ${JSON.stringify({
        categoryId, page, pageSize, 
        filters: {
          nutriScores: nutriScores?.length ? nutriScores : 'none',
          nutrients: {sugarMin, sugarMax, fatMin, fatMax, proteinMin, proteinMax, saltMin, saltMax}
        },
        sort: {sortBy, sortOrder}
      })} returned ${result.products.length} products, total: ${result.totalCount}`);
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
  
  // Get product by Rimi URL
  app.get("/api/products/url/:url", async (req: Request, res: Response) => {
    try {
      const { url } = req.params;
      
      if (!url) {
        return res.status(400).json({ message: "Invalid product URL" });
      }
      
      // URL may need decoding as it could contain slashes and other special characters
      const decodedUrl = decodeURIComponent(url);
      
      const product = await storage.getProductByRimiUrl(decodedUrl);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by URL:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Helper function to normalize and filter text segments
  const normalizeTextSegments = (segments: string[]): string[] => {
    return segments
      .map(segment => normalizeLvText(segment))
      .filter(segment => segment.length > 3); // Filter out segments shorter than 4 characters
  };

  // Helper function to find matching product using two-pass token matching
  const findMatchingProduct = async (textSegments: string[]): Promise<any | null> => {
    if (!textSegments || textSegments.length === 0) {
      console.log('No text segments provided for matching');
      return null;
    }

    const normalizedSegments = normalizeTextSegments(textSegments);
    
    if (normalizedSegments.length === 0) {
      console.log('No segments long enough for matching after filtering');
      return null;
    }

    console.log(`Normalized segments for matching: ${normalizedSegments.join(', ')}`);

    // PASS 1: Find potential matches using SQL - products containing any of the segments
    const potentialMatches: any[] = [];
    
    for (const segment of normalizedSegments) {
      try {
        const searchResults = await storage.searchProducts(segment, {
          page: 1,
          pageSize: 50 // Get more results for better matching
        });
        
        for (const product of searchResults.products) {
          // Avoid duplicates
          if (!potentialMatches.find(m => m.productId === product.productId)) {
            potentialMatches.push(product);
          }
        }
      } catch (err) {
        console.error(`Error searching for segment "${segment}":`, err);
      }
    }

    if (potentialMatches.length === 0) {
      console.log('No potential matches found in Pass 1');
      return null;
    }

    console.log(`Pass 1 found ${potentialMatches.length} potential matches`);

    // PASS 2: Token-based verification with confidence scoring
    const confirmedMatches: Array<{
      product: any;
      matchConfidence: number;
      tokenCount: number;
    }> = [];

    for (const product of potentialMatches) {
      const normalizedProductName = normalizeLvText(product.name);
      const tokens = normalizedProductName.split(/\s+/);
      
      // Filter to significant tokens (longer than 3 characters)
      const significantTokens = tokens.filter(token => token.length > 3);
      const tokensToMatch = significantTokens.length > 0 ? significantTokens : tokens;

      // Calculate how many tokens are found in the text segments
      let matchingTokenCount = 0;
      
      for (const token of tokensToMatch) {
        const tokenFound = normalizedSegments.some((segment: string) => segment.includes(token));
        if (tokenFound) {
          matchingTokenCount++;
        }
      }

      // Calculate match confidence
      const matchConfidence = tokensToMatch.length > 0 
        ? matchingTokenCount / tokensToMatch.length 
        : 0;

      // Add to confirmed matches if confidence >= 60%
      if (matchConfidence >= 0.6) {
        confirmedMatches.push({
          product,
          matchConfidence,
          tokenCount: tokens.length
        });
      }
    }

    if (confirmedMatches.length === 0) {
      console.log('No confirmed matches found in Pass 2');
      return null;
    }

    // Sort by confidence (descending), then by token count (descending) for specificity
    confirmedMatches.sort((a, b) => {
      if (b.matchConfidence !== a.matchConfidence) {
        return b.matchConfidence - a.matchConfidence;
      }
      return b.tokenCount - a.tokenCount;
    });

    const bestMatch = confirmedMatches[0];
    console.log(`Best match: ${bestMatch.product.name} with confidence ${bestMatch.matchConfidence.toFixed(2)}`);

    return bestMatch.product;
  };

  // Scan product endpoint - accepts base64 image
  const scanRequestSchema = z.object({
    image: z.string().min(1, "Image data is required")
  });

  app.post("/api/scan", async (req: Request, res: Response) => {
    try {
      const result = scanRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request data",
          errors: result.error.errors
        });
      }

      const { image } = result.data;
      console.log(`Received image for scanning, size: ${image.length} bytes`);

      // Get API key from environment
      const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
      if (!apiKey) {
        console.error("GOOGLE_CLOUD_API_KEY not configured");
        return res.status(500).json({
          success: false,
          message: "OCR service not configured"
        });
      }

      // Strip data URL prefix if present (data:image/jpeg;base64,)
      const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');

      // Call Google Cloud Vision API
      const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
      
      const visionResponse = await fetch(visionApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image
              },
              features: [
                {
                  type: 'TEXT_DETECTION'
                }
              ]
            }
          ]
        })
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error(`Vision API error: ${visionResponse.status} - ${errorText}`);
        return res.status(500).json({
          success: false,
          message: "OCR processing failed"
        });
      }

      const visionData = await visionResponse.json();
      
      // Check for Vision API errors in the response
      const response = visionData.responses?.[0];
      if (response?.error) {
        console.error(`Vision API error in response: ${JSON.stringify(response.error)}`);
        return res.status(400).json({
          success: false,
          message: `OCR failed: ${response.error.message || 'Unknown error'}`
        });
      }
      
      // Extract text from response
      const textAnnotations = response?.textAnnotations;
      
      if (!textAnnotations || textAnnotations.length === 0) {
        return res.json({
          success: false,
          text: '',
          message: "No text detected in image. Please try again with a clearer photo."
        });
      }

      // Extract individual text segments (skip first element which is the full text)
      const textSegments: string[] = textAnnotations.slice(1).map((annotation: any) => annotation.description || '');
      
      console.log(`OCR detected ${textSegments.length} text segments:`, textSegments);

      // Find matching product using two-pass token matching
      const matchedProduct = await findMatchingProduct(textSegments);

      // Get the full text for display purposes
      const fullText = textAnnotations[0]?.description || textSegments.join(' ');

      res.json({
        success: true,
        text: fullText,
        message: matchedProduct 
          ? `Product found: ${matchedProduct.name}`
          : "Text extracted successfully. No matching product found.",
        product: matchedProduct ? {
          productId: matchedProduct.productId,
          name: matchedProduct.name,
          sku: matchedProduct.sku,
          rimiUrl: matchedProduct.rimiUrl,
          nutriScoreGrade: matchedProduct.nutrition?.nutriScoreGrade || null
        } : null
      });
    } catch (error) {
      console.error("Error processing scan:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process image" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
