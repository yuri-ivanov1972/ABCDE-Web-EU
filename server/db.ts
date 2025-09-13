import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets with improved settings
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

// Log database URLs (just the beginning for security)
const categoriesUrlStart = process.env.CATEGORIES_DB_URL 
  ? process.env.CATEGORIES_DB_URL.substring(0, 20) + "..." 
  : "undefined";
const productsUrlStart = process.env.PRODUCTS_DB_URL
  ? process.env.PRODUCTS_DB_URL.substring(0, 20) + "..."
  : "undefined";

console.log("CATEGORIES_DB_URL starts with:", categoriesUrlStart);
console.log("PRODUCTS_DB_URL starts with:", productsUrlStart);

// Get database connection strings
const CATEGORIES_DB_URL = process.env.CATEGORIES_DB_URL;
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL;

if (!CATEGORIES_DB_URL) {
  throw new Error("CATEGORIES_DB_URL is not set. Please provide this environment variable.");
}

if (!PRODUCTS_DB_URL) {
  throw new Error("PRODUCTS_DB_URL is not set. Please provide this environment variable.");
}

// Improved connection pool settings for better stability
const poolConfig = {
  max: 5, // Reduced from 20 to avoid connection limits
  maxUses: 7500, // Add connection cycling
  allowExitOnIdle: false,
  maxLifetimeSeconds: 3600, // 1 hour connection lifetime
  idleTimeoutMillis: 60000, // 1 minute idle timeout
};

// Create connection pools with improved error handling
export const categoriesPool = new Pool({ 
  connectionString: CATEGORIES_DB_URL,
  ...poolConfig
});

export const productsPool = new Pool({ 
  connectionString: PRODUCTS_DB_URL,
  ...poolConfig
});

// Add connection error handling
categoriesPool.on('error', (err) => {
  console.error('Categories pool error:', err);
});

productsPool.on('error', (err) => {
  console.error('Products pool error:', err);
});

// Create drizzle clients
export const categoriesDb = drizzle({ client: categoriesPool, schema });
export const productsDb = drizzle({ client: productsPool, schema });

console.log("Database connections established with external Neon databases");
