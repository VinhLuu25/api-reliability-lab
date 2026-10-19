import type { Order, OrderResult } from "./order.js";

export interface OrderRepository {
  // The implementation must enforce keyed creation atomically across callers.
  createOrReplay(order: Order, key?: string): Promise<OrderResult>;
  findById(id: string): Promise<Order | undefined>;
}
