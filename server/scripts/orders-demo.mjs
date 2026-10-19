import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = "http://127.0.0.1:" + (process.env.PORT ?? "3001");
const run = randomUUID();
const body = { productCode: "demo_" + run, quantity: 2 };
async function create(key, quantity = 2) {
  const headers = { "Content-Type": "application/json" };
  if (key !== undefined) headers["Idempotency-Key"] = key;
  const response = await fetch(base + "/api/orders", {
    method: "POST", headers, body: JSON.stringify({ ...body, quantity }),
  });
  const json = await response.json();
  console.log(response.status, json.data?.id ?? json.error?.code,
    "replayed=" + response.headers.get("Idempotency-Replayed"));
  return { status: response.status, ...json };
}
console.log("A. No key: identical requests create different orders.");
const a = await create();
const b = await create();
assert.equal(a.status, 201);
assert.equal(b.status, 201);
assert.notEqual(a.data.id, b.data.id);

console.log("B. Same key and body: the second request returns the original order.");
const c = await create(run);
const d = await create(run);
assert.equal(c.status, 201);
assert.equal(d.status, 200);
assert.deepEqual(c.data, d.data);

console.log("C. Same key, different quantity: reject the conflicting operation.");
const conflict = await create(run, 3);
assert.equal(conflict.status, 409);
assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

console.log("D. Twelve simultaneous retries with a fresh key.");
const parallelKey = randomUUID();
const responses = await Promise.all(Array.from({ length: 12 }, () => create(parallelKey)));
assert.equal(responses.filter((r) => r.status === 201).length, 1);
assert.equal(responses.filter((r) => r.status === 200).length, 11);
assert.equal(new Set(responses.map((r) => r.data.id)).size, 1);
console.log("All live-API assertions passed.");
console.log("This run created four development orders for productCode:", body.productCode);
console.log("These demonstration records are retained. The integration tests clean up their own records.");
console.log("For actual dropped-response experiments, run npm run test:orders in another terminal.");
