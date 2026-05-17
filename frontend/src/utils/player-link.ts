import type { RouteLocationRaw } from 'vue-router'

export function playerLink(playerId: string, tournamentId?: string | null): RouteLocationRaw {
  return {
    path: `/players/${playerId}`,
    query: tournamentId ? { tournamentId } : {},
  }
}
