import { createOrderRouter } from "./orderRouter.js";
import type { OrderService } from "./orderService.js";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { createScenarioSchema } from "./scenario.js";
import type { ScenarioService } from "./scenarioService.js";

// Orders lesson: optional dependency preserves existing scenario tests.
export function createApp(service: ScenarioService, orderService?: OrderService) {
  const app = express();

  app.use(express.json({ limit: "16kb" }));

  if (orderService) {
    app.use("/api/orders", createOrderRouter(orderService));
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "api-reliability-lab",
    });
  });

  app.post("/api/scenarios", async (req, res) => {
    const result = createScenarioSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: {
          code: "INVALID_SCENARIO",
          message: "The scenario configuration is invalid.",
          issues: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
      return;
    }

    const scenario = await service.create(result.data);

    res
      .status(201)
      .location(`/api/scenarios/${scenario.id}`)
      .json({ data: scenario });
  });

  app.get("/api/scenarios", async (_req, res) => {
    const scenarios = await service.list();
    res.json({ data: scenarios });
  });

  app.get("/api/scenarios/:id", async (req, res) => {
    const scenario = await service.getById(req.params.id);

    if (!scenario) {
      res.status(404).json({
        error: {
          code: "SCENARIO_NOT_FOUND",
          message: "Scenario not found.",
        },
      });
      return;
    }

    res.json({ data: scenario });
  });

  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found.",
      },
    });
  });

  const errorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    next,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const errorType =
      typeof error === "object" &&
      error !== null &&
      "type" in error
        ? error.type
        : undefined;

    if (errorType === "entity.parse.failed") {
      res.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "The request body must contain valid JSON.",
        },
      });
      return;
    }

    if (errorType === "entity.too.large") {
      res.status(413).json({
        error: {
          code: "BODY_TOO_LARGE",
          message: "The request body exceeds the allowed size.",
        },
      });
      return;
    }

    console.error("Unhandled request error:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected server error occurred.",
      },
    });
  };

  app.use(errorHandler);

  return app;
}