import pg from "pg";

export function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is required.");
  }
  return value;
}

export function createDatabasePool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 5000,
  });

  pool.on("error", (error) => {
    console.error("Unexpected error on an idle database connection:", error);
  });

  return pool;
}
