import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDatabasePool, requireDatabaseUrl } from "./database.js";

const pool = createDatabasePool(requireDatabaseUrl());

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize this project's migration runs; released at commit/rollback.
    await client.query("SELECT pg_advisory_xact_lock($1)", [741203]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "name TEXT PRIMARY KEY, checksum TEXT NOT NULL, " +
      "applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );

    const directory = resolve("migrations");
    const names = (await readdir(directory))
      .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
      .sort();

    if (names.length === 0) {
      throw new Error("No SQL migrations found. Run this command from server/.");
    }

    for (const name of names) {
      const sql = await readFile(resolve(directory, name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name = $1",
        [name],
      );

      if (previous.rows.length > 0) {
        if (previous.rows[0]!.checksum !== checksum) {
          throw new Error("Applied migration was edited: " + name);
        }
        continue;
      }

      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, checksum],
      );
    }

    await client.query("COMMIT");
    console.log("Database migrations are up to date.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
