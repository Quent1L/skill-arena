import { z } from "zod";

export const generateInvitationCodeSchema = z.object({
  maxUses: z.number().int().min(1).optional().default(1),
  expiresInDays: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export const validateInvitationCodeSchema = z.object({
  code: z.string().length(32, "Invitation code must be 32 characters"),
});

export const consumeInvitationCodeSchema = z.object({
  code: z.string().length(32, "Invitation code must be 32 characters"),
});

export type GenerateInvitationCodeInput = z.infer<typeof generateInvitationCodeSchema>;
export type ValidateInvitationCodeInput = z.infer<typeof validateInvitationCodeSchema>;
export type ConsumeInvitationCodeInput = z.infer<typeof consumeInvitationCodeSchema>;
