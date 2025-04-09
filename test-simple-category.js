// Simplified test script to check categories
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

// These are categories with products from our previous test
const productCategories = [173, 150, 104, 323, 144];
// These are categories from the UI we've seen in logs
const uiCategories = [10, 88, 1, 16, 6, 43, 2, 4];

async function testOneCategory(categoryId) {
  try {
    console.log(`\n\nTesting category ID: ${categoryId}`);
    
    // Check if it exists in categories database
    const categoryResult = await categoriesPool.query(
      'SELECT * FROM normalized_categories WHERE category_id = $1',
      [categoryId]
    );
    
    if (categoryResult.rows.length > 0) {
      console.log(`Category ${categoryId} in categories DB: "${categoryResult.rows[0].name_lv}"`);
    } else {
      console.log(`Category ${categoryId} NOT FOUND in categories database`);
    }
    
    // Check if it has products
    const productsResult = await productsPool.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = $1',
      [categoryId]
    );
    
    console.log(`Products with category ${categoryId}: ${productsResult.rows[0].count}`);
  } catch (err) {
    console.error(`Error testing category ${categoryId}:`, err);
  }
}

async function testCategories() {
  try {
    // Just test one product category and one UI category for now
    await testOneCategory(173); // Has products
    await testOneCategory(10);  // From UI
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await categoriesPool.end();
    await productsPool.end();
  }
}

testCategories();