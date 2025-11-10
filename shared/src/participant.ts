import { z } from "zod";

// Schéma de base pour un participant de tournoi
export const participantSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  userId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
  matchesPlayed: z.number().int().min(0),
  joinedAt: z.coerce.date(),
});

// Schéma pour l'inscription à un tournoi
export const joinTournamentSchema = z.object({
  tournamentId: z.string().uuid(),
});

// Schéma pour la réponse de l'inscription
export const joinTournamentResponseSchema = z.object({
  id: z.string().uuid(),
  tournamentId: z.string().uuid(),
  userId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
  matchesPlayed: z.number().int().min(0),
  joinedAt: z.coerce.date(),
  tournament: z.object({
    id: z.string().uuid(),
    name: z.string(),
    status: z.enum(["draft", "open", "ongoing", "finished"]),
    mode: z.enum(["championship", "bracket"]),
  }),
  user: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
  }),
});

// Schéma pour la liste des participants
export const participantListItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  teamId: z.string().uuid().nullable(),
  matchesPlayed: z.number().int().min(0),
  joinedAt: z.coerce.date(),
  user: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
  }),
});

// Types inférés
export type Participant = z.infer<typeof participantSchema>;
export type JoinTournamentRequest = z.infer<typeof joinTournamentSchema>;
export type JoinTournamentResponse = z.infer<typeof joinTournamentResponseSchema>;
export type ParticipantListItem = z.infer<typeof participantListItemSchema>;