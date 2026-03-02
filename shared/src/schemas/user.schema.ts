import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50),
  shortName: z.string().min(1).max(5).transform((v) => v.toUpperCase()),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
