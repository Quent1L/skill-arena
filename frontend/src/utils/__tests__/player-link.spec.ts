import { describe, it, expect } from 'vitest'
import { playerLink } from '../player-link'

describe('playerLink', () => {
  it('lien simple sans tournoi', () => {
    expect(playerLink('p1')).toEqual({ path: '/players/p1', query: {} })
  })

  it('ajoute tournamentId en query', () => {
    expect(playerLink('p1', 't42')).toEqual({
      path: '/players/p1',
      query: { tournamentId: 't42' },
    })
  })

  it('null tournamentId → query vide', () => {
    expect(playerLink('p1', null)).toEqual({ path: '/players/p1', query: {} })
  })
})
