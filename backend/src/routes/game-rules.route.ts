import { zValidator } from "@hono/zod-validator";
import { gameRulesService } from "../services/game-rules.service";
import {
  createGameRuleSchema,
  updateGameRuleSchema,
} from "@skill-arena/shared/types/index";
import { requireAuth } from "../middleware/auth";
import { createAppHono } from "../types/hono";

const gameRules = createAppHono();

// GET /game-rules - List all game rules (auth required)
gameRules.get("/", requireAuth, async (c) => {
  const rules = await gameRulesService.listGameRules();
  return c.json(rules);
});

// POST /game-rules - Create a new game rule
gameRules.post(
  "/",
  requireAuth,
  zValidator("json", createGameRuleSchema),
  async (c) => {
    const data = c.req.valid("json");
    const appUserId = c.get("appUserId");
    const rule = await gameRulesService.createGameRule({
      ...data,
      createdBy: appUserId,
    });
    return c.json(rule, 201);
  }
);

// GET /game-rules/:id - Get single game rule (public)
gameRules.get("/:id", async (c) => {
  const id = c.req.param("id");
  const rule = await gameRulesService.getGameRuleById(id);
  return c.json(rule);
});

// PATCH /game-rules/:id - Update game rule
gameRules.patch(
  "/:id",
  requireAuth,
  zValidator("json", updateGameRuleSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const appUserId = c.get("appUserId");
    const rule = await gameRulesService.updateGameRule(id, appUserId, data);
    return c.json(rule);
  }
);

// DELETE /game-rules/:id - Delete game rule
gameRules.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id");
  const appUserId = c.get("appUserId");
  await gameRulesService.deleteGameRule(id, appUserId);
  return c.json({ success: true });
});

export default gameRules;
