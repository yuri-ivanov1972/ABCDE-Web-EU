import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
import { test } from "node:test";
import app from "../src/app";

test("real Express app handles exact MCP before redirects, CORS and JSON parsing", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const send = (host: string, origin?: string, method = "POST") =>
    new Promise<{ status: number; body: string; headers: Record<string, unknown> }>((resolve, reject) => {
      const req = request(base + "/mcp?destination=https://evil.test", {
        method, headers: {
          Host: host, "Content-Type": "application/json",
          ...(origin ? { Origin: origin } : {}),
        },
      }, res => {
        const chunks: Buffer[] = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => resolve({
          status: res.statusCode!, body: Buffer.concat(chunks).toString(), headers: res.headers,
        }));
      });
      req.on("error", reject);
      req.end("{not JSON");
    });
  try {
    // If redirects or parsers ran first these would be 301 or parse-error 400.
    for (const host of ["evil.test", "www.abcde.lv", "nutri-score.lv"]) {
      const r = await send(host);
      assert.equal(r.status, 403);
      assert.equal(r.headers["location"], undefined);
      assert.equal(r.headers["cache-control"], "no-store");
      assert.ok(!r.body.includes("not JSON"));
    }
    const badOrigin = await send("abcde.lv", "https://evil.test");
    assert.equal(badOrigin.status, 403);
    const preflight = await send("abcde.lv", "https://claude.ai", "OPTIONS");
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://claude.ai");
    assert.ok(!preflight.headers["access-control-allow-credentials"]);
    assert.equal((await send("abcde.lv", undefined, "PUT")).status, 405);
    const health = await fetch(base + "/api/healthz");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    const manifest = await fetch(base + "/ai-catalog.json");
    assert.equal(manifest.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
