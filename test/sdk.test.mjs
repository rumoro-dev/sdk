import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as exported from "../dist/index.js";

const { createRumoro, DEFAULT_BASE_URL } = exported;
const operations = Object.values(JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8")).paths)
  .flatMap((methods) => Object.values(methods).map((operation) => operation.operationId)).sort();

/** A client whose fetch records each request and answers with `reply(request)`. */
function recorded(reply = () => Response.json({ ok: true }), options = {}) {
  const requests = [];
  const fetch = async (input, init) => { const request = new Request(input, init); requests.push(request); return reply(request); };
  return { rumoro: createRumoro({ apiKey: "ref_test", fetch, ...options }), requests };
}

test("one function per operation, named as the operationIds, bound and exported", () => {
  assert.equal(operations.length, 80);
  const { rumoro } = recorded();
  assert.deepEqual(Object.keys(rumoro).filter((name) => name !== "client").sort(), operations);
  for (const name of operations) assert.equal(typeof exported[name], "function", name);
  assert.equal(typeof rumoro.client.interceptors.response.use, "function");
  assert.equal(DEFAULT_BASE_URL, "https://api.rumoro.dev");
});

test("requests: base URL, bearer key, headers, path, list queries and JSON bodies", async () => {
  const { rumoro, requests } = recorded(() => Response.json({}), { headers: { "x-request-id": "sdk-request-0001" } });
  await rumoro.whoami();
  await rumoro.listKeywords({ query: { kind: ["brand", "topic"], limit: 5 } });
  await rumoro.updateKeyword({ path: { id: "kw_1" }, body: { muted: true } });
  const [whoami, list, update] = requests;
  assert.equal(whoami.url, "https://api.rumoro.dev/v1/whoami");
  assert.equal(whoami.headers.get("authorization"), "Bearer ref_test");
  assert.equal(whoami.headers.get("x-request-id"), "sdk-request-0001");
  assert.equal(new URL(list.url).search, "?kind=brand&kind=topic&limit=5");
  assert.deepEqual([update.method, new URL(update.url).pathname, update.headers.get("content-type"), await update.json()],
    ["PATCH", "/v1/keywords/kw_1", "application/json", { muted: true }]);
  // getHealth is public: no key is sent.
  await rumoro.getHealth();
  assert.equal(requests.at(-1).headers.get("authorization"), null);
});

test("another deployment's base URL, without its trailing slash", async () => {
  const { rumoro, requests } = recorded(undefined, { baseUrl: "http://127.0.0.1:3000/api/" });
  await rumoro.listChannels();
  assert.equal(requests[0].url, "http://127.0.0.1:3000/api/v1/channels");
});

test("errors: an envelope by default, an exception with throwOnError", async () => {
  const envelope = { error: { code: "duplicate_keyword", message: "Already tracked", requestId: "req_1" } };
  const { rumoro } = recorded(() => Response.json(envelope, { status: 409 }));
  const result = await rumoro.createKeyword({ body: { term: "acme", kind: "brand" } });
  assert.deepEqual([result.data, result.error, result.response.status], [undefined, envelope, 409]);
  await assert.rejects(rumoro.createKeyword({ body: { term: "acme", kind: "brand" }, throwOnError: true }), (error) => {
    assert.deepEqual(error, envelope);
    return true;
  });
});

test("a call's own client wins over the bound one", async () => {
  const first = recorded(), second = recorded();
  await first.rumoro.listAlerts({ client: second.rumoro.client });
  assert.deepEqual([first.requests.length, second.requests.length], [0, 1]);
});
