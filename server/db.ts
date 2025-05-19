import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Log connection strings for debugging
console.log("Using DATABASE_URL as primary connection");

// To simplify things, let's use a single connection for all operations
// This can reduce connection issues in the serverless environment
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. This environment variable is required for database connection.");
}

// Create a simple pool for all operations
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1  // Single connection for Neon serverless to avoid connection issues
});

// Create a single drizzle client instance
export const db = drizzle({ client: pool, schema });

// For backward compatibility, keep these exports
export const categoriesDb = db;
export const productsDb = db;
export const categoriesPool = pool;
export const productsPool = pool;

console.log("Database connection established successfully");
