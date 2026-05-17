import type { Request, Response } from "express";
import sharp from "sharp";

const ALLOWED_HOSTS = new Set(["cdn.barbora.lv"]);
const MAX_WIDTH = 1200;

interface CacheEntry {
  data: Buffer;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

function pruneCache() {
  if (cache.size < MAX_CACHE_SIZE) return;
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [key, entry] of cache.entries()) {
    if (entry.timestamp < cutoff) cache.delete(key);
    if (cache.size < MAX_CACHE_SIZE * 0.8) break;
  }
  if (cache.size >= MAX_CACHE_SIZE) {
    const keys = Array.from(cache.keys()).slice(0, 100);
    for (const k of keys) cache.delete(k);
  }
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
  const cacheKey = `${url}::${width}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.set("Content-Type", "image/webp");
    res.set("Cache-Control", "public, max-age=604800, immutable");
    res.set("Vary", "Accept");
    res.send(cached.data);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ABCDE.lv/1.0 image-proxy" },
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      res.status(502).send("Upstream fetch failed");
      return;
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const webpBuffer = await sharp(inputBuffer)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    pruneCache();
    cache.set(cacheKey, { data: webpBuffer, timestamp: Date.now() });

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
