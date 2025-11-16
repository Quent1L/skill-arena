import { zValidator } from "@hono/zod-validator";
import { outcomeTypeService } from "../services/outcome-type.service";
import {
  createOutcomeTypeSchema,
  updateOutcomeTypeSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const outcomeTypes = createAppHono();

// POST /outcome-types - Create new outcome type
outcomeTypes.post(
  "/",
  requireAuth,
  zValidator("json", createOutcomeTypeSchema),
  async (c) => {
    const data = c.req.valid("json");
    const outcomeType = await outcomeTypeService.createOutcomeType(data);
    return c.json(outcomeType, 201);
  }
);

// GET /outcome-types - List all outcome types (with optional disciplineId filter)
outcomeTypes.get("/", async (c) => {
  const disciplineId = c.req.query("disciplineId");
  const outcomeTypesList = await outcomeTypeService.listOutcomeTypes(
    disciplineId
  );
  return c.json(outcomeTypesList);
});

// GET /outcome-types/:id - Get single outcome type
outcomeTypes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const outcomeType = await outcomeTypeService.getOutcomeTypeById(id);
  return c.json(outcomeType);
});

// PATCH /outcome-types/:id - Update outcome type
outcomeTypes.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateOutcomeTypeSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const outcomeType = await outcomeTypeService.updateOutcomeType(id, data);
    return c.json(outcomeType);
  }
);

// DELETE /outcome-types/:id - Delete outcome type
outcomeTypes.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const result = await outcomeTypeService.deleteOutcomeType(id);
  return c.json(result);
});

export default outcomeTypes;

