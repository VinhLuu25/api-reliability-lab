import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createDefaultExecution } from "../src/scenarioExecution.js";
import {
  InMemoryScenarioRepository,
} from "../src/scenarioRepository.js";
import { ScenarioService } from "../src/scenarioService.js";

function setup() {
  const repository = new InMemoryScenarioRepository();
  const service = new ScenarioService(repository);

  return {
    repository,
    app: createApp(service),
  };
}

test("legacy input receives complete execution defaults", async () => {
  const { app } = setup();

  const created = await request(app)
    .post("/api/scenarios")
    .send({
      title: "Legacy client",
      attemptTimeoutMs: 1000,
      maxAttempts: 3,
    })
    .expect(201);

  assert.deepEqual(
    created.body.data.execution,
    createDefaultExecution(),
  );

  const found = await request(app)
    .get(created.headers.location)
    .expect(200);

  assert.deepEqual(found.body.data, created.body.data);
});


test("rejects a fault affecting more attempts than allowed", async () => {
  const { app, repository } = setup();

  const response = await request(app)
    .post("/api/scenarios")
    .send({
      title: "Invalid fault plan",
      attemptTimeoutMs: 1000,
      maxAttempts: 3,
      execution: {
        ...createDefaultExecution(),
        fault: {
          kind: "temporary_unavailable",
          firstAttempts: 4,
        },
      },
    })
    .expect(400);

  assert.equal(response.body.error.code, "INVALID_SCENARIO");

  assert.ok(
    response.body.error.issues.some(
      (issue: { field: string }) =>
        issue.field === "execution.fault.firstAttempts",
    ),
  );

  assert.deepEqual(await repository.findAll(), []);
});
