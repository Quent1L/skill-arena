import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { MiddlewareHandler } from "hono";
import { createAppHono, type AppVariables } from "../../types/hono";
import { requireAuth } from "../../middleware/auth";
import { userRepository } from "../../repository/user.repository";
import { ForbiddenError, ErrorCode } from "../../types/errors";
import { rulesService } from "../../services/rules.service";
import { createRuleSchema, testRuleSchema, updateRuleSchema } from "@skill-arena/shared";
import type { RuleScope, RuleType } from "@skill-arena/shared";

const adminRules = createAppHono();

const requireSuperAdmin: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const appUserId = c.get("appUserId");
  const currentUser = await userRepository.getById(appUserId);
  if (currentUser?.role !== "super_admin") {
    throw new ForbiddenError(ErrorCode.INSUFFICIENT_PERMISSIONS);
  }
  await next();
};

const listFiltersSchema = z.object({
  type: z.enum(["message", "badge"]).optional(),
  triggerEvent: z.string().optional(),
  scope: z.enum(["global", "discipline"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

adminRules.use("*", requireAuth, requireSuperAdmin);

adminRules.get("/catalog", (c) => {
  const triggerEvent = c.req.query("triggerEvent") ?? "match_submitted";
  return c.json(rulesService.getCatalog(triggerEvent));
});

adminRules.post("/test", zValidator("json", testRuleSchema), async (c) => {
  const { conditions, action, context } = c.req.valid("json");
  const result = await rulesService.test(conditions, action, context);
  return c.json(result);
});

adminRules.get("/", zValidator("query", listFiltersSchema), async (c) => {
  const filters = c.req.valid("query");
  const rules = await rulesService.list({
    type: filters.type as RuleType | undefined,
    triggerEvent: filters.triggerEvent,
    scope: filters.scope as RuleScope | undefined,
    isActive: filters.isActive,
  });
  return c.json(rules);
});

adminRules.post("/", zValidator("json", createRuleSchema), async (c) => {
  const data = c.req.valid("json");
  const appUserId = c.get("appUserId");
  const rule = await rulesService.create(data, appUserId);
  return c.json(rule, 201);
});

adminRules.get("/:id", async (c) => {
  const rule = await rulesService.getById(c.req.param("id")!);
  return c.json(rule);
});

adminRules.patch("/:id", zValidator("json", updateRuleSchema), async (c) => {
  const rule = await rulesService.update(c.req.param("id")!, c.req.valid("json"));
  return c.json(rule);
});

adminRules.delete("/:id", async (c) => {
  await rulesService.delete(c.req.param("id")!);
  return c.body(null, 204);
});

export default adminRules;
