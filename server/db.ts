import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Get database connection strings from environment variables
console.log("CATEGORIES_DB_URL available:", !!process.env.CATEGORIES_DB_URL);
console.log("PRODUCTS_DB_URL available:", !!process.env.PRODUCTS_DB_URL);

// Check if required environment variables are set
const CATEGORIES_DB_URL = process.env.CATEGORIES_DB_URL;
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL;

if (!CATEGORIES_DB_URL) {
  throw new Error("CATEGORIES_DB_URL must be set. Did you forget to add the categories database URL?");
}

if (!PRODUCTS_DB_URL) {
  throw new Error("PRODUCTS_DB_URL must be set. Did you forget to add the products database URL?");
}

// Create pools with very minimal configuration to avoid connection issues
// Neon serverless works best with simple configuration
export const categoriesPool = new Pool({ connectionString: CATEGORIES_DB_URL });
export const productsPool = new Pool({ connectionString: PRODUCTS_DB_URL });

// Create drizzle clients
export const categoriesDb = drizzle({ client: categoriesPool, schema });
export const productsDb = drizzle({ client: productsPool, schema });

console.log("Database connections established with minimal configuration");
