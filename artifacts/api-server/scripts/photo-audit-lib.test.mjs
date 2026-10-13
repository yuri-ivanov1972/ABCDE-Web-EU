import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { allowedUrl, classifyStatus, csvCell, extractReplacement, checkImage } from "./photo-audit-lib.mjs";

test("classifies access denial separately from stale URL and rate limits", () => {
  assert.equal(classifyStatus(403), "access_denied");
  assert.equal(classifyStatus(404), "not_found");
  assert.equal(classifyStatus(429), "rate_limited");
  assert.equal(classifyStatus(502), "temporary_failure");
});

test("rejects unknown hosts, credentials, HTTP, and unexpected ports", () => {
  const hosts = new Set(["cdn.barbora.lv"]);
  assert.equal(allowedUrl("https://cdn.barbora.lv/a.png", hosts), true);
  for (const url of ["http://cdn.barbora.lv/a", "https://evil.test/a",
    "https://user:password@cdn.barbora.lv/a", "https://cdn.barbora.lv:8080/a"]) {
    assert.equal(allowedUrl(url, hosts), false);
  }
});

test("escapes CSV and prevents formula execution", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
});

test("extracts only allowlisted image candidates regardless of attribute order", () => {
  assert.equal(extractReplacement('<meta content="https://cdn.barbora.lv/new.png" property="og:image">', "https://barbora.lv/produkti/a"),
    "https://cdn.barbora.lv/new.png");
  assert.equal(extractReplacement('<meta property="og:image" content="https://evil.test/a">', "https://barbora.lv/a"), null);
});

test("decodes valid images and rejects HTML and forbidden responses", async () => {
  const original = globalThis.fetch;
  const png = await sharp({ create: { width: 3, height: 3, channels: 3, background: "red" } }).png().toBuffer();
  try {
    globalThis.fetch = async () => new Response(png, { headers: { "content-type": "image/png" } });
    assert.equal((await checkImage("https://cdn.barbora.lv/a")).result, "healthy");
    globalThis.fetch = async () => new Response("<html>denied</html>", { headers: { "content-type": "text/html" } });
    assert.equal((await checkImage("https://cdn.barbora.lv/a")).result, "invalid_image");
    globalThis.fetch = async () => new Response("", { status: 403 });
    assert.equal((await checkImage("https://cdn.barbora.lv/a")).result, "access_denied");
    globalThis.fetch = async () => new Response("", { status: 302, headers: { location: "https://evil.test/a" } });
    assert.equal((await checkImage("https://cdn.barbora.lv/a")).result, "unsupported_host");
  } finally { globalThis.fetch = original; }
});
