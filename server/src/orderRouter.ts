import { Router } from "express";
import type { Response } from "express";
import {
  createOrderSchema,
  idempotencyKeySchema,
  IdempotencyConflictError,
} from "./order.js";
import type { OrderResult } from "./order.js";
import type { OrderService } from "./orderService.js";

export type OrderRouterOptions = {
  // Dependency-injected test hook; no HTTP header enables it.
  // Returning false means the hook deliberately ended/dropped the response.
  beforeReply?: (result: OrderResult, response: Response) =>
    boolean | Promise<boolean>;
};

export function createOrderRouter(
  service: OrderService,
  options: OrderRouterOptions = {},
) {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const input = createOrderSchema.safeParse(req.body);
      if (!input.success) {
        res.status(400).json({ error: {
          code: "INVALID_ORDER",
          message: "Use productCode (1-64 letters, digits, _ or -) and quantity (1-100).",
        } });
        return;
      }

      const suppliedKey = req.get("Idempotency-Key");
      if (suppliedKey !== undefined &&
          !idempotencyKeySchema.safeParse(suppliedKey).success) {
        res.status(400).json({ error: {
          code: "INVALID_IDEMPOTENCY_KEY",
          message: "Use 1-128 letters, digits, underscores, or hyphens.",
        } });
        return;
      }

      const result = await service.create(input.data, suppliedKey);
      if (options.beforeReply &&
          !await options.beforeReply(result, res)) return;

      res.status(result.replayed ? 200 : 201)
        .location("/api/orders/" + result.order.id)
        .set("Idempotency-Replayed", String(result.replayed))
        .json({ data: result.order });
    } catch (error) {
      if (error instanceof IdempotencyConflictError) {
        res.status(409).json({ error: {
          code: "IDEMPOTENCY_CONFLICT",
          message: error.message,
        } });
        return;
      }
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const order = await service.findById(req.params.id as string);
      if (!order) {
        res.status(404).json({ error: {
          code: "ORDER_NOT_FOUND", message: "Order not found.",
        } });
        return;
      }
      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
