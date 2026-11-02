import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { request } from "node:http";
import express from "express";
import { createBarboraExtension } from "../src/routes/barboraExtension";
import { LookupFailure } from "../src/lib/barboraLookup";

const path = "/api/extension/nutriscores/batch";
const sku = "000000000000790928";
const body = { retailer: "barbora", product_ids: [sku] };
async function harness(t: TestContext,
  overrides: Partial<Parameters<typeof createBarboraExtension>[0]> = {}) {
  const app = express();
  let later = 0;
  let calls = 0;
  const appLogs: unknown[] = [];
  app.use("/api/extension", createBarboraExtension({
    lookup: async ids => { calls++; assert.deepEqual(ids, [sku]); return { products: { [sku]: { nutri_score: "D" } } }; },
    onComplete: (status, duration) => appLogs.push({ status, duration }),
    ...overrides,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use((_req, res) => { later++; res.type("html").send("<!DOCTYPE html>"); });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  t.after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const send = (data: unknown = body, init: RequestInit = {}, target = path) =>
    fetch(`http://127.0.0.1:${address.port}${target}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: typeof data === "string" ? data : JSON.stringify(data), ...init,
    });
  return { send, port: address.port, calls: () => calls, later: () => later, logs: appLogs };
}

test("credentialless extension-origin POST, preflight, no-store and isolated middleware", async t => {
  const h = await harness(t);
  const result = await h.send(body, { headers: { "Content-Type": "application/json",
    Origin: `chrome-extension://${"a".repeat(32)}` } });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { products: { [sku]: { nutri_score: "D" } } });
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("access-control-allow-origin"), "*");
  assert.equal(result.headers.get("access-control-allow-credentials"), null);
  assert.equal(result.headers.get("set-cookie"), null);
  const preflight = await h.send(undefined, { method: "OPTIONS", body: undefined,
    headers: { Origin: "chrome-extension://" + "b".repeat(32), "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type" } });
  assert.equal(preflight.status, 204); assert.equal(h.calls(), 1);
  assert.equal(h.later(), 0);
});

test("strict shape, retailer, text keys, leading zeros and no coercion", async t => {
  const h = await harness(t);
  for (const bad of [{ ...body, extra: true }, { ...body, retailer: "rimi" },
    { ...body, product_ids: [790928] }, { ...body, product_ids: ["790928"] },
    { ...body, product_ids: [sku + " "] }, { ...body, product_ids: [] }, {}, [], null]) {
    const response = await h.send(bad);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: { code: "invalid_request" } });
  }
  assert.equal(h.calls(), 0); assert.equal(h.later(), 0);
});

test("100 submitted IDs accepted and deduplicated; 101 rejected before deduplication", async t => {
  const h = await harness(t);
  assert.equal((await h.send({ ...body, product_ids: Array(100).fill(sku) })).status, 200);
  const result = await h.send({ ...body, product_ids: Array(101).fill(sku) });
  assert.equal(result.status, 413); assert.equal(h.calls(), 1);
});

test("scoped parser rejects malformed, >32KiB, compressed, non-JSON and charset bodies as JSON", async t => {
  const h = await harness(t);
  for (const [data, headers, status] of [
    ["{", { "content-type": "application/json" }, 400],
    [JSON.stringify({ ...body, padding: "x".repeat(33000) }), { "content-type": "application/json" }, 413],
    ["{}", { "content-type": "text/plain" }, 415],
    ["{}", { "content-type": "application/json", "content-encoding": "gzip" }, 415],
    ["{}", { "content-type": "application/json;charset=utf-16" }, 415],
  ] as const) {
    const result = await h.send(data, { headers });
    assert.equal(result.status, status);
    assert.match(result.headers.get("content-type")!, /application\/json/);
    assert.equal(result.headers.get("cache-control"), "no-store");
  }
  assert.equal(h.calls(), 0); assert.equal(h.later(), 0);
});

test("unknown paths are 404 and methods 405, never website fallback", async t => {
  const h = await harness(t);
  for (const target of ["/api/extension/no-such-route", path + "/", path + "/extra"]) {
    assert.equal((await h.send(body, {}, target)).status, 404);
  }
  const method = await h.send(undefined, { method: "GET", body: undefined });
  assert.equal(method.status, 405); assert.equal(method.headers.get("allow"), "POST, OPTIONS");
  assert.equal(h.later(), 0);
});

