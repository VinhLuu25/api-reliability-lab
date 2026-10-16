import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

import type { CreateScenarioInput } from "../src/scenario.js";
import {
  InMemoryScenarioRepository,
} from "../src/scenarioRepository.js";
import type {
  ScenarioRepository,
} from "../src/scenarioRepository.js";
import { ScenarioService } from "../src/scenarioService.js";

const validInput: CreateScenarioInput = {
  title: "Slow API test",
  attemptTimeoutMs: 1000,
  maxAttempts: 3,
};

test("creates a scenario and makes it available in storage", async () => {
  // Arrange: prepare the objects this test needs.
  const repository = new InMemoryScenarioRepository();
  const service = new ScenarioService(repository);

  // Act: perform the operation being tested.
  const scenario = await service.create(validInput);

  // Assert: check its observable results.
  assert.equal(scenario.title, validInput.title);
  assert.equal(
    scenario.attemptTimeoutMs,
    validInput.attemptTimeoutMs,
  );
  assert.equal(scenario.maxAttempts, validInput.maxAttempts);

  assert.equal(typeof scenario.id, "string");
  assert.notEqual(scenario.id, "");

  assert.equal(
    Number.isNaN(Date.parse(scenario.createdAt)),
    false,
  );

  const storedScenario = await repository.findById(scenario.id);

  assert.deepEqual(storedScenario, scenario);
});

test("rejects creation when storage fails", async () => {
  const repository: ScenarioRepository = {
    async save(_scenario) {
      throw new Error("Storage unavailable");
    },

    async findAll() {
      return [];
    },

    async findById(_id) {
      return undefined;
    },
  };

  const service = new ScenarioService(repository);

  await assert.rejects(
    () => service.create(validInput),
    { message: "Storage unavailable" },
  );
});

test("waits for saving to finish before creation succeeds", async () => {
  const events: string[] = [];

  const repository: ScenarioRepository = {
    async save(_scenario) {
      // Make saving finish asynchronously.
      await setImmediate();
      events.push("save finished");
    },

    async findAll() {
      return [];
    },

    async findById(_id) {
      return undefined;
    },
  };

  const service = new ScenarioService(repository);

  await service.create(validInput);
  events.push("create returned");

  // Also allow an incorrectly unawaited save to finish.
  await setImmediate();

  assert.deepEqual(events, [
    "save finished",
    "create returned",
  ]);
});