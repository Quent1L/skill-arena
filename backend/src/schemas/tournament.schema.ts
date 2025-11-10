import { joinTournamentSchema, type JoinTournamentRequest } from "@skill-arena/shared/dist/participant";

// Re-export des schémas et types depuis le package partagé
export {
  tournamentModeSchema,
  teamModeSchema,
  tournamentStatusSchema,
  createTournamentSchema,
  createTournamentRequestSchema,
  updateTournamentSchema,
  changeTournamentStatusSchema,
  listTournamentsQuerySchema,
  type CreateTournamentInput,
  type CreateTournamentRequestData,
  type UpdateTournamentInput,
  type ChangeTournamentStatusInput,
  type ListTournamentsQuery,
} from "@skill-arena/shared";

// Re-export des types participants
export { joinTournamentSchema, type JoinTournamentRequest };
