import { z } from "zod";

export const generateInvitationCodeSchema = z.object({
  maxUses: z.number().int().min(1).optional().default(1),
  expiresInDays: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export const validateInvitationCodeSchema = z.object({
  code: z.string().regex(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/, "Format du code invalide"),
});

export const consumeInvitationCodeSchema = z.object({
  code: z.string().regex(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/, "Format du code invalide"),
});

export type GenerateInvitationCodeInput = z.infer<typeof generateInvitationCodeSchema>;
export type ValidateInvitationCodeInput = z.infer<typeof validateInvitationCodeSchema>;
export type ConsumeInvitationCodeInput = z.infer<typeof consumeInvitationCodeSchema>;
