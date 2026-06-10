import type { Request, Response } from "express";
import sharp from "sharp";

const ALLOWED_HOSTS = new Set(["cdn.barbora.lv"]);
const MAX_WIDTH = 1200;

interface CacheEntry {
  data: Buffer;
  timestamp: number;
}

const memCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function pruneCache() {
  if (memCache.size < MAX_CACHE_SIZE) return;
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [key, entry] of memCache.entries()) {
    if (entry.timestamp < cutoff) memCache.delete(key);
    if (memCache.size < MAX_CACHE_SIZE * 0.8) break;
  }
  if (memCache.size >= MAX_CACHE_SIZE) {
    const keys = Array.from(memCache.keys()).slice(0, 100);
    for (const k of keys) memCache.delete(k);
  }
}

async function fetchAndConvert(url: string, width: number): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ABCDE.lv/1.0 image-proxy" },
    });
    if (!upstream.ok) throw new Error(`Upstream ${upstream.status}`);
    const arrayBuffer = await upstream.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    return await sharp(inputBuffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch+convert a Barbora image URL and populate the in-memory cache.
 * Check order: in-memory → fetch from Barbora CDN.
 * Returns the WebP buffer, or null on failure.
 * Validates the URL hostname against ALLOWED_HOSTS before fetching.
 * Re-throws AbortError so callers can distinguish 504 upstream timeout.
 */
export async function warmCacheEntry(url: string, width: number): Promise<Buffer | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return null;
  }

  const memKey = `${url}::${width}`;

  // 1. In-memory hit
  const cached = memCache.get(memKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 2. Fetch from origin, convert, store in memory
  const webpBuffer = await fetchAndConvert(url, width);
  pruneCache();
  memCache.set(memKey, { data: webpBuffer, timestamp: Date.now() });

  return webpBuffer;
}

/**
 * Pre-warm the cache for a list of Barbora CDN URLs at server startup.
 * Runs all requests concurrently and logs total time and success count.
 */
export async function warmCache(urls: string[], width = 300): Promise<void> {
  const start = Date.now();
  const results = await Promise.allSettled(
    urls.map((url) => warmCacheEntry(url, width))
  );
  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && r.value !== null
  ).length;
  console.log(
    `[imageProxy] warmed ${succeeded}/${urls.length} images in ${((Date.now() - start) / 1000).toFixed(1)}s`
  );
}

export async function handleImageProxy(req: Request, res: Response): Promise<void> {
  const { url, w } = req.query;

  if (!url || typeof url !== "string") {
    res.status(400).send("Missing url");
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).send("Invalid url");
    return;
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    res.status(403).send("Forbidden host");
    return;
  }

  const width = Math.min(parseInt(String(w)) || 300, MAX_WIDTH);

  try {
    const webpBuffer = await warmCacheEntry(url, width);
    if (!webpBuffer) {
      res.status(502).send("Proxy error");
      return;
    }
    res.set("Content-Type", "image/webp");
    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.set("Vary", "Accept");
    res.send(webpBuffer);
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    if (isAbort) {
      res.status(504).send("Upstream timeout");
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[imageProxy] error:", msg);
      res.status(502).send("Proxy error");
    }
  }
}
