import { z } from "zod";

export const createOrderSchema = z.object({
  productCode: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  quantity: z.number().int().min(1).max(100),
}).strict();

export const idempotencyKeySchema = z.string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/);

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export type Order = CreateOrderInput & {
  id: string;
  createdAt: string;
};

export type OrderResult = {
  order: Order;
  replayed: boolean;
};

export class IdempotencyConflictError extends Error {
  constructor() {
    super("This idempotency key was already used with different order data.");
    this.name = "IdempotencyConflictError";
  }
}
