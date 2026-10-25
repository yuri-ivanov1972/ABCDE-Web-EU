import type { IncomingMessage, ServerResponse } from "node:http";

const UPSTREAM = "https://abcde-mcp.replit.app";
const pages = new Set([
  "/lv/mcp", "/en/mcp", "/lv/mcp/", "/en/mcp/",
  "/lv/mcp/index.html", "/en/mcp/index.html",
]);
const documents = new Set([
  "/mcp-site/content/lv.md", "/mcp-site/content/en.md",
  "/mcp-site/llms.txt", "/mcp-site/sitemap.xml", "/mcp-site/robots.txt",
  "/mcp-site/favicon.svg", "/mcp-site/stats",
]);
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

/** Options are trusted dependency injection for tests, never request input. */
export function createMcpPageProxy({
  fetchUpstream = fetch,
  timeoutMs = 10_000,
  maxBodyBytes = 4 * 1024 * 1024,
}: {
  fetchUpstream?: typeof fetch;
  timeoutMs?: number;
  maxBodyBytes?: number;
} = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const pathname = (req.url ?? "/").split("?")[0]!;
    if (!pages.has(pathname) && pathname !== "/mcp-site" && !pathname.startsWith("/mcp-site/")) {
      return false;
    }
    const send = (status: number, message: string) => {
      res.writeHead(status, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : message);
      return true;
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return send(405, "Method not allowed\n");
    }
    const asset = /^\/mcp-site\/assets\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(pathname);
    if (!pages.has(pathname) && !documents.has(pathname) && !asset) {
      return send(404, "Not found\n");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const disconnect = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", disconnect);
    let response: globalThis.Response | undefined;
    try {
      // Fixed origin, allowlisted raw path, and no caller query or credentials.
      response = await fetchUpstream(new URL(pathname, UPSTREAM), {
        method: req.method,
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: pathname === "/mcp-site/stats" ? "application/json" : "*/*" },
      });
      if (redirectStatuses.has(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Missing redirect location");
        const target = new URL(location, UPSTREAM + pathname);
        if (target.origin !== UPSTREAM || target.username || target.password || !pages.has(target.pathname)) {
          throw new Error("Unsafe upstream redirect");
        }
        res.writeHead(response.status, {
          Location: target.pathname + target.search + target.hash,
          "Cache-Control": "no-store",
        });
        res.end();
        return true;
      }

      const chunks: Uint8Array[] = [];
      let size = 0;
      if (req.method !== "HEAD" && response.body) {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > maxBodyBytes) throw new Error("Upstream body too large");
          chunks.push(chunk);
        }
      }
      const body = Buffer.concat(chunks);
      const headers: Record<string, string> = {
        "Content-Type": response.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": pathname === "/mcp-site/stats" ? "no-store" :
          response.headers.get("cache-control") ?? "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      };
      // fetch decompresses responses. Never copy encoding/length, cookies,
      // upstream CSP or hop-by-hop headers. HEAD has no invented zero length.
      if (req.method !== "HEAD" && response.status !== 304 && response.status !== 204) {
        headers["Content-Length"] = String(body.length);
      }
      res.writeHead(response.status, headers);
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    } catch {
      if (!res.destroyed) return send(502, "MCP page service unavailable\n");
      return true;
    } finally {
      clearTimeout(timeout);
      res.off("close", disconnect);
      // Release redirect and HEAD response bodies without retaining connections.
      if (response?.body && !response.body.locked) {
        await response.body.cancel().catch(() => {});
      }
    }
  };
}
