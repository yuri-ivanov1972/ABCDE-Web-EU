// Simple script to test the products database connection
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

console.log("Testing connection to Products database with URL starting with:", 
  PRODUCTS_DB_URL.substring(0, 20) + "..." // Show just the beginning to avoid printing credentials
);

// Create a pool and test the connection
const pool = new Pool({ connectionString: PRODUCTS_DB_URL });

async function testConnection() {
  try {
    // Test basic connection
    console.log("Testing basic connection...");
    const connectionResult = await pool.query('SELECT 1 as check');
    console.log("Connection successful:", connectionResult.rows);
    
    // Check tables
    console.log("\nListing available tables...");
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log("Available tables:", tablesResult.rows.map(row => row.table_name));
    
    // Check if products table exists and get count
    if (tablesResult.rows.some(row => row.table_name === 'products')) {
      console.log("\nChecking products table...");
      const countResult = await pool.query('SELECT COUNT(*) as count FROM products');
      console.log(`Products table contains ${countResult.rows[0].count} records`);
      
      if (countResult.rows[0].count > 0) {
        // Show sample data
        console.log("\nFetching sample product data...");
        const sampleResult = await pool.query('SELECT * FROM products LIMIT 1');
        console.log("Sample product:", sampleResult.rows[0]);
      }
    }
  } catch (err) {
    console.error("Error testing database connection:", err);
  } finally {
    await pool.end();
  }
}

testConnection().catch(console.error);