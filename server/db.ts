import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon to use WebSockets with improved settings
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

// Log database URLs (just the beginning for security)
const rimiUrlStart = process.env.RIMI_DATABASE_URL 
  ? process.env.RIMI_DATABASE_URL.substring(0, 20) + "..." 
  : "undefined";
const maximaUrlStart = process.env.MAXIMA_DATABASE_URL
  ? process.env.MAXIMA_DATABASE_URL.substring(0, 20) + "..."
  : "undefined";
const localUrlStart = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.substring(0, 20) + "..."
  : "undefined";

console.log("RIMI_DATABASE_URL starts with:", rimiUrlStart);
console.log("MAXIMA_DATABASE_URL starts with:", maximaUrlStart);
console.log("DATABASE_URL (local) starts with:", localUrlStart);

// Get database connection strings
const RIMI_DB_URL = process.env.RIMI_DATABASE_URL;
const MAXIMA_DB_URL = process.env.MAXIMA_DATABASE_URL;
const LOCAL_DB_URL = process.env.DATABASE_URL;

if (!RIMI_DB_URL) {
  throw new Error("RIMI_DATABASE_URL is not set. Please provide this environment variable.");
}

if (!MAXIMA_DB_URL) {
  console.warn("MAXIMA_DATABASE_URL is not set. Maxima products will not be available.");
}

if (!LOCAL_DB_URL) {
  throw new Error("DATABASE_URL is not set. Please provision the local database.");
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
export const rimiPool = new Pool({ 
  connectionString: RIMI_DB_URL,
  ...poolConfig
});

export const maximaPool = MAXIMA_DB_URL ? new Pool({
  connectionString: MAXIMA_DB_URL,
  ...poolConfig
}) : null;

export const scansPool = new Pool({
  connectionString: LOCAL_DB_URL,
  ...poolConfig
});

// Add connection error handling
rimiPool.on('error', (err) => {
  console.error('Rimi database pool error:', err);
});

if (maximaPool) {
  maximaPool.on('error', (err) => {
    console.error('Maxima database pool error:', err);
  });
}

scansPool.on('error', (err) => {
  console.error('Scans pool error:', err);
});

// Create drizzle clients
// rimiDb is used for categories, products, nutrition facts, and product photos
export const rimiDb = drizzle({ client: rimiPool, schema });
// maximaDb is used for Maxima products (optional)
export const maximaDb = maximaPool ? drizzle({ client: maximaPool, schema }) : null;
// scansDb is used for local scan data
export const scansDb = drizzle({ client: scansPool, schema });

const dbList = ['rimi (remote)', maximaDb ? 'maxima (remote)' : null, 'scans (local)'].filter(Boolean).join(', ');
console.log(`Database connections established: ${dbList}`);
