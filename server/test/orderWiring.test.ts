import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { ScenarioService } from "../src/scenarioService.js";
import { InMemoryScenarioRepository } from "../src/scenarioRepository.js";
import { OrderService } from "../src/orderService.js";
import type { Order } from "../src/order.js";
import type { OrderRepository } from "../src/orderRepository.js";

test("main app mounts the order router and preserves scenario routes", async () => {
  const orders = new Map<string, Order>();
  const repository: OrderRepository = {
    async createOrReplay(order, _key) {
      orders.set(order.id, order);
      return { order, replayed: false };
    },
    async findById(id) { return orders.get(id); },
  };
  const app = createApp(
    new ScenarioService(new InMemoryScenarioRepository()),
    new OrderService(repository),
  );
  const created = await request(app).post("/api/orders")
    .send({ productCode: "BOOK-01", quantity: 2 }).expect(201);
  const found = await request(app).get(created.headers.location).expect(200);
  assert.deepEqual(found.body.data, created.body.data);
  await request(app).get("/api/scenarios").expect(200);
});
