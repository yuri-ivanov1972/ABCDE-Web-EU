import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Get database connection strings from environment variables
// Log the first part of the URLs for debugging (without exposing credentials)
console.log("CATEGORIES_DB_URL starts with:", 
  process.env.CATEGORIES_DB_URL ? process.env.CATEGORIES_DB_URL.substring(0, 20) + "..." : "undefined");
console.log("PRODUCTS_DB_URL starts with:", 
  process.env.PRODUCTS_DB_URL ? process.env.PRODUCTS_DB_URL.substring(0, 20) + "..." : "undefined");
console.log("DATABASE_URL starts with:", 
  process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + "..." : "undefined");

// Try to use different connection URLs, falling back if needed
const CATEGORIES_DB_URL = process.env.CATEGORIES_DB_URL || process.env.DATABASE_URL;
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL || process.env.DATABASE_URL;

if (!CATEGORIES_DB_URL && !process.env.DATABASE_URL) {
  throw new Error(
    "Neither CATEGORIES_DB_URL nor DATABASE_URL is set. Database connection information is missing."
  );
}

if (!PRODUCTS_DB_URL && !process.env.DATABASE_URL) {
  throw new Error(
    "Neither PRODUCTS_DB_URL nor DATABASE_URL is set. Database connection information is missing."
  );
}

// Create pool configuration
const poolConfig = {
  max: 5,                     // Use lower connection count to avoid hitting limits
  idleTimeoutMillis: 20000,   // Close idle connections sooner
  connectionTimeoutMillis: 10000, // Lower the connection timeout
  maxUses: 20                 // Recycle connections more frequently
};

// Create pools with more conservative settings
// We use a function to wrap pool creation so we can handle errors better
const createSafePool = (connectionString) => {
  try {
    return new Pool({ connectionString, ...poolConfig });
  } catch (error) {
    console.error("Failed to create pool:", error);
    // Fallback to default DATABASE_URL if specific ones fail
    if (process.env.DATABASE_URL && connectionString !== process.env.DATABASE_URL) {
      console.log("Falling back to DATABASE_URL");
      return new Pool({ connectionString: process.env.DATABASE_URL, ...poolConfig });
    }
    throw error;
  }
};

// Create database pools with safety mechanism
export const categoriesPool = createSafePool(CATEGORIES_DB_URL);
export const productsPool = createSafePool(PRODUCTS_DB_URL);

// Create drizzle clients with a simple error wrapper
const createSafeDb = (pool) => {
  try {
    return drizzle({ client: pool, schema });
  } catch (error) {
    console.error("Failed to create database client:", error);
    throw error;
  }
};

export const categoriesDb = createSafeDb(categoriesPool);
export const productsDb = createSafeDb(productsPool);

console.log("Database connections established successfully");
