// Explicit opt-in live check: three bounded, read-only tool calls per address.
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const target = process.argv[2];
if (!target) throw new Error("Pass a full endpoint URL; this check makes three live tool calls.");
const endpoint = new URL(target);
assert.equal(endpoint.pathname, "/mcp");
assert.ok(endpoint.protocol === "https:" || ["127.0.0.1", "localhost"].includes(endpoint.hostname));
assert.ok(!endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash);
const isProxy = endpoint.hostname !== "abcde-mcp.replit.app";
const events = [];
const checkedFetch = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: "manual",
    signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(50_000)]) : AbortSignal.timeout(50_000) });
  assert.ok(response.status < 300 || response.status >= 400, "Unexpected redirect");
  if (response.status === 202 || response.status === 204) {
    assert.equal(await response.clone().text(), "", "Acknowledgement must be empty");
  } else {
    assert.ok(!/text\/html/i.test(response.headers.get("content-type") ?? ""), "HTML is not MCP");
  }
  if (isProxy) assert.equal(response.headers.get("cache-control"), "no-store");
  events.push({ status: response.status, type: response.headers.get("content-type") });
  return response;
};
const transport = new StreamableHTTPClientTransport(endpoint, {
  requestInit: { headers: { Origin: "https://abcde.lv" } }, fetch: checkedFetch,
});
const client = new Client({ name: "abcde-website-release-check", version: "1.0.0" });
function validateTool(result) {
  assert.ok(!result.isError, "Tool returned an error");
  assert.ok(result.structuredContent, "Missing structured content");
  const texts = result.content.filter(block => block.type === "text");
  assert.ok(texts.some(block => {
    try { assert.deepEqual(JSON.parse(block.text), result.structuredContent); return true; }
    catch { return false; }
  }), "JSON text and structured data must agree");
  return result.structuredContent;
}
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ["build_basket", "get_product", "search_products"]);
  const product = validateTool(await client.callTool({ name: "get_product", arguments: { store: "rimi", product_id: 3975 } }));
  // Verify real catalogue fields wherever the upstream nests the product.
  const raw = JSON.stringify(product);
  assert.ok(raw.includes("3975") && /maize/i.test(raw), "Expected original product identity/name");
  assert.ok(/protein/i.test(raw) && /rimi\.lv/.test(raw), "Expected nutrition and retailer link");
  validateTool(await client.callTool({ name: "search_products", arguments: { query: "maize", store: "rimi", max_results: 2 } }));
  validateTool(await client.callTool({ name: "build_basket", arguments: {
    items: [{ store: "rimi", product_id: 3975, quantity: 1 }],
  } }));
  assert.ok(events.some(event => event.status === 202), "Initialized notification should succeed");
  console.log(JSON.stringify({
    endpoint: endpoint.href, sdk: "1.32.2", protocolVersion: transport.protocolVersion,
    server: client.getServerVersion(), tools: tools.tools.map(tool => tool.name),
    toolCalls: 3, structuredAndTextMatch: true, productIdentityNutritionAndLink: true,
    responses: events,
  }, null, 2));
} finally { await client.close(); }
