import { z } from "zod";

import {
  createDefaultExecution,
  scenarioExecutionSchema,
} from "./scenarioExecution.js";

export const createScenarioSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  attemptTimeoutMs: z.number().int().min(100).max(10_000),
  maxAttempts: z.number().int().min(1).max(5),
  execution: scenarioExecutionSchema.default(createDefaultExecution),
}).superRefine((scenario, context) => {
  const fault = scenario.execution.fault;

  if (
    fault.kind !== "none" &&
    fault.firstAttempts > scenario.maxAttempts
  ) {
    context.addIssue({
      code: "custom",
      path: ["execution", "fault", "firstAttempts"],
      message: "firstAttempts cannot exceed maxAttempts.",
    });
  }
});

export type CreateScenarioInput =
  z.input<typeof createScenarioSchema>;

export type ParsedScenarioInput =
  z.output<typeof createScenarioSchema>;

export type Scenario = Readonly<
  ParsedScenarioInput & {
    id: string;
    createdAt: string;
  }
>;