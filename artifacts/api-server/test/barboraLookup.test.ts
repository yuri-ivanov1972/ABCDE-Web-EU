import assert from "node:assert/strict";
import { test } from "node:test";
import { createBarboraLookup, safeCanonicalIds, LookupFailure, type LookupRow } from "../src/lib/barboraLookup";
import { createBarboraDatabase } from "../src/lib/barboraDatabase";

const sku = "000000000000790928";
const row: LookupRow = { sku, product_id: 6741, name: "Skābais krējums VALMIERA 20% 450g", nutri_score_grade: "D" };
const signal = () => new AbortController().signal;
const safeLinkIds = async (rows: LookupRow[]) => new Set(rows.map(r => r.product_id));

test("missing or malformed optional DB configuration fails explicitly without crashing", async () => {
  for (const maximaUrl of [undefined, "not-a-connection-string"]) {
    const source = createBarboraDatabase({ maximaUrl, rimiUrl: undefined });
    await assert.rejects(source.rows([sku], signal()), /lookup_unavailable/);
    assert.equal((await source.safeLinkIds([row], signal())).size, 0);
  }
});

test("exact zero-padded strings, bounded cached misses, TTL and no extra fields", async () => {
  let calls = 0; let time = 0;
  const lookup = createBarboraLookup({
    rows: async ids => { calls++; assert.deepEqual(ids, [sku, "000000000000000000"]); return [row]; },
    safeLinkIds,
  }, { now: () => time, ttlMs: 100 });
  const result = await lookup([sku, sku, "000000000000000000"], signal());
  assert.deepEqual(result, { products: { [sku]: { nutri_score: "D",
    abcde_url: "https://abcde.lv/lv/product/skabais-krejums-valmiera-20-450g-6741" } } });
  await lookup([sku, "000000000000000000"], signal()); assert.equal(calls, 1);
  time = 101; await lookup([sku, "000000000000000000"], signal()); assert.equal(calls, 2);
});

test("ambiguous duplicates never select the first valid grade", async () => {
  for (const second of ["A", "D", null]) {
    const lookup = createBarboraLookup({ rows: async () => [row, { ...row, nutri_score_grade: second }], safeLinkIds });
    assert.deepEqual(await lookup([sku], signal()), { products: {} });
  }
});

test("missing, invalid, lowercase and non-A–E grades get no badge", async () => {
  for (const grade of [null, "", " ", "a", "F"]) {
    const lookup = createBarboraLookup({ rows: async () => [{ ...row, nutri_score_grade: grade }], safeLinkIds });
    assert.deepEqual(await lookup([sku], signal()), { products: {} });
  }
});

test("all five grades are returned as letters without recalculation", async () => {
  for (const grade of ["A", "B", "C", "D", "E"]) {
    const lookup = createBarboraLookup({ rows: async () => [{ ...row, nutri_score_grade: grade }], safeLinkIds });
    assert.equal((await lookup([sku], signal())).products[sku]?.nutri_score, grade);
  }
});

test("failure and aborted requests never populate the missing cache", async () => {
  let calls = 0;
  const lookup = createBarboraLookup({ rows: async () => {
    if (++calls === 1) throw new Error("private database error");
    return [row];
  }, safeLinkIds });
  await assert.rejects(lookup([sku], signal()));
  assert.ok((await lookup([sku], signal())).products[sku]);
  assert.equal(calls, 2);
  const controller = new AbortController(); controller.abort(new LookupFailure("lookup_timeout"));
  await assert.rejects(lookup([sku], controller.signal), /lookup_timeout/);
});

test("overflow and unsolicited source records fail closed", async () => {
  for (const rows of [Array(201).fill(row), [{ ...row, sku: "999999999999999999" }]]) {
    const lookup = createBarboraLookup({ rows: async () => rows, safeLinkIds });
    await assert.rejects(lookup([sku], signal()), /lookup_unavailable/);
  }
});

test("bounded LRU eviction requires re-fetching evicted keys", async () => {
  let calls = 0;
  const lookup = createBarboraLookup({ rows: async ids => { calls++; return ids.map(sku => ({ ...row, sku })); }, safeLinkIds },
    { capacity: 1 });
  await lookup([sku], signal()); await lookup(["000000000000800999"], signal());
  await lookup([sku], signal()); assert.equal(calls, 3);
});

test("link failure and store slug collisions remove links, never use Rimi grades", async () => {
  assert.equal(safeCanonicalIds([row], [{ product_id: row.product_id, name: row.name }]).size, 0);
  assert.equal(safeCanonicalIds([row], [{ product_id: row.product_id, name: "Different product" }]).size, 1);
  assert.equal(safeCanonicalIds([row], [{ product_id: row.product_id, name: row.name },
    { product_id: row.product_id, name: "Other" }]).size, 0);
  const lookup = createBarboraLookup({ rows: async () => [row], safeLinkIds: async () => { throw new Error("unavailable"); } });
  assert.deepEqual(await lookup([sku], signal()), { products: { [sku]: { nutri_score: "D" } } });
});

test("untrusted or empty slug text cannot become arbitrary links or HTML", async () => {
  const lookup = createBarboraLookup({ rows: async () => [{ ...row, name: "https://evil.test/<script>" }], safeLinkIds });
  const result = await lookup([sku], signal());
  assert.match(result.products[sku]!.abcde_url!, /^https:\/\/abcde\.lv\/lv\/product\/https-evil-test-script-6741$/);
  const noName = createBarboraLookup({ rows: async () => [{ ...row, name: "😀" }], safeLinkIds });
  assert.deepEqual(await noName([sku], signal()), { products: { [sku]: { nutri_score: "D" } } });
});
