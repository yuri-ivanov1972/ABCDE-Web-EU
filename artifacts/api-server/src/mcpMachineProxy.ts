// Dedicated machine transport; do not combine with the buffered human-page proxy.
import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const REQUEST_HEADERS = [
  "accept", "content-type", "origin", "mcp-protocol-version", "mcp-session-id",
  "mcp-method", "mcp-name", "last-event-id",
];
const RESPONSE_HEADERS = [
  "content-type", "mcp-protocol-version", "mcp-session-id", "allow", "retry-after",
  "www-authenticate",
];
const METHODS = ["POST", "GET", "DELETE", "HEAD", "OPTIONS"];
const MAX_REQUEST_BYTES = 32 * 1024;
const DEFAULT_ORIGINS = [
  "https://abcde.lv", "https://abcde-mcp.replit.app",
  "https://claude.ai", "https://claude.com", "https://www.claude.com",
];
const failure = (status: number, message: string) => Object.assign(new Error(message), { status });

function readRawBody(req: IncomingMessage, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      req.off("data", data);
      req.off("end", end);
      req.off("error", error);
      signal.removeEventListener("abort", abort);
    };
    const error = (cause: unknown) => { cleanup(); reject(cause); };
    const abort = () => error(signal.reason);
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        error(failure(413, "Request body is too large."));
        req.resume();
      } else chunks.push(chunk);
    };
    if (signal.aborted) { reject(signal.reason); return; }
    req.on("data", data);
    req.once("end", end);
    req.once("error", error);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function validOrigin(value: string | string[] | undefined, allowed: Set<string>): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.origin === value && allowed.has(url.origin);
  } catch { return false; }
}

