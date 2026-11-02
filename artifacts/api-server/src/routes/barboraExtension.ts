import express, { type RequestHandler, type ErrorRequestHandler } from "express";
import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { ipKeyGenerator } from "express-rate-limit";
import { LookupBarboraNutriscoresBody } from "@workspace/api-zod";
import { LookupFailure, type Badge } from "../lib/barboraLookup";

type Lookup = (ids: string[], signal: AbortSignal) =>
  Promise<{ products: Record<string, Badge> }>;
type Options = {
  lookup: Lookup; now?: () => number; deadlineMs?: number;
  perClient?: number; perInstance?: number; concurrency?: number;
  onComplete?: (status: number, durationMs: number) => void;
};

// No shared parser, authentication, session, HTML fallback or request logger.
// Do not trust arbitrary forwarding headers. Keep the website's trust setting.
export function createBarboraExtension(options: Options) {
  const router = express.Router({ strict: true, caseSensitive: true });
  const now = options.now ?? Date.now;
  const secret = randomBytes(32);
  const clients = new Map<string, { count: number; until: number }>();
  let instance = { count: 0, until: 0 };
  let nextSweep = 0;
  let active = 0;
  const error = (res: express.Response, status: number, code: string) =>
    res.status(status).json({ error: { code } });

  router.use((req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type" });
    const started = now();
    res.once("finish", () => options.onComplete?.(res.statusCode, now() - started));
    next();
  });
  router.use((req, res, next) => {
    if (req.path !== "/nutriscores/batch") {
      error(res, 404, "not_found"); return;
    }
    if (req.method === "OPTIONS") {
      res.set("Allow", "POST, OPTIONS").status(204).end(); return;
    }
    if (req.method !== "POST") {
      res.set("Allow", "POST, OPTIONS"); error(res, 405, "method_not_allowed"); return;
    }
    next();
  });
  router.use((req, res, next) => {
    // req.ip respects only the application's explicitly configured proxy trust
    // (currently false); attacker-controlled X-Forwarded-For cannot rotate keys.
    let ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
    const key = createHmac("sha256", secret).update(ipKeyGenerator(ip, 56)).digest("hex");
    const time = now();
    if (time >= nextSweep) {
      for (const [key, value] of clients) if (value.until <= time) clients.delete(key);
      nextSweep = time + 60_000;
    }
    if (instance.until <= time) instance = { count: 0, until: time + 60_000 };
    let client = clients.get(key);
    if (!client || client.until <= time) {
      if (clients.size >= 5000) {
        for (const [key, value] of clients) if (value.until <= time) clients.delete(key);
      }
      if (clients.size >= 5000) {
        res.set("Retry-After", "60"); error(res, 429, "rate_limited"); return;
      }
      client = { count: 0, until: time + 60_000 }; clients.set(key, client);
    }
    if (++instance.count > (options.perInstance ?? 120) ||
        ++client.count > (options.perClient ?? 30) ||
        active >= (options.concurrency ?? 4)) {
      res.set("Retry-After", String(Math.max(1, Math.ceil(
        (Math.min(client.until, instance.until) - time) / 1000))));
      error(res, 429, "rate_limited"); return;
    }
    next();
  });
  router.use((req, res, next) => {
    // Reject credentials rather than let them enter website/session middleware.
    if (req.headers.cookie || req.headers.authorization || req.originalUrl.includes("?")) {
      error(res, 400, "invalid_request"); return;
    }
    if (req.headers["content-encoding"] &&
        req.headers["content-encoding"].toLowerCase() !== "identity") {
      error(res, 415, "unsupported_media_type"); return;
    }
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/i.test(req.get("content-type") ?? "")) {
      error(res, 415, "unsupported_media_type"); return;
    }
    next();
  });
  router.use((req, res, next) => {
    const controller = new AbortController();
    res.locals.lookupSignal = controller.signal;
    active++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true; active--; clearTimeout(timer);
      controller.abort(new LookupFailure("lookup_unavailable"));
      req.off("aborted", disconnected);
    };
    const disconnected = () => controller.abort(new LookupFailure("lookup_unavailable"));
    const timer = setTimeout(() => {
      controller.abort(new LookupFailure("lookup_timeout"));
      if (!res.headersSent && !res.destroyed) error(res, 504, "lookup_timeout");
      // A slow sender must not retain the parser/socket after its deadline.
      if (!req.complete) res.once("finish", () => req.destroy());
    }, options.deadlineMs ?? 5000);
    timer.unref();
    req.once("aborted", disconnected);
    res.once("close", release); res.once("finish", release);
    next();
  });
  router.use(express.json({ limit: 32 * 1024, inflate: false, strict: true }));
  const handler: RequestHandler = async (req, res) => {
    if ((res.locals.lookupSignal as AbortSignal).aborted) return;
    if (Array.isArray(req.body?.product_ids) && req.body.product_ids.length > 100) {
      error(res, 413, "payload_too_large"); return;
    }
    const parsed = LookupBarboraNutriscoresBody.strict().safeParse(req.body);
    if (!parsed.success) { error(res, 400, "invalid_request"); return; }
    try {
      const result = await options.lookup([...new Set(parsed.data.product_ids)], res.locals.lookupSignal);
      if (!res.headersSent && !res.destroyed) res.json(result);
    } catch (cause) {
      if (res.headersSent || res.destroyed) return;
      const code = cause instanceof LookupFailure ? cause.code : "lookup_unavailable";
      if (code === "lookup_unavailable") res.set("Retry-After", "5");
      error(res, code === "lookup_timeout" ? 504 : 503, code);
    }
  };
  router.use(handler);
  const parserError: ErrorRequestHandler = (cause, _req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    const type = (cause as { type?: string }).type;
    const status = type === "entity.too.large" ? 413 :
      type === "charset.unsupported" || type === "encoding.unsupported" ? 415 : 400;
    error(res, status, status === 413 ? "payload_too_large" :
      status === 415 ? "unsupported_media_type" : "invalid_request");
  };
  router.use(parserError);
  return router;
}
