import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import request from "supertest";

import { createApp } from "../../src/app.js";
import { createDatabasePool, requireDatabaseUrl } from "../../src/database.js";
import { PostgresScenarioRepository } from "../../src/postgresScenarioRepository.js";
import { ScenarioService } from "../../src/scenarioService.js";
import type { Scenario } from "../../src/scenario.js";

const databaseUrl = requireDatabaseUrl();
if (new URL(databaseUrl).pathname !== "/reliability_lab_test") {
  throw new Error("Database tests require the dedicated reliability_lab_test database.");
}

const pool = createDatabasePool(databaseUrl);
after(async () => { await pool.end(); });

test("persists a scenario for a newly constructed API using another pool", async (t) => {
  const repository = new PostgresScenarioRepository(pool);
  const firstApp = createApp(new ScenarioService(repository));

  const created = await request(firstApp)
    .post("/api/scenarios")
    .send({
      title: "Customer's checkout",
      attemptTimeoutMs: 1000,
      maxAttempts: 3,
    })
    .expect(201);

  const scenario = created.body.data as Scenario;
  t.after(async () => {
    await pool.query("DELETE FROM scenarios WHERE id = $1", [scenario.id]);
  });

  assert.equal(scenario.title, "Customer's checkout");
  assert.equal(scenario.attemptTimeoutMs, 1000);
  assert.equal(scenario.maxAttempts, 3);
  assert.equal(created.headers.location, "/api/scenarios/" + scenario.id);

  const secondPool = createDatabasePool(databaseUrl);
  try {
    const secondRepository = new PostgresScenarioRepository(secondPool);
    const secondApp = createApp(new ScenarioService(secondRepository));

    const retrieved = await request(secondApp)
      .get("/api/scenarios/" + scenario.id)
      .expect(200);

    assert.deepEqual(retrieved.body.data, scenario);
    const listed = await secondRepository.findAll();
    assert.deepEqual(listed.find((item) => item.id === scenario.id), scenario);
  } finally {
    await secondPool.end();
  }
});

test("PostgreSQL rejects an invalid attempt count even without API validation", async (t) => {
  const repository = new PostgresScenarioRepository(pool);
  const scenario: Scenario = {
    id: randomUUID(),
    title: "Invalid direct database write",
    attemptTimeoutMs: 1000,
    maxAttempts: 6,
    createdAt: new Date().toISOString(),
  };

  t.after(async () => {
    await pool.query("DELETE FROM scenarios WHERE id = $1", [scenario.id]);
  });

  await assert.rejects(repository.save(scenario), { code: "23514" });
  assert.equal(await repository.findById(scenario.id), undefined);
});

test("missing scenarios return 404 for UUID and non-UUID paths", async () => {
  const repository = new PostgresScenarioRepository(pool);
  const app = createApp(new ScenarioService(repository));

  for (const id of [randomUUID(), "missing-scenario"]) {
    const response = await request(app)
      .get("/api/scenarios/" + id)
      .expect(404);
    assert.equal(response.body.error.code, "SCENARIO_NOT_FOUND");
  }
});
