export type BracketTreeType = "winner" | "loser" | "grand_final";

export interface BracketMatch {
  id?: string;
  tournamentId: string;
  round: number;
  sequence: number;
  bracketType: BracketTreeType;
  matchPosition: number;
  teamAId?: string;
  teamBId?: string;
  nextMatchWinId?: string;
  nextMatchLoseId?: string;
}

export interface BracketParticipant {
  teamId: string;
  seed?: number;
}
