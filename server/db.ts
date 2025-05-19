import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Get database connection strings from environment variables
console.log("CATEGORIES_DB_URL starts with:", 
  process.env.CATEGORIES_DB_URL ? process.env.CATEGORIES_DB_URL.substring(0, 20) + "..." : "undefined");
console.log("PRODUCTS_DB_URL starts with:", 
  process.env.PRODUCTS_DB_URL ? process.env.PRODUCTS_DB_URL.substring(0, 20) + "..." : "undefined");

// Use original product and category database URLs
const CATEGORIES_DB_URL = process.env.CATEGORIES_DB_URL;
const PRODUCTS_DB_URL = process.env.PRODUCTS_DB_URL;

if (!CATEGORIES_DB_URL) {
  throw new Error("CATEGORIES_DB_URL must be set. Did you forget to add the categories database URL?");
}

if (!PRODUCTS_DB_URL) {
  throw new Error("PRODUCTS_DB_URL must be set. Did you forget to add the products database URL?");
}

// Function to create a connection with better error handling
function createNeonConnection(url: string) {
  try {
    // Create a connection with minimal settings for Neon's serverless environment
    const pool = new Pool({ 
      connectionString: url,
      max: 1 // Use single connection mode for Neon serverless
    });
    
    return pool;
  } catch (error) {
    console.error('Failed to create database connection:', error);
    throw error;
  }
}

// Create the database pools with better error handling
export const categoriesPool = createNeonConnection(CATEGORIES_DB_URL);
export const productsPool = createNeonConnection(PRODUCTS_DB_URL);

// Create the Drizzle clients
export const categoriesDb = drizzle({ client: categoriesPool, schema });
export const productsDb = drizzle({ client: productsPool, schema });

console.log("Original database connections restored successfully");
