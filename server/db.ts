import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;
// Increase connection timeout for more stability
neonConfig.connectionTimeoutMillis = 30000;
// Add connection retries
neonConfig.retryEnabled = true;
neonConfig.retryCreditsWait = 100;
neonConfig.retryInitialCredits = 5;

// Get database connection strings from environment variables
// Log the first part of the URLs for debugging (without exposing credentials)
console.log("CATEGORIES_DB_URL starts with:", 
  process.env.CATEGORIES_DB_URL ? process.env.CATEGORIES_DB_URL.substring(0, 20) + "..." : "undefined");
console.log("PRODUCTS_DB_URL starts with:", 
  process.env.PRODUCTS_DB_URL ? process.env.PRODUCTS_DB_URL.substring(0, 20) + "..." : "undefined");

const CATEGORIES_DB_URL = process.env.CATEGORIES_DB_URL;
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL;

if (!CATEGORIES_DB_URL) {
  throw new Error(
    "CATEGORIES_DB_URL must be set. Did you forget to add the categories database URL?"
  );
}

if (!PRODUCTS_DB_URL) {
  throw new Error(
    "PRODUCTS_DB_URL must be set. Did you forget to add the products database URL?"
  );
}

// Create more robust database pools
const poolConfig = {
  max: 10,                    // Maximum number of connections in the pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  connectionTimeoutMillis: 30000, // Timeout for connection attempts
  maxUses: 100,               // Max queries per connection to prevent memory leaks
  connectionRetryLimit: 3     // Retry connection attempts
};

// Create database pools with improved settings
export const categoriesPool = new Pool({ 
  connectionString: CATEGORIES_DB_URL, 
  ...poolConfig
});

export const productsPool = new Pool({ 
  connectionString: PRODUCTS_DB_URL,
  ...poolConfig
});

// Create drizzle clients
export const categoriesDb = drizzle({ client: categoriesPool, schema });
export const productsDb = drizzle({ client: productsPool, schema });
