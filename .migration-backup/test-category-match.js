// Script to test if categories from products database exist in categories database
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

// Get the URLs from environment
const CATEGORIES_DB_URL = process.env.CATEGORIES_DB_URL;
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL;

if (!CATEGORIES_DB_URL || !PRODUCTS_DB_URL) {
  console.error("Missing database URLs");
  process.exit(1);
}

// Create pools
const categoriesPool = new Pool({ connectionString: CATEGORIES_DB_URL });
const productsPool = new Pool({ connectionString: PRODUCTS_DB_URL });

async function testCategoryMatch() {
  try {
    // Get top product categories
    console.log("Getting top product categories...");
    const topProductCategories = await productsPool.query(`
      SELECT category_id, COUNT(*) as product_count 
      FROM products 
      GROUP BY category_id 
      ORDER BY product_count DESC 
      LIMIT 5
    `);
    
    console.log("Top product categories:", JSON.stringify(topProductCategories.rows, null, 2));
    
    // Check if these categories exist in the categories database
    console.log("\nChecking if these categories exist in categories database...");
    
    for (const row of topProductCategories.rows) {
      const categoryId = row.category_id;
      const productCount = row.product_count;
      
      const categoryResult = await categoriesPool.query(
        'SELECT * FROM normalized_categories WHERE category_id = $1',
        [categoryId]
      );
      
      if (categoryResult.rows.length > 0) {
        console.log(`✅ Category ${categoryId} exists in categories database: "${categoryResult.rows[0].name_lv}" with ${productCount} products`);
      } else {
        console.log(`❌ Category ${categoryId} with ${productCount} products NOT FOUND in categories database`);
      }
    }
    
    // Now let's check the other way - get categories from UI and check if they have products
    console.log("\nChecking if categories from UI have products...");
    
    // These are some of the category IDs we see in the UI/logs
    const uiCategoryIds = [10, 88, 1, 16, 6, 43, 2, 4];
    
    for (const categoryId of uiCategoryIds) {
      const categoryResult = await categoriesPool.query(
        'SELECT * FROM normalized_categories WHERE category_id = $1',
        [categoryId]
      );
      
      const productsResult = await productsPool.query(
        'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
        [categoryId]
      );
      
      const productCount = productsResult.rows[0].count;
      
      if (categoryResult.rows.length > 0) {
        if (productCount > 0) {
          console.log(`✅ UI Category ${categoryId} "${categoryResult.rows[0].name_lv}" has ${productCount} products`);
        } else {
          console.log(`❓ UI Category ${categoryId} "${categoryResult.rows[0].name_lv}" exists but has 0 products`);
        }
      } else {
        console.log(`❌ UI Category ${categoryId} not found in categories database`);
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await categoriesPool.end();
    await productsPool.end();
  }
}

testCategoryMatch();