import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { registerRoutes } from "../src/routes/routes";

const sharedProductId = 4242;
const rimiProduct = {
  productId: sharedProductId,
  name: "Rimi rudzu maize",
  slug: "rimi-rudzu-maize-4242",
  store: "rimi",
  nutrition: { nutriScoreGrade: "A" },
  photos: [],
};
const maximaProduct = {
  productId: sharedProductId,
  name: "Maxima pilnpiena biezpiens",
  slug: "maxima-pilnpiena-biezpiens-4242",
  store: "maxima",
  nutrition: { nutriScoreGrade: "B" },
  photos: [],
};

let server: Server;
let baseUrl: string;

before(async () => {
  const app = express();
  server = await registerRoutes(app, {
    productPageStorage: {
      async getProductById(id, store) {
        assert.equal(id, sharedProductId);
        return (store === "maxima" ? maximaProduct : rimiProduct) as never;
      },
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test("each store's canonical slug serves the matching product page", async () => {
  for (const [slug, expectedName, unexpectedName] of [
    [rimiProduct.slug, rimiProduct.name, maximaProduct.name],
    [maximaProduct.slug, maximaProduct.name, rimiProduct.name],
  ]) {
    const response = await fetch(`${baseUrl}/lv/product/${slug}`, { redirect: "manual" });
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, new RegExp(`<h1[^>]*>${expectedName}</h1>`));
    assert.doesNotMatch(html, new RegExp(`<h1[^>]*>${unexpectedName}</h1>`));
  }
});

test("numeric and stale variants redirect to the preferred product slug", async () => {
  for (const variant of [String(sharedProductId), `outdated-product-name-${sharedProductId}`]) {
    const response = await fetch(`${baseUrl}/lv/product/${variant}`, { redirect: "manual" });

    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), `/lv/product/${rimiProduct.slug}`);
  }
});