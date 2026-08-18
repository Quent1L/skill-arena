import { describe, it, expect } from 'vitest'
import { playerLink } from '../player-link'

describe('playerLink', () => {
  it('simple link with no tournament', () => {
    expect(playerLink('p1')).toEqual({ path: '/players/p1', query: {} })
  })

  it('adds tournamentId to the query', () => {
    expect(playerLink('p1', 't42')).toEqual({
      path: '/players/p1',
      query: { tournamentId: 't42' },
    })
  })

  it('null tournamentId → empty query', () => {
    expect(playerLink('p1', null)).toEqual({ path: '/players/p1', query: {} })
  })
})
