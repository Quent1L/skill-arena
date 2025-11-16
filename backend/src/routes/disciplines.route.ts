import { zValidator } from "@hono/zod-validator";
import { disciplineService } from "../services/discipline.service";
import {
  createDisciplineSchema,
  updateDisciplineSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const disciplines = createAppHono();

// POST /disciplines - Create new discipline
disciplines.post(
  "/",
  requireAuth,
  zValidator("json", createDisciplineSchema),
  async (c) => {
    const data = c.req.valid("json");
    const discipline = await disciplineService.createDiscipline(data);
    return c.json(discipline, 201);
  }
);

// GET /disciplines - List all disciplines
disciplines.get("/", async (c) => {
  const disciplinesList = await disciplineService.listDisciplines();
  return c.json(disciplinesList);
});

// GET /disciplines/:id - Get single discipline
disciplines.get("/:id", async (c) => {
  const id = c.req.param("id");
  const discipline = await disciplineService.getDisciplineById(id);
  return c.json(discipline);
});

// PATCH /disciplines/:id - Update discipline
disciplines.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateDisciplineSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const discipline = await disciplineService.updateDiscipline(id, data);
    return c.json(discipline);
  }
);

// DELETE /disciplines/:id - Delete discipline
disciplines.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const result = await disciplineService.deleteDiscipline(id);
  return c.json(result);
});

export default disciplines;

