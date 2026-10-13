import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  sleep, checkImage, download, csvCell, extractReplacement, allowedUrl, IMAGE_HOSTS,
} from "./photo-audit-lib.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const OUTPUT = resolve(ROOT, "generated-artifacts/maxima-photo-audit");
const API = "https://abcde.lv/api";
const SITE_HOSTS = new Set(["abcde.lv"]);
const RETAILER_HOSTS = new Set(["barbora.lv", "www.barbora.lv"]);
const columns = [
  "store", "product_id", "product_name", "website_url", "retailer_url",
  "photo_id", "is_primary", "image_url", "source_status", "source_http_status",
  "proxy_status", "proxy_http_status", "failure_reason", "checked_at",
  "suggested_replacement_url", "replacement_status",
];

async function atomicJson(name, value) {
  const file = resolve(OUTPUT, name);
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2));
  await rename(`${file}.tmp`, file);
}

async function loadJson(name, fallback) {
  try { return JSON.parse(await readFile(resolve(OUTPUT, name), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

// One start every 600 ms across BOTH workers and all image/proxy/page requests.
let lastStart = 0;
let gate = Promise.resolve();
function paced(operation) {
  const turn = gate.then(async () => {
    await sleep(Math.max(0, lastStart + 600 - Date.now()));
    lastStart = Date.now();
  });
  gate = turn.catch(() => {});
  return turn.then(operation);
}

async function apiPage(page) {
  const url = `${API}/products?store=maxima&page=${page}&pageSize=100&sortBy=name&sortOrder=asc`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await paced(() => download(url, SITE_HOSTS, 20 * 1024 * 1024));
    if (result.result === "downloaded") {
      const data = JSON.parse(result.buffer.toString("utf8"));
      if (!Array.isArray(data.products) || !Number.isFinite(data.totalCount)) {
        throw new Error("Unexpected catalogue response; audit stopped.");
      }
      return data;
    }
    if (result.result === "rate_limited") throw new Error("Catalogue rate limited; rerun later.");
    if (attempt === 2) throw new Error(`Catalogue page ${page} failed: ${result.result}`);
    await sleep(5000 * (attempt + 1));
  }
}

async function inventory() {
  let state = await loadJson("inventory.json", { nextPage: 1, complete: false, products: [] });
  if (state.complete) return state;
  while (!state.complete) {
    const page = await apiPage(state.nextPage);
    state.totalReported = page.totalCount;
    const byId = new Map(state.products.map(product => [product.productId, product]));
    for (const product of page.products) {
      if (product.store !== "maxima") throw new Error("Non-Maxima product returned; audit stopped.");
      // Keep only public catalogue metadata; never store credentials or image bodies.
      byId.set(product.productId, {
        productId: product.productId, name: product.name, slug: product.slug,
        externalUrl: product.externalUrl ?? "", photos: product.photos ?? [],
      });
    }
    state.products = [...byId.values()];
    state.complete = state.nextPage * 100 >= page.totalCount || page.products.length === 0;
    if (state.nextPage >= 500 && !state.complete) throw new Error("API pagination limit exceeded.");
    state.nextPage++;
    state.snapshotTime = new Date().toISOString();
    await atomicJson("inventory.json", state);
    console.log(`Inventory: ${state.products.length}/${page.totalCount} exposed Maxima products`);
  }
  if (state.products.length !== state.totalReported) {
    console.warn("Inventory count differs from API total; catalogue changed or pagination was unstable.");
  }
  return state;
}

const cached = new Map();
const denied = new Map();
const pausedHosts = new Set();
let rateLimited = false;

async function imageCheck(url, proxy = false) {
  let host;
  try { host = new URL(url).hostname; } catch { return { result: "invalid_url" }; }
  const key = `${proxy ? "proxy:" : "source:"}${url}`;
  if (cached.has(key)) return cached.get(key);
  const promise = (async () => {
    if (rateLimited || pausedHosts.has(host)) {
      return { result: "not_checked_host_paused" };
    }
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await paced(() => checkImage(url, proxy ? SITE_HOSTS : IMAGE_HOSTS));
      if (result.result === "rate_limited") {
        rateLimited = true;
        break;
      }
      if (!["temporary_failure", "network_error", "timeout", "not_found"].includes(result.result)) break;
      if (attempt === 0) await sleep(4000);
    }
    if (result.result === "access_denied") {
      denied.set(host, (denied.get(host) ?? 0) + 1);
      if (denied.get(host) >= 8) {
        pausedHosts.add(host);
        console.warn(`Paused ${host}: repeated access denials; remaining URLs are NOT marked broken.`);
      }
    } else if (result.result === "healthy") {
      denied.set(host, 0);
    }
    return result;
  })();
  cached.set(key, promise);
  return promise;
}

async function replacement(product, oldUrl) {
  if (!allowedUrl(product.externalUrl, RETAILER_HOSTS) || rateLimited ||
      pausedHosts.has("cdn.barbora.lv")) return { url: "", status: "needs_review" };
  const response = await paced(() => download(product.externalUrl, RETAILER_HOSTS, 2 * 1024 * 1024));
  if (response.result === "rate_limited") rateLimited = true;
  if (response.result !== "downloaded") return { url: "", status: `retailer_${response.result}` };
  const candidate = extractReplacement(response.buffer.toString("utf8"), product.externalUrl);
  if (!candidate || candidate === oldUrl) return { url: "", status: "no_new_candidate" };
  const check = await imageCheck(candidate);
  return {
    url: check.result === "healthy" ? candidate : "",
    status: check.result === "healthy" ? "candidate_requires_identity_review" : `candidate_${check.result}`,
  };
}

function csv(rows) {
  return "\ufeff" + columns.join(",") + "\n" +
    rows.map(row => columns.map(column => csvCell(row[column])).join(",")).join("\n") + "\n";
}

async function reports(state, rows, complete) {
  const counts = {};
  for (const row of rows) counts[row.source_status] = (counts[row.source_status] ?? 0) + 1;
  const issues = rows.filter(row => row.source_status !== "healthy" || row.proxy_status !== "healthy");
  await writeFile(resolve(OUTPUT, "all-photos.csv"), csv(rows));
  await writeFile(resolve(OUTPUT, "photos-needing-review.csv"), csv(issues));
  await atomicJson("summary.json", {
    complete, generatedAt: new Date().toISOString(), scope: "Maxima products exposed by the public API",
    inventoryProducts: state.products.length, apiReportedProducts: state.totalReported,
    checkedRows: rows.length, issueRows: issues.length, sourceResults: counts,
    pausedHosts: [...pausedHosts], rateLimited,
    notes: [
      "Read-only. No product or photo data was changed.",
      "403 means access denied, NOT proof that the stored URL is stale.",
      "Paused or deferred checks are inconclusive, not failed photos.",
      "HTTP checks run from the workspace, not the production proxy location.",
      "Source and proxy checks may differ because the proxy serves cached images.",
      "Replacement candidates require product-identity review before applying.",
      "Decodable placeholder images are not detected by this audit.",
      "Catalogue pagination is not a transactional snapshot; concurrent edits can affect coverage.",
    ],
  });
}

export async function main() {
  await mkdir(OUTPUT, { recursive: true });
  const state = await inventory();
  const saved = await loadJson("results.json", []);
  const rows = [...saved];
  const done = new Set(rows.map(row => `${row.product_id}:${row.photo_id}`));
  const jobs = state.products.flatMap(product => {
    const photos = product.photos.length ? product.photos : [{ photoId: "", photoUrl: "", isPrimary: false }];
    return photos.map(photo => ({ product, photo }));
  }).filter(({ product, photo }) => !done.has(`${product.productId}:${photo.photoId}`));
  let index = 0;
  let saves = Promise.resolve();
  const save = complete => {
    // Serialize checkpoints so overlapping workers cannot overwrite newer results.
    const snapshot = [...rows];
    saves = saves.then(async () => {
      await atomicJson("results.json", snapshot);
      await reports(state, snapshot, complete);
    });
    return saves;
  };
  await save(false);
  await Promise.all([0, 1].map(async () => {
    while (index < jobs.length) {
      const { product, photo } = jobs[index++];
      const url = photo.photoUrl?.trim() ?? "";
      const source = url ? await imageCheck(url) : { result: "missing_url" };
      const proxy = url && allowedUrl(url, new Set(["cdn.barbora.lv"])) &&
        source.result !== "not_checked_host_paused" && !rateLimited
        ? await imageCheck(`${API}/image-proxy?url=${encodeURIComponent(url)}&w=300`, true)
        : { result: url ? "not_checked" : "not_applicable" };
      const suggestion = ["missing_url", "not_found"].includes(source.result)
        ? await replacement(product, url) : { url: "", status: "" };
      rows.push({
        store: "maxima", product_id: product.productId, product_name: product.name,
        website_url: product.slug ? `https://abcde.lv/lv/product/${encodeURIComponent(product.slug)}` : "",
        retailer_url: product.externalUrl, photo_id: photo.photoId, is_primary: photo.isPrimary,
        image_url: url, source_status: source.result, source_http_status: source.status,
        proxy_status: proxy.result, proxy_http_status: proxy.status,
        failure_reason: source.result !== "healthy" ? source.result :
          proxy.result !== "healthy" ? `proxy_${proxy.result}` : "",
        checked_at: new Date().toISOString(), suggested_replacement_url: suggestion.url,
        replacement_status: suggestion.status,
      });
      if (rows.length % 25 === 0) {
        console.log(`Photo audit: ${rows.length}/${rows.length + jobs.length - index} rows processed`);
        await save(false);
      }
    }
  }));
  await save(true);
  console.log("Audit finished. Reports: generated-artifacts/maxima-photo-audit/");
  console.log(await readFile(resolve(OUTPUT, "summary.json"), "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    // Do not print upstream bodies or configuration values.
    console.error(`Audit stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
