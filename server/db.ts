import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Get database connection string from Replit's built-in PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Please provide this environment variable.");
}

console.log("Using Replit's built-in PostgreSQL database");

// Create single connection pool
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create single drizzle client for both categories and products
export const db = drizzle({ client: pool, schema });

// Export the same reference for backward compatibility
export const categoriesDb = db;
export const productsDb = db;
export const categoriesPool = pool;
export const productsPool = pool;

console.log("Database connection established with built-in PostgreSQL");
