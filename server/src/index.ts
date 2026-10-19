import { OrderService } from "./orderService.js";
import { PostgresOrderRepository } from "./postgresOrderRepository.js";
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createDatabasePool, requireDatabaseUrl } from "./database.js";
import { PostgresScenarioRepository } from "./postgresScenarioRepository.js";
import { ScenarioService } from "./scenarioService.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const pool = createDatabasePool(requireDatabaseUrl());
const repository = new PostgresScenarioRepository(pool);
const service = new ScenarioService(repository);
// Orders lesson: wire persistent order storage.
const orderService = new OrderService(new PostgresOrderRepository(pool));
const server = createServer(createApp(service, orderService));

try {
  // Fail startup clearly if PostgreSQL is unavailable or not migrated.
  await pool.query("SELECT id FROM scenarios LIMIT 0");
  await pool.query("SELECT id FROM orders LIMIT 0");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
} catch (error) {
  await pool.end();
  throw error;
}

console.log("API listening at http://127.0.0.1:" + port);

let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;

  // Bound shutdown if an active request cannot finish.
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
    clearTimeout(deadline);
  } catch (error) {
    console.error("Shutdown failed:", error);
    process.exit(1);
  }
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
