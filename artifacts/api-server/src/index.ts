import app from "./app";
import { registerRoutes } from "./routes/routes";
import { logger } from "./lib/logger";
import { storage } from "./storage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Register all app routes (categories, products, image-proxy, seo, etc.)
await registerRoutes(app);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Pre-warm the default homepage products query so the first visitor
  // gets a cache hit instead of a cold 3+ second DB round-trip.
  storage
    .getProducts({ page: 1, pageSize: 12, sortBy: "name", sortOrder: "asc" })
    .then(() => logger.info("Homepage products cache warmed"))
    .catch((err: unknown) => logger.warn({ err }, "Cache warm failed — will warm on first request"));
});
