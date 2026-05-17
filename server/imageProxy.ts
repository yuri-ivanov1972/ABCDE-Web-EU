import type { Request, Response } from "express";
import sharp from "sharp";
import { createHash } from "crypto";
import { Client as ObjStorageClient } from "@replit/object-storage";

const ALLOWED_HOSTS = new Set(["cdn.barbora.lv"]);
const MAX_WIDTH = 1200;

interface CacheEntry {
  data: Buffer;
  timestamp: number;
}

const memCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

let objClient: ObjStorageClient | null = null;
try {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (bucketId) {
    objClient = new ObjStorageClient({ bucketId });
  } else {
    console.warn("[imageProxy] DEFAULT_OBJECT_STORAGE_BUCKET_ID not set — using memory cache only");
  }
} catch {
  console.warn("[imageProxy] Object Storage unavailable — using memory cache only");
}

function urlHash(url: string): string {
  return createHash("md5").update(url).digest("hex").slice(0, 16);
}

function objKey(url: string, width: number): string {
  return `.private/img-cache/${urlHash(url)}-${width}.webp`;
}

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
 * Fetch+convert a Barbora image URL and populate both caches.
 * Check order: in-memory → Object Storage → fetch from Barbora CDN.
 * Returns the WebP buffer, or null on failure.
 * Validates the URL hostname against ALLOWED_HOSTS before fetching.
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

  // 2. Object Storage hit
  if (objClient) {
    try {
      const key = objKey(url, width);
      const result = await objClient.downloadAsBytes(key);
      if (result.ok && result.value) {
        const buf = Buffer.from(result.value);
        pruneCache();
        memCache.set(memKey, { data: buf, timestamp: Date.now() });
        return buf;
      }
    } catch {
      // fall through to fetch
    }
  }

  // 3. Fetch from origin, convert, persist
  try {
    const webpBuffer = await fetchAndConvert(url, width);
    pruneCache();
    memCache.set(memKey, { data: webpBuffer, timestamp: Date.now() });

    if (objClient) {
      const key = objKey(url, width);
      // Fire-and-forget — don't block the response
      objClient.uploadFromBytes(key, webpBuffer, {
        contentType: "image/webp",
      }).catch((err: any) =>
        console.warn("[imageProxy] ObjStorage write failed:", err?.message)
      );
    }

    return webpBuffer;
  } catch {
    return null;
  }
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
  } catch (err: any) {
    if (err?.name === "AbortError") {
      res.status(504).send("Upstream timeout");
    } else {
      console.error("[imageProxy] error:", err?.message);
      res.status(502).send("Proxy error");
    }
  }
}
