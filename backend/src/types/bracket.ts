export type BracketTreeType = "winner" | "loser" | "grand_final";

export interface BracketMatch {
  id?: string;
  tournamentId: string;
  round: number;
  sequence: number;
  bracketType: BracketTreeType;
  matchPosition: number;
  nextMatchWinId?: string;
  nextMatchLoseId?: string;
  // Participants are now handled via relation or derived from brackets manager
}

export interface BracketParticipant {
  id: string; // Generic ID (teamId or userId)
  name: string;
  seed?: number;
}