test("cookies, authorization and query strings rejected; logs contain only safe aggregates", async t => {
  const h = await harness(t);
  for (const headers of [{ "content-type": "application/json", Cookie: "secret-cookie=value" },
    { "content-type": "application/json", Authorization: "Bearer private-key" }]) {
    assert.equal((await h.send(body, { headers })).status, 400);
  }
  assert.equal((await h.send(body, {}, path + "?sku=" + sku)).status, 400);
  assert.equal(h.calls(), 0);
  const logs = JSON.stringify(h.logs);
  assert.doesNotMatch(logs, /790928|secret-cookie|private-key|Authorization|Cookie/);
});

test("failure is 503, statement timeout 504 and successful missing is 200", async t => {
  for (const cause of [new Error("private SQL and password"), new LookupFailure("lookup_timeout")]) {
    const h = await harness(t, { lookup: async () => { throw cause; } });
    const result = await h.send();
    assert.equal(result.status, cause instanceof LookupFailure ? 504 : 503);
    assert.doesNotMatch(await result.text(), /private|password|SQL/);
  }
  const h = await harness(t, { lookup: async () => ({ products: {} }) });
  const result = await h.send(); assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { products: {} });
});

test("IP limit cannot be bypassed by rotating forged forwarding headers and expires", async t => {
  let now = 0;
  const h = await harness(t, { now: () => now, perClient: 2 });
  for (let i = 0; i < 3; i++) {
    const result = await h.send(body, { headers: { "content-type": "application/json",
      "x-forwarded-for": `2001:db8:${i}::1`, "x-real-ip": `192.0.2.${i}` } });
    assert.equal(result.status, i < 2 ? 200 : 429);
    if (i === 2) assert.ok(Number(result.headers.get("retry-after")) > 0);
  }
  now = 60001; assert.equal((await h.send()).status, 200);
});

test("instance admission caps requests, even below client cap", async t => {
  const h = await harness(t, { perInstance: 1, perClient: 30 });
  assert.equal((await h.send()).status, 200);
  assert.equal((await h.send()).status, 429);
});

test("concurrency, deadline and cancellation free the next request without a success fallback", async t => {
  let aborted = false; let count = 0;
  const h = await harness(t, { concurrency: 1, deadlineMs: 80,
    lookup: async (_ids, signal) => {
      if (++count > 1) return { products: {} };
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => { aborted = true; reject(signal.reason); }, { once: true });
      });
    } });
  const first = h.send();
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal((await h.send()).status, 429);
  assert.equal((await first).status, 504); assert.ok(aborted);
  assert.equal((await h.send()).status, 200);
});

test("a disconnected client aborts outgoing lookup work", async t => {
  let resolveAbort!: () => void;
  let resolveStart!: () => void;
  const started = new Promise<void>(resolve => { resolveStart = resolve; });
  const aborted = new Promise<void>(resolve => { resolveAbort = resolve; });
  const h = await harness(t, { lookup: async (_ids, signal) => {
    resolveStart();
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
      resolveAbort(); reject(signal.reason);
    }, { once: true }));
  } });
  const req = request({ hostname: "127.0.0.1", port: h.port, path, method: "POST",
    headers: { "content-type": "application/json" } });
  req.on("error", () => {}); req.end(JSON.stringify(body));
  await started; req.destroy();
  await Promise.race([aborted, new Promise((_, reject) => setTimeout(() => reject(new Error("no abort")), 500))]);
});

test("slow upload is bounded by the same deadline before JSON parsing completes", async t => {
  const h = await harness(t, { deadlineMs: 60 });
  const result = await new Promise<number | undefined>((resolve, reject) => {
    const req = request({ hostname: "127.0.0.1", port: h.port, path, method: "POST",
      headers: { "content-type": "application/json", "content-length": "1000" } }, response => {
      response.resume(); response.once("end", () => resolve(response.statusCode));
    });
    req.on("error", reject);
    req.setTimeout(500, () => { req.destroy(); reject(new Error("slow upload not bounded")); });
    req.write("{"); // Deliberately never finish sending the claimed body.
  });
  assert.equal(result, 504); assert.equal(h.calls(), 0);
  assert.equal((await h.send()).status, 200);
});
