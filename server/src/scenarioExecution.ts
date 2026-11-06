import { z } from "zod";
import { createOrderSchema } from "./order.js";

const firstAttempts = z.number().int().min(1).max(5);

export const scenarioFaultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("none"),
  }),

  z.strictObject({
    kind: z.literal("drop_response_after_commit"),
    firstAttempts,
  }),

  z.strictObject({
    kind: z.literal("delay_response_after_commit"),
    firstAttempts,
    delayMs: z.number().int().min(1).max(10_000),
  }),

  z.strictObject({
    kind: z.literal("temporary_unavailable"),
    firstAttempts,
  }),
]);

export const scenarioExecutionSchema = z.strictObject({
  order: createOrderSchema,

  idempotencyMode: z.enum(["keyed", "unkeyed"]),

  fault: scenarioFaultSchema,

  deadlineMs: z.number().int().min(100).max(60_000),

  retry: z
    .strictObject({
      baseDelayMs: z.number().int().min(0).max(5_000),
      maxDelayMs: z.number().int().min(0).max(5_000),
    })
    .refine((retry) => retry.baseDelayMs <= retry.maxDelayMs, {
      path: ["maxDelayMs"],
      message: "maxDelayMs must be at least baseDelayMs.",
    }),

  expectedOrderCount: z.number().int().min(0).max(5),
});

export type ScenarioExecution = z.infer<typeof scenarioExecutionSchema>;

export function createDefaultExecution(): ScenarioExecution {
  return {
    order: {
      productCode: "BOOK-01",
      quantity: 2,
    },
    idempotencyMode: "keyed",
    fault: {
      kind: "none",
    },
    deadlineMs: 30_000,
    retry: {
      baseDelayMs: 200,
      maxDelayMs: 1_000,
    },
    expectedOrderCount: 1,
  };
}
