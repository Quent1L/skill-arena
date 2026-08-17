import { z } from "zod";
import { validate } from "../api/validator";
import { describe } from "../api/describe";
import { disciplineService } from "../services/discipline.service";
import {
  createDisciplineSchema,
  updateDisciplineSchema,
  disciplineSchema,
  disciplineListSchema,
  teamInteractionModeOptionSchema,
  mutationResultSchema,
  TEAM_INTERACTION_MODES,
} from "@skol-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";
import i18next from "../config/i18n";

const disciplines = createAppHono();

const TAGS = ["Disciplines"];

// POST /disciplines - Create new discipline
disciplines.post(
  "/",
  requireAuth,
  describe({
    tags: TAGS,
    summary: "Create a discipline",
    auth: true,
    success: { status: 201, description: "Discipline created", schema: disciplineSchema },
  }),
  validate("json", createDisciplineSchema),
  async (c) => {
    const data = c.req.valid("json");
    const discipline = await disciplineService.createDiscipline(data);
    return c.json(discipline, 201);
  }
);

// GET /disciplines - List all disciplines
disciplines.get(
  "/",
  describe({
    tags: TAGS,
    summary: "List disciplines",
    success: { description: "Every discipline", schema: disciplineListSchema },
  }),
  async (c) => {
    const disciplinesList = await disciplineService.listDisciplines();
    return c.json(disciplinesList);
  }
);

// GET /disciplines/interaction-modes - List team interaction mode options (i18n labels)
disciplines.get(
  "/interaction-modes",
  describe({
    tags: TAGS,
    summary: "List team interaction modes",
    description: "Labels are translated using the request's Accept-Language.",
    success: {
      description: "Available modes with translated labels",
      schema: z.array(teamInteractionModeOptionSchema),
    },
  }),
  (c) => {
    const lang = c.get("lang");
    return c.json(
      TEAM_INTERACTION_MODES.map((value) => ({
        value,
        label: String(i18next.t(`disciplines.interaction_modes.${value}`, { lng: lang })),
      }))
    );
  }
);

// GET /disciplines/:id - Get single discipline
disciplines.get(
  "/:id",
  describe({
    tags: TAGS,
    summary: "Get a discipline",
    notFound: true,
    success: { description: "The discipline", schema: disciplineSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const discipline = await disciplineService.getDisciplineById(id);
    return c.json(discipline);
  }
);

// PATCH /disciplines/:id - Update discipline
disciplines.patch(
  "/:id",
  requireAuth,
  describe({
    tags: TAGS,
    summary: "Update a discipline",
    auth: true,
    notFound: true,
    success: { description: "The updated discipline", schema: disciplineSchema },
  }),
  validate("json", updateDisciplineSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const data = c.req.valid("json");
    const discipline = await disciplineService.updateDiscipline(id, data);
    return c.json(discipline);
  }
);

// DELETE /disciplines/:id - Delete discipline
disciplines.delete(
  "/:id",
  requireAuth,
  describe({
    tags: TAGS,
    summary: "Delete a discipline",
    auth: true,
    notFound: true,
    success: { description: "Deletion outcome", schema: mutationResultSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const result = await disciplineService.deleteDiscipline(id);
    return c.json(result);
  }
);

export default disciplines;
