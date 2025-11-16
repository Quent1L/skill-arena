import { zValidator } from "@hono/zod-validator";
import { outcomeReasonService } from "../services/outcome-reason.service";
import {
  createOutcomeReasonSchema,
  updateOutcomeReasonSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const outcomeReasons = createAppHono();

// POST /outcome-reasons - Create new outcome reason
outcomeReasons.post(
  "/",
  requireAuth,
  zValidator("json", createOutcomeReasonSchema),
  async (c) => {
    const data = c.req.valid("json");
    const outcomeReason = await outcomeReasonService.createOutcomeReason(data);
    return c.json(outcomeReason, 201);
  }
);

// GET /outcome-reasons - List all outcome reasons (with optional outcomeTypeId filter)
outcomeReasons.get("/", async (c) => {
  const outcomeTypeId = c.req.query("outcomeTypeId");
  const outcomeReasonsList = await outcomeReasonService.listOutcomeReasons(
    outcomeTypeId
  );
  return c.json(outcomeReasonsList);
});

// GET /outcome-reasons/:id - Get single outcome reason
outcomeReasons.get("/:id", async (c) => {
  const id = c.req.param("id");
  const outcomeReason = await outcomeReasonService.getOutcomeReasonById(id);
  return c.json(outcomeReason);
});

// PATCH /outcome-reasons/:id - Update outcome reason
outcomeReasons.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateOutcomeReasonSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const outcomeReason = await outcomeReasonService.updateOutcomeReason(
      id,
      data
    );
    return c.json(outcomeReason);
  }
);

// DELETE /outcome-reasons/:id - Delete outcome reason
outcomeReasons.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const result = await outcomeReasonService.deleteOutcomeReason(id);
  return c.json(result);
});

export default outcomeReasons;

