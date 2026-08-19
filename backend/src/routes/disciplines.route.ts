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
import { requireSuperAdmin } from "../middleware/require-role";
import { createAppHono } from "../types/hono";
import i18next from "../config/i18n";

const disciplines = createAppHono();

const TAGS = ["Disciplines"];

// POST /disciplines - Create new discipline
disciplines.post(
  "/",
  requireAuth,
  requireSuperAdmin,
  describe({
    tags: TAGS,
    summary: "Create a discipline",
    auth: true,
    role: true,
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
    description:
      "Archived disciplines are omitted unless includeArchived=true, which the admin screens use to offer a restore.",
    success: { description: "Every discipline", schema: disciplineListSchema },
  }),
  async (c) => {
    const includeArchived = c.req.query("includeArchived") === "true";
    const disciplinesList = await disciplineService.listDisciplines(includeArchived);
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
  requireSuperAdmin,
  describe({
    tags: TAGS,
    summary: "Update a discipline",
    auth: true,
    role: true,
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

// POST /disciplines/:id/archive - Archive discipline (non-destructive retirement)
disciplines.post(
  "/:id/archive",
  requireAuth,
  requireSuperAdmin,
  describe({
    tags: TAGS,
    summary: "Archive a discipline",
    description:
      "Hides the discipline from every selector while keeping it resolvable, so competitions played under it keep their points and MMR.",
    auth: true,
    role: true,
    notFound: true,
    conflict: true,
    success: { description: "The archived discipline", schema: disciplineSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const discipline = await disciplineService.archiveDiscipline(id, c.get("appUserId"));
    return c.json(discipline);
  }
);

// POST /disciplines/:id/restore - Restore an archived discipline
disciplines.post(
  "/:id/restore",
  requireAuth,
  requireSuperAdmin,
  describe({
    tags: TAGS,
    summary: "Restore an archived discipline",
    auth: true,
    role: true,
    notFound: true,
    conflict: true,
    success: { description: "The restored discipline", schema: disciplineSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const discipline = await disciplineService.restoreDiscipline(id);
    return c.json(discipline);
  }
);

// DELETE /disciplines/:id - Delete discipline
disciplines.delete(
  "/:id",
  requireAuth,
  requireSuperAdmin,
  describe({
    tags: TAGS,
    summary: "Delete a discipline",
    description:
      "Only while nothing references it. A discipline used by a tournament, a rule or a match answers 409 with the blocking resources; archive it instead.",
    auth: true,
    role: true,
    notFound: true,
    conflict: true,
    success: { description: "Deletion outcome", schema: mutationResultSchema },
  }),
  async (c) => {
    const id = c.req.param("id")!;
    const result = await disciplineService.deleteDiscipline(id);
    return c.json(result);
  }
);

export default disciplines;
