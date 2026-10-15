import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import app from "../src/app";

let server: Server;
let origin: string;

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
});

for (const path of [
  "/.well-known/ai-catalog.json",
  "/.well-known/ard.json",
  "/ai-catalog.json",
]) {
  test(`${path} returns a genuine 404, not the HTML fallback`, async () => {
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(`${origin}${path}?audit=1`, { method });
      assert.equal(response.status, 404);
      assert.match(response.headers.get("content-type") ?? "", /^text\/plain/);
      assert.equal(await response.text(), method === "HEAD" ? "" : "Not Found\n");
    }
  });
}
