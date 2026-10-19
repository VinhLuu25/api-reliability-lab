import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import type { TestContext } from "node:test";
import express from "express";
import type { ErrorRequestHandler } from "express";
import request from "supertest";
import { createDatabasePool, requireDatabaseUrl } from "../../src/database.js";
import { OrderService } from "../../src/orderService.js";
import { PostgresOrderRepository } from "../../src/postgresOrderRepository.js";
import { createOrderRouter } from "../../src/orderRouter.js";
import type { OrderRouterOptions } from "../../src/orderRouter.js";
import type { OrderRepository } from "../../src/orderRepository.js";
import type { Order } from "../../src/order.js";
import { input } from "zod";

const url = requireDatabaseUrl();
if (new URL(url).pathname !== "/reliability_lab_test") {
  throw new Error("Order tests require reliability_lab_test.");
}

const pool = createDatabasePool(url);
after(async () => { await pool.end(); });

function makeApp(
  options: OrderRouterOptions = {},
  repository: OrderRepository = new PostgresOrderRepository(pool),
) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use("/api/orders", createOrderRouter(new OrderService(repository), options));
  const errors: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  };
  app.use(errors);
  return app;
}

function fixture(t: TestContext) {
  const productCode = "test_" + randomUUID();
  t.after(async () => {
    await pool.query("DELETE FROM orders WHERE product_code = $1", [productCode]);
  });
  return { productCode, quantity: 2 };
}

async function rowsFor(productCode: string) {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM orders WHERE product_code = $1 ORDER BY created_at, id",
    [productCode],
  );
  return result.rows;
}

test("orders: creates and retrieves an order through another pool", async (t) => {
  const input = fixture(t);
  const created = await request(makeApp()).post("/api/orders").send(input).expect(201);
  assert.equal(created.headers["idempotency-replayed"], "false");
  assert.equal(created.headers.location, "/api/orders/" + created.body.data.id);
  assert.equal(created.body.data.productCode, input.productCode);
  const otherPool = createDatabasePool(url);
  try {
    const app = makeApp({}, new PostgresOrderRepository(otherPool));
    const found = await request(app).get(created.headers.location).expect(200);
    assert.deepEqual(found.body.data, created.body.data);
  } finally { await otherPool.end(); }
});

test("orders: rejects invalid input and invalid keys without writes", async (t) => {
  const input = fixture(t);
  const app = makeApp();
  for (const quantity of [0, 101, 1.5, "2"]) {
    const response = await request(app).post("/api/orders")
      .send({ ...input, quantity }).expect(400);
    assert.equal(response.body.error.code, "INVALID_ORDER");
  }
  await request(app).post("/api/orders").send({ ...input, extra: true }).expect(400);
  const badKey = await request(app).post("/api/orders")
    .set("Idempotency-Key", "bad key!").send(input).expect(400);
  assert.equal(badKey.body.error.code, "INVALID_IDEMPOTENCY_KEY");
  assert.equal((await rowsFor(input.productCode)).length, 0);
});

test("orders: accepts quantity boundaries 1 and 100", async (t) => {
  const input = fixture(t);
  for (const quantity of [1, 100]) {
    const response = await request(makeApp()).post("/api/orders")
      .send({ ...input, quantity }).expect(201);
    assert.equal(response.body.data.quantity, quantity);
  }
});

test("orders: returns 404 for missing UUID and non-UUID IDs", async () => {
  for (const id of [randomUUID(), "missing"]) {
    const response = await request(makeApp()).get("/api/orders/" + id).expect(404);
    assert.equal(response.body.error.code, "ORDER_NOT_FOUND");
  }
});

test("orders: two unkeyed requests deliberately create two rows", async (t) => {
  const input = fixture(t);
  const app = makeApp();
  const first = await request(app).post("/api/orders").send(input).expect(201);
  const second = await request(app).post("/api/orders").send(input).expect(201);
  assert.notEqual(first.body.data.id, second.body.data.id);
  assert.equal((await rowsFor(input.productCode)).length, 2);
});

test("orders: same key and body replay the original order across app instances", async (t) => {
  const input = fixture(t);
  const key = randomUUID();
  const first = await request(makeApp()).post("/api/orders")
    .set("Idempotency-Key", key).send(input).expect(201);
  const replay = await request(makeApp()).post("/api/orders")
    .set("Idempotency-Key", key).send(input).expect(200);
  assert.deepEqual(replay.body.data, first.body.data);
  assert.equal(replay.headers["idempotency-replayed"], "true");
  assert.equal(replay.headers.location, first.headers.location);
  assert.equal((await rowsFor(input.productCode)).length, 1);
});

test("orders: same key and changed body return 409 without modifying the order", async (t) => {
  const input = fixture(t);
  const key = randomUUID();
  const app = makeApp();
  const first = await request(app).post("/api/orders")
    .set("Idempotency-Key", key).send(input).expect(201);
  const conflict = await request(app).post("/api/orders")
    .set("Idempotency-Key", key).send({ ...input, quantity: 3 }).expect(409);
  assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
  const found = await request(app).get(first.headers.location).expect(200);
  assert.deepEqual(found.body.data, first.body.data);
  assert.equal((await rowsFor(input.productCode)).length, 1);
});

