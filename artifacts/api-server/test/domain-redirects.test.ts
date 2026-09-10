import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { get, type Server } from "node:http";
import app from "../src/app";

const NUTRI_SCORE_INFO_URL = "https://abcde.lv/lv/about-nutriscore";

let server: Server;
let port: number;

function request(path: string, hostname: string) {
  return new Promise<{ statusCode: number | undefined; location: string | undefined; body: string }>(
    (resolve, reject) => {
      get(
        {
          hostname: "127.0.0.1",
          port,
          path,
          headers: { host: hostname },
        },
        response => {
          response.setEncoding("utf8");
          let body = "";
          response.on("data", chunk => {
            body += chunk;
          });
          response.on("end", () => {
            resolve({
              statusCode: response.statusCode,
              location: response.headers.location,
              body,
            });
          });
        },
      ).on("error", reject);
    },
  );
}

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  assert(address && typeof address === "object");
  port = address.port;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test("Nutri-Score domains always redirect to the fixed information page", async () => {
  for (const hostname of ["nutri-score.lv", "nutriscore.lv"]) {
    for (const path of ["/", "/campaign/summer", "/offers?source=newsletter&item=42"]) {
      const response = await request(path, hostname);

      assert.equal(response.statusCode, 301, `${hostname}${path}`);
      assert.equal(response.location, NUTRI_SCORE_INFO_URL, `${hostname}${path}`);
    }
  }
});

test("abcde.lv requests continue past the alternate-domain middleware", async () => {
  const response = await request("/api/healthz?source=domain-test", "abcde.lv");

  assert.equal(response.statusCode, 200);
  assert.equal(response.location, undefined);
  assert.deepEqual(JSON.parse(response.body), { status: "ok" });
});