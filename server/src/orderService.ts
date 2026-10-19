import { randomUUID } from "node:crypto";
import type { CreateOrderInput, OrderResult } from "./order.js";
import type { OrderRepository } from "./orderRepository.js";

export class OrderService {
  constructor(private readonly repository: OrderRepository) {}

  async create(input: CreateOrderInput, key?: string): Promise<OrderResult> {
    const candidate = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    // Return the repository's result: a replay must return the original ID/time.
    return await this.repository.createOrReplay(candidate, key);
  }

  async findById(id: string) {
    return await this.repository.findById(id);
  }
}