export interface McpProxyOptions {
  /** Trusted test/server configuration only; never derived from a request. */
  upstreamUrl?: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export function createMcpProxy({
  upstreamUrl = "https://abcde-mcp.replit.app/mcp",
  allowedHosts = ["abcde.lv"],
  allowedOrigins = DEFAULT_ORIGINS,
  timeoutMs = 45_000,
  maxResponseBytes = 4 * 1024 * 1024,
}: McpProxyOptions = {}) {
  const target = new URL(upstreamUrl);
  const localFixture = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  if ((target.protocol !== "https:" && !(target.protocol === "http:" && localFixture)) ||
      target.username || target.password || target.pathname !== "/mcp" || target.search || target.hash) {
    throw new Error("Invalid fixed MCP upstream");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000 ||
      !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error("Invalid MCP proxy bounds");
  }
  const hosts = new Set(allowedHosts);
  const origins = new Set(allowedOrigins);

  return async function proxyMcp(
    req: IncomingMessage & { body?: unknown }, res: ServerResponse,
  ): Promise<boolean> {
    if ((req.url ?? "").split("?")[0] !== "/mcp") return false;
    const respond = (status: number, message: string) => {
      req.resume();
      if (res.destroyed || res.headersSent) return;
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        ...(status === 405 ? { Allow: METHODS.join(", ") } : {}),
      });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({
        jsonrpc: "2.0", error: { code: -32603, message }, id: null,
      }));
    };
    let host: string;
    try {
      const value = req.headers.host;
      const parsed = new URL(`http://${value}`);
      if (!value || parsed.host !== value.toLowerCase() || parsed.username || parsed.password) throw Error();
      host = parsed.hostname;
    } catch { respond(403, "Invalid Host."); return true; }
    if (!hosts.has(host) || !validOrigin(req.headers.origin, origins)) {
      respond(403, "Host or Origin is not allowed."); return true;
    }
    if (!METHODS.includes(req.method ?? "")) { respond(405, "Method not allowed."); return true; }
    if (req.headers.origin) {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Mcp-Protocol-Version, Retry-After, Allow");
    }
    if (req.method === "OPTIONS") {
      req.resume();
      res.writeHead(204, {
        "Cache-Control": "no-store", Allow: METHODS.join(", "),
        "Access-Control-Allow-Methods": METHODS.join(", "),
        "Access-Control-Allow-Headers": REQUEST_HEADERS.join(", "),
      });
      res.end();
      return true;
    }
    if (req.body !== undefined || req.readableEnded) {
      respond(500, "MCP proxy must run before body parsers."); return true;
    }
    const declaredLength = req.headers["content-length"];
    if (declaredLength !== undefined &&
        (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_REQUEST_BYTES)) {
      respond(413, "Request body is too large."); return true;
    }
    if (req.headers["content-encoding"] && req.headers["content-encoding"] !== "identity") {
      respond(415, "Compressed request bodies are not supported."); return true;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(failure(504, "MCP upstream timed out.")), timeoutMs);
    const disconnected = () => {
      if (!res.writableEnded) controller.abort(failure(499, "Client disconnected."));
    };
    req.once("aborted", disconnected);
    res.once("close", disconnected);
    try {
      const body = await readRawBody(req, controller.signal);
      const headers: Record<string, string> = {};
      for (const name of REQUEST_HEADERS) {
        const value = req.headers[name];
        if (typeof value === "string") headers[name] = value;
      }
      // Never forward the caller's Host, Cookie, Authorization or X-Forwarded-*.
      headers["accept-encoding"] = "identity";
      headers["content-length"] = String(body.length);
      const send = target.protocol === "https:" ? httpsRequest : httpRequest;
      const incoming = await new Promise<IncomingMessage>((resolve, reject) => {
        const outgoing = send(target, { method: req.method, headers, signal: controller.signal }, resolve);
        outgoing.once("error", reject);
        outgoing.end(body);
      });
      const status = incoming.statusCode ?? 502;
      const type = incoming.headers["content-type"] ?? "";
      const emptyAcknowledgement = status === 202 || status === 204;
      if ((status >= 300 && status < 400) || (!emptyAcknowledgement && /text\/html/i.test(type)) ||
          (status >= 200 && status < 300 && ![202, 204].includes(status) &&
            !/^(application\/json|text\/event-stream)(?:;|$)/i.test(type)) ||
          (incoming.headers["content-encoding"] && incoming.headers["content-encoding"] !== "identity")) {
        incoming.destroy();
        throw failure(502, "Invalid MCP upstream response.");
      }
      // The published Express service labels its empty 202 notification ack
      // text/html. Verify zero bytes before accepting it; never accept HTML data.
      if (emptyAcknowledgement) {
        for await (const chunk of incoming) {
          if (chunk.length) {
            incoming.destroy();
            throw failure(502, "Unexpected acknowledgement body.");
          }
        }
      }
      const outgoingHeaders: Record<string, string | string[]> = {
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
      };
      for (const name of RESPONSE_HEADERS) {
        const value = incoming.headers[name];
        if (value !== undefined) outgoingHeaders[name] = value;
      }
      res.writeHead(status, outgoingHeaders);
      res.flushHeaders();
      if (emptyAcknowledgement) {
        res.end();
        return true;
      }
      let transferred = 0;
      const bound = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          transferred += chunk.length;
          callback(transferred > maxResponseBytes ? failure(502, "MCP response is too large.") : null,
            transferred > maxResponseBytes ? undefined : chunk);
        },
      });
      await pipeline(incoming, bound, res, { signal: controller.signal });
    } catch (error) {
      if (res.headersSent) {
        if (!res.destroyed) res.destroy();
      } else if (!res.destroyed) {
        const cause: unknown = controller.signal.aborted ? controller.signal.reason : error;
        const code = cause && typeof cause === "object" && "status" in cause ? cause.status : undefined;
        const status = code === 413 || code === 504 ? code : 502;
        respond(status, status === 413 ? "Request body is too large." :
          status === 504 ? "MCP upstream timed out." : "MCP upstream is unavailable.");
      }
    } finally {
      clearTimeout(timer);
      req.off("aborted", disconnected);
      res.off("close", disconnected);
    }
    return true;
  };
}
