import type { Pool } from "pg";
import { z } from "zod";
import type { Scenario } from "./scenario.js";
import type { ScenarioRepository } from "./scenarioRepository.js";

type ScenarioRow = {
  id: string;
  title: string;
  attempt_timeout_ms: number;
  max_attempts: number;
  created_at: Date;
};

const columns =
  "id, title, attempt_timeout_ms, max_attempts, created_at";
const scenarioIdSchema = z.uuid();

function toScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    title: row.title,
    attemptTimeoutMs: row.attempt_timeout_ms,
    maxAttempts: row.max_attempts,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresScenarioRepository implements ScenarioRepository {
  constructor(private readonly pool: Pool) {}

  async save(scenario: Scenario): Promise<void> {
    await this.pool.query(
      "INSERT INTO scenarios (" + columns + ") VALUES ($1, $2, $3, $4, $5)",
      [
        scenario.id,
        scenario.title,
        scenario.attemptTimeoutMs,
        scenario.maxAttempts,
        scenario.createdAt,
      ],
    );
  }

  async findAll(): Promise<Scenario[]> {
    const result = await this.pool.query<ScenarioRow>(
      "SELECT " + columns + " FROM scenarios ORDER BY created_at, id",
    );
    return result.rows.map(toScenario);
  }

  async findById(id: string): Promise<Scenario | undefined> {
    // Preserve the API's missing-scenario behavior for non-UUID paths.
    if (!scenarioIdSchema.safeParse(id).success) {
      return undefined;
    }

    const result = await this.pool.query<ScenarioRow>(
      "SELECT " + columns + " FROM scenarios WHERE id = $1",
      [id],
    );
    const row = result.rows[0];
    return row ? toScenario(row) : undefined;
  }
}
