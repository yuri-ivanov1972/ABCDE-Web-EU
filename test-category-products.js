// Script to test products by category ID
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Configure neon to use websockets
neonConfig.webSocketConstructor = ws;

// Get the URL from environment
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL;

if (!PRODUCTS_DB_URL) {
  console.error("No PRODUCTS_DB_URL found in environment variables");
  process.exit(1);
}

// Create a pool
const pool = new Pool({ connectionString: PRODUCTS_DB_URL });

async function testProductsByCategory() {
  try {
    // Get a specific category ID from the categories with products
    const targetCategoryId = 173; // This is a category ID with products based on previous test
    
    console.log(`Testing products with category_id = ${targetCategoryId}...`);
    const result = await pool.query('SELECT COUNT(*) as count FROM products WHERE category_id = $1', [targetCategoryId]);
    console.log(`Found ${result.rows[0].count} products with category_id = ${targetCategoryId}`);
    
    if (result.rows[0].count > 0) {
      const sample = await pool.query('SELECT * FROM products WHERE category_id = $1 LIMIT 3', [targetCategoryId]);
      console.log('Sample products:', JSON.stringify(sample.rows, null, 2));
    }
    
    // Check all categories that have products
    console.log('\nTop 10 Categories with products:');
    const categoriesWithProducts = await pool.query(`
      SELECT category_id, COUNT(*) as product_count 
      FROM products 
      GROUP BY category_id 
      ORDER BY product_count DESC 
      LIMIT 10
    `);
    console.log(JSON.stringify(categoriesWithProducts.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testProductsByCategory();