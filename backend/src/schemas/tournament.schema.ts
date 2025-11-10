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
