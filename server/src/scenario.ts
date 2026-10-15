import { z } from "zod";

export const createScenarioSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  attemptTimeoutMs: z.number().int().min(100).max(10_000),
  maxAttempts: z.number().int().min(1).max(5),
});

export type CreateScenarioInput =
  z.infer<typeof createScenarioSchema>;

export type Scenario = Readonly<
  CreateScenarioInput & {
    id: string;
    createdAt: string;
  }
>;