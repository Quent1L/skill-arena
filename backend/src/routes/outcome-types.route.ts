import { z } from "zod";
import { validate } from "../api/validator";
import { describe } from "../api/describe";
import { outcomeTypeService } from "../services/outcome-type.service";
import {
  createOutcomeTypeSchema,
  updateOutcomeTypeSchema,
  outcomeTypeSchema,
  outcomeTypeListSchema,
  mutationResultSchema,
} from "@skol-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const outcomeTypes = createAppHono();

const TAGS = ["Outcome types"];

// POST /outcome-types - Create new outcome type
outcomeTypes.post(
  "/",
  requireAuth,
  describe({
    tags: TAGS,
    summary: "Create an outcome type",
    auth: true,
    notFound: true,
    success: { status: 201, description: "Outcome type created", schema: outcomeTypeSchema },
  }),
  validate("json", createOutcomeTypeSchema),
  async (c) => {
    const data = c.req.valid("json");
    const outcomeType = await outcomeTypeService.createOutcomeType(data);
    return c.json(outcomeType, 201);
  }
);

// GET /outcome-types - List all outcome types (with optional disciplineId filter)
outcomeTypes.get(
  "/",
  describe({
    tags: TAGS,
    summary: "List outcome types",
    success: { description: "Matching outcome types", schema: outcomeTypeListSchema },
  }),
  validate("query", z.object({ disciplineId: z.string().optional() })),
  async (c) => {
    const { disciplineId } = c.req.valid("query");
    const outcomeTypesList = await outcomeTypeService.listOutcomeTypes(disciplineId);
    return c.json(outcomeTypesList);
  }
);

// GET /outcome-types/:id - Get single outcome type
outcomeTypes.get(
  "/:id",
  describe({
    tags: TAGS,
    summary: "Get an outcome type",
    notFound: true,
    success: { description: "The outcome type", schema: outcomeTypeSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const outcomeType = await outcomeTypeService.getOutcomeTypeById(id);
    return c.json(outcomeType);
  }
);

// PATCH /outcome-types/:id - Update outcome type
outcomeTypes.patch(
  "/:id",
  requireAuth,
  describe({
    tags: TAGS,
    summary: "Update an outcome type",
    auth: true,
    notFound: true,
    success: { description: "The updated outcome type", schema: outcomeTypeSchema },
  }),
  validate("json", updateOutcomeTypeSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");
    const outcomeType = await outcomeTypeService.updateOutcomeType(id, data);
    return c.json(outcomeType);
  }
);

// DELETE /outcome-types/:id - Delete outcome type
outcomeTypes.delete(
  "/:id",
  requireAuth,
  describe({
    tags: TAGS,
    summary: "Delete an outcome type",
    auth: true,
    notFound: true,
    success: { description: "Deletion outcome", schema: mutationResultSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const result = await outcomeTypeService.deleteOutcomeType(id);
    return c.json(result);
  }
);

export default outcomeTypes;