test("orders: distinct keys allow identical intentional purchases", async (t) => {
  const input = fixture(t);
  const app = makeApp();
  for (let i = 0; i < 2; i++) {
    await request(app).post("/api/orders")
      .set("Idempotency-Key", randomUUID()).send(input).expect(201);
  }
  assert.equal((await rowsFor(input.productCode)).length, 2);
});

test("orders: 12 concurrent retries across two pools create exactly one row", async (t) => {
  const input = fixture(t);
  const key = randomUUID();
  const otherPool = createDatabasePool(url);
  try {
    const apps = [
      makeApp(),
      makeApp({}, new PostgresOrderRepository(otherPool)),
    ];
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      request(apps[index % 2]!).post("/api/orders")
        .set("Idempotency-Key", key).send(input),
    ));
    assert.equal(responses.filter((r) => r.status === 201).length, 1);
    assert.equal(responses.filter((r) => r.status === 200).length, 11);
    assert.equal(new Set(responses.map((r) => r.body.data.id)).size, 1);
    for (const response of responses) {
      assert.deepEqual(response.body.data, responses[0]!.body.data);
    }
    assert.equal((await rowsFor(input.productCode)).length, 1);
  } finally { await otherPool.end(); }
});

test("orders: concurrent conflicting payloads produce one winner and one conflict", async (t) => {
  const input = fixture(t);
  const key = randomUUID();
  const app = makeApp();
  const responses = await Promise.all([2, 3].map((quantity) =>
    request(app).post("/api/orders").set("Idempotency-Key", key)
      .send({ ...input, quantity }),
  ));
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await rowsFor(input.productCode)).length, 1);
});

test("orders: lost response without a key leads to duplicate orders on retry", async (t) => {
  const input = fixture(t);
  let savedId: string | undefined;
  let dropNext = true;
  const app = makeApp({
    beforeReply(result, response) {
      if (!dropNext) return true;
      dropNext = false;
      savedId = result.order.id;
      response.destroy(); // Actual connection closes AFTER saving.
      return false;
    },
  });
  await assert.rejects(async () => {
    await request(app).post("/api/orders").send(input);
  });
  assert.ok(savedId, "The hook must run after a successful save.");
  const beforeRetry = await rowsFor(input.productCode);
  assert.equal(beforeRetry.length, 1);
  assert.equal(beforeRetry[0]!.id, savedId);
  const retry = await request(app).post("/api/orders").send(input).expect(201);
  assert.notEqual(retry.body.data.id, savedId);
  assert.equal((await rowsFor(input.productCode)).length, 2);
});

test("orders: lost response with the same key recovers the original order", async (t) => {
  const input = fixture(t);
  const key = randomUUID();
  let savedId: string | undefined;
  let dropNext = true;
  const app = makeApp({
    beforeReply(result, response) {
      if (!dropNext) return true;
      dropNext = false;
      savedId = result.order.id;
      response.destroy();
      return false;
    },
  });
  await assert.rejects(async () => {
    await request(app).post("/api/orders").set("Idempotency-Key", key).send(input);
  });
  assert.ok(savedId);
  assert.equal((await rowsFor(input.productCode)).length, 1);
  const retry = await request(app).post("/api/orders")
    .set("Idempotency-Key", key).send(input).expect(200);
  assert.equal(retry.body.data.id, savedId);
  assert.equal(retry.headers["idempotency-replayed"], "true");
  assert.equal((await rowsFor(input.productCode)).length, 1);
});

test("orders: database constraints reject a direct invalid write", async (t) => {
  const input = fixture(t);
  const repository = new PostgresOrderRepository(pool);
  await assert.rejects(repository.createOrReplay({
    ...input, quantity: 0, id: randomUUID(), createdAt: new Date().toISOString(),
  }), { code: "23514" });
  assert.equal((await rowsFor(input.productCode)).length, 0);
});

test("orders: storage failure returns 500 and never reports creation success", async () => {
  const broken: OrderRepository = {
    async createOrReplay(_order: Order, _key?: string) {
      throw new Error("Storage unavailable");
    },
    async findById(_id: string) { return undefined; },
  };
  const response = await request(makeApp({}, broken)).post("/api/orders")
    .send({ productCode: "BOOK-01", quantity: 2 }).expect(500);
  assert.equal(response.body.error.code, "INTERNAL_ERROR");
});

test("orders: a test for reuse of a key with a different product code", async (t) => {
  const firstInput = fixture(t);
  const secondInput = fixture(t);
  const key = randomUUID();
  const app = makeApp();
  const first = await request(app).post("/api/orders")
    .set("Idempotency-Key", key).send(firstInput).expect(201);
  const conflict = await request(app).post("/api/orders")
    .set("Idempotency-Key", key).send(secondInput).expect(409);
  assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
  const found = await request(app).get(first.headers.location).expect(200);
  assert.deepEqual(found.body.data, first.body.data);
  assert.equal((await rowsFor(firstInput.productCode)).length, 1);
  assert.equal((await rowsFor(secondInput.productCode)).length, 0);
});