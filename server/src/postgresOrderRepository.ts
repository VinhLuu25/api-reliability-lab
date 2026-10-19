import type { Pool } from "pg";
import { z } from "zod";
import { IdempotencyConflictError } from "./order.js";
import type { Order, OrderResult } from "./order.js";
import type { OrderRepository } from "./orderRepository.js";

type OrderRow = {
  id: string;
  product_code: string;
  quantity: number;
  created_at: Date;
};

const columns = "id, product_code, quantity, created_at";
const idSchema = z.uuid();

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    productCode: row.product_code,
    quantity: row.quantity,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async createOrReplay(candidate: Order, key?: string): Promise<OrderResult> {
    // PostgreSQL's UNIQUE constraint arbitrates competing inserts.
    // NULL keys do not conflict: unkeyed requests deliberately create new rows.
    const inserted = await this.pool.query<OrderRow>(
      "INSERT INTO orders (id, product_code, quantity, created_at, idempotency_key) " +
      "VALUES ($1, $2, $3, $4, $5) " +
      "ON CONFLICT (idempotency_key) DO NOTHING RETURNING " + columns,
      [candidate.id, candidate.productCode, candidate.quantity,
        candidate.createdAt, key ?? null],
    );

    const newRow = inserted.rows[0];
    if (newRow) return { order: toOrder(newRow), replayed: false };

    if (key === undefined) {
      throw new Error("An unkeyed insert unexpectedly returned no order.");
    }

    // Separate statement: a fresh READ COMMITTED snapshot can see the winner
    // after ON CONFLICT has waited for its transaction to commit.
    // Orders are immutable in this milestone: there is no update/delete API.
    const existing = await this.pool.query<OrderRow>(
      "SELECT " + columns + " FROM orders WHERE idempotency_key = $1",
      [key],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new Error("The winning idempotent order is no longer available.");
    }

    if (row.product_code !== candidate.productCode ||
        row.quantity !== candidate.quantity) {
      throw new IdempotencyConflictError();
    }
    return { order: toOrder(row), replayed: true };
  }

  async findById(id: string): Promise<Order | undefined> {
    if (!idSchema.safeParse(id).success) return undefined;
    const result = await this.pool.query<OrderRow>(
      "SELECT " + columns + " FROM orders WHERE id = $1", [id],
    );
    const row = result.rows[0];
    return row ? toOrder(row) : undefined;
  }
}
