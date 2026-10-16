import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import {
  InMemoryScenarioRepository,
} from "../src/scenarioRepository.js";
import { ScenarioService } from "../src/scenarioService.js";

const validInput = {
  title: "Slow API test",
  attemptTimeoutMs: 1000,
  maxAttempts: 3,
};

function createTestApp() {
  const repository = new InMemoryScenarioRepository();
  const service = new ScenarioService(repository);

  return createApp(service);
}

test("creates, retrieves, and lists a scenario", async () => {
  const app = createTestApp();

  const created = await request(app)
    .post("/api/scenarios")
    .send({
      ...validInput,
      title: "  Slow API test  ",
    })
    .expect(201);

  const scenario = created.body.data;

  assert.equal(scenario.title, "Slow API test");
  assert.equal(scenario.attemptTimeoutMs, 1000);
  assert.equal(scenario.maxAttempts, 3);

  assert.equal(typeof scenario.id, "string");
  assert.notEqual(scenario.id, "");

  assert.equal(
    created.headers.location,
    `/api/scenarios/${scenario.id}`,
  );

  const retrieved = await request(app)
    .get(`/api/scenarios/${scenario.id}`)
    .expect(200);

  assert.deepEqual(retrieved.body.data, scenario);

  const listed = await request(app)
    .get("/api/scenarios")
    .expect(200);

  assert.deepEqual(listed.body.data, [scenario]);
});

test("rejects a string maxAttempts without saving anything", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/scenarios")
    .send({
      ...validInput,
      maxAttempts: "three",
    })
    .expect(400);

  assert.equal(
    response.body.error.code,
    "INVALID_SCENARIO",
  );

  const listed = await request(app)
    .get("/api/scenarios")
    .expect(200);

  assert.deepEqual(listed.body.data, []);
});

test("rejects maxAttempts above the allowed maximum", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/scenarios")
    .send({
      ...validInput,
      maxAttempts: 6,
    })
    .expect(400);

  assert.equal(
    response.body.error.code,
    "INVALID_SCENARIO",
  );
});

test("rejects a title longer than 120 characters", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/scenarios")
    .send({
      ...validInput,
      title: "x".repeat(121),
    })
    .expect(400);

  assert.equal(
    response.body.error.code,
    "INVALID_SCENARIO",
  );
});

test("returns INVALID_JSON for malformed JSON", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/scenarios")
    .set("Content-Type", "application/json")
    .send('{"title":')
    .expect(400);

  assert.equal(
    response.body.error.code,
    "INVALID_JSON",
  );
});

test("returns 404 when the scenario does not exist", async () => {
  const app = createTestApp();

  const response = await request(app)
    .get("/api/scenarios/missing-scenario")
    .expect(404);

  assert.equal(
    response.body.error.code,
    "SCENARIO_NOT_FOUND",
  );
});

test("accepts a title of exactly 120 characters", async () => {
  const app = createTestApp();
  const title = "x".repeat(120);

  const response = await request(app)
    .post("/api/scenarios")
    .send({
      ...validInput,
      title,
    })
    .expect(201);

  const scenario = response.body.data;

  // Check that creation preserves the title we supplied.
  assert.equal(scenario.title, title);

  const retrieved = await request(app)
    .get(`/api/scenarios/${scenario.id}`)
    .expect(200);

  // Check that storage and retrieval preserve it too.
  assert.equal(retrieved.body.data.title, title);
});