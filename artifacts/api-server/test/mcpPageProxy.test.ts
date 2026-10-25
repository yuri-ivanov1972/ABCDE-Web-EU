import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { createMcpPageProxy } from "../src/mcpPageProxy";

type Options = Parameters<typeof createMcpPageProxy>[0];

async function fixture(options: Options = {}) {
  const proxy = createMcpPageProxy(options);
  const server = createServer(async (req, res) => {
    if (!await proxy(req, res)) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Existing website");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => close(server),
  };
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
}
const fakeFetch = (handler: (url: URL, init: RequestInit) => Response | Promise<Response>) =>
  (async (input, init) => handler(new URL(String(input)), init ?? {})) as typeof fetch;

test("all page aliases and exact documents are forwarded, HEAD is bodyless", async () => {
  const seen: string[] = [];
  const f = await fixture({ fetchUpstream: fakeFetch((url, init) => {
    seen.push(url.pathname);
    return new Response(init.method === "HEAD" ? null : "upstream", {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }) });
  try {
    for (const path of [
      "/lv/mcp", "/en/mcp", "/lv/mcp/", "/en/mcp/",
      "/lv/mcp/index.html", "/en/mcp/index.html",
      "/mcp-site/favicon.svg", "/mcp-site/content/lv.md", "/mcp-site/content/en.md",
      "/mcp-site/llms.txt", "/mcp-site/sitemap.xml", "/mcp-site/robots.txt",
      "/mcp-site/stats", "/mcp-site/assets/index-Ab_1.js",
    ]) {
      const r = await fetch(f.base + path);
      assert.equal(await r.text(), "upstream");
      assert.equal(seen.at(-1), path);
    }
    const head = await fetch(f.base + "/lv/mcp", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(head.headers.get("content-length"), null);
    assert.equal(head.headers.get("content-type"), "text/markdown; charset=utf-8");
  } finally { await f.close(); }
});

test("credential and query isolation; safe headers, MIME and caching preserved", async () => {
  const f = await fixture({ fetchUpstream: fakeFetch((url, init) => {
    assert.equal(url.href, "https://abcde-mcp.replit.app/lv/mcp");
    assert.equal(init.redirect, "manual");
    assert.deepEqual(init.headers, { Accept: "*/*" });
    return new Response("decompressed html", { headers: {
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=0, must-revalidate",
      "Set-Cookie": "secret=test", "Content-Encoding": "gzip", "Content-Length": "1",
      "Content-Security-Policy": "default-src 'none'", "Connection": "keep-alive",
    } });
  }) });
  try {
    const r = await fetch(f.base + "/lv/mcp?target=https://evil.test&token=hidden", {
      headers: { Cookie: "browser=secret", Authorization: "Bearer secret" },
    });
    assert.equal(await r.text(), "decompressed html");
    for (const name of ["set-cookie", "content-encoding", "content-security-policy"]) {
      assert.equal(r.headers.get(name), null);
    }
    assert.equal(r.headers.get("content-length"), "17");
    assert.equal(r.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(r.headers.get("cache-control"), "private, max-age=0, must-revalidate");
  } finally { await f.close(); }
});

test("unknown scoped paths are real 404s, outside routes untouched; no fetch", async () => {
  const f = await fixture({ fetchUpstream: fakeFetch(() => { throw new Error("Must not fetch"); }) });
  try {
    for (const path of ["/mcp-site", "/mcp-site/", "/mcp-site/content/missing.md",
      "/mcp-site/assets/nested/file.js", "/mcp-site/assets/%2e%2e", "/mcp-site/assets/.hidden",
      "/mcp-site/api/stats", "/mcp-site/assets/a%2fb.js"]) {
      const r = await fetch(f.base + path);
      assert.equal(r.status, 404, path);
      assert.equal(await r.text(), "Not found\n");
    }
    for (const path of ["/lv", "/en", "/api/stats", "/api/products", "/assets/site.js", "/mcp", "/lv/mcp-other"]) {
      assert.equal(await (await fetch(f.base + path)).text(), "Existing website", path);
    }
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const r = await fetch(f.base + "/lv/mcp", { method });
      assert.equal(r.status, 405);
      assert.equal(r.headers.get("allow"), "GET, HEAD");
    }
  } finally { await f.close(); }
});

test("same-upstream page redirects stay local; unsafe/missing redirects fail closed", async () => {
  for (const location of ["/en/mcp", "https://abcde-mcp.replit.app/lv/mcp"]) {
    const f = await fixture({ fetchUpstream: fakeFetch(() => new Response(null, {
      status: 308, headers: { Location: location },
    })) });
    try {
      const r = await fetch(f.base + "/en/mcp/", { redirect: "manual" });
      assert.equal(r.status, 308);
      assert.equal(r.headers.get("location"), new URL(location, "https://abcde-mcp.replit.app").pathname);
    } finally { await f.close(); }
  }
  for (const location of [undefined, "https://evil.test/en/mcp", "//evil.test/lv/mcp",
    "/api/stats", "https://user:pass@abcde-mcp.replit.app/en/mcp"]) {
    const f = await fixture({ fetchUpstream: fakeFetch(() => new Response(null, {
      status: 302, headers: location ? { Location: location } : {},
    })) });
    try {
      assert.equal((await fetch(f.base + "/lv/mcp", { redirect: "manual" })).status, 502);
    } finally { await f.close(); }
  }
});

test("statistics success/failure preserve JSON/status and force no-store", async () => {
  for (const status of [200, 503]) {
    const f = await fixture({ fetchUpstream: fakeFetch((_url, init) => {
      assert.deepEqual(init.headers, { Accept: "application/json" });
      return new Response('{"measuredSessions":null}', {
        status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=999" },
      });
    }) });
    try {
      const r = await fetch(f.base + "/mcp-site/stats");
      assert.equal(r.status, status);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.deepEqual(await r.json(), { measuredSessions: null });
    } finally { await f.close(); }
  }
});

test("assets and upstream 404/304 status are preserved", async () => {
  for (const status of [200, 404, 304]) {
    const f = await fixture({ fetchUpstream: fakeFetch(() => new Response(status === 304 ? null : "asset", {
      status, headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" },
    })) });
    try {
      const r = await fetch(f.base + "/mcp-site/assets/hash.js");
      assert.equal(r.status, status);
      assert.equal(r.headers.get("cache-control"), "public, max-age=31536000, immutable");
    } finally { await f.close(); }
  }
});

test("network failure, deadline and oversized body become explicit 502", async () => {
  for (const fetchUpstream of [
    fakeFetch(() => { throw new Error("network failure"); }),
    fakeFetch((_url, init) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })),
    fakeFetch(() => new Response("too much content")),
  ]) {
    const f = await fixture({ fetchUpstream, timeoutMs: 20, maxBodyBytes: 5 });
    try {
      const r = await fetch(f.base + "/lv/mcp");
      assert.equal(r.status, 502);
      assert.equal(r.headers.get("cache-control"), "no-store");
    } finally { await f.close(); }
  }
});

test("client disconnection cancels upstream request", async () => {
  let start!: () => void;
  let aborted!: () => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  const cancelled = new Promise<void>(resolve => { aborted = resolve; });
  const f = await fixture({ fetchUpstream: fakeFetch((_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => { aborted(); reject(new Error("aborted")); }, { once: true });
    start();
  })) });
  try {
    const controller = new AbortController();
    const pending = fetch(f.base + "/lv/mcp", { signal: controller.signal }).catch(() => {});
    await started;
    controller.abort();
    await Promise.race([cancelled, new Promise((_, reject) => setTimeout(() => reject(new Error("not cancelled")), 1000))]);
    await pending;
  } finally { await f.close(); }
});
