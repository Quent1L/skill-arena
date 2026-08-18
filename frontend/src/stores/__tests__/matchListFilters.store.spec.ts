import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMatchListFiltersStore } from '../matchListFilters.store'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useMatchListFiltersStore', () => {
  it('initContext with the same key keeps the filters', () => {
    const store = useMatchListFiltersStore()
    store.initContext('t1')
    store.myMatchesActive = true
    store.selectedPlayers = [{ id: 'p1', displayName: 'Alice' }]
    store.activeOutcomes.add('WIN')

    store.initContext('t1')

    expect(store.myMatchesActive).toBe(true)
    expect(store.selectedPlayers).toHaveLength(1)
    expect(store.activeOutcomes.has('WIN')).toBe(true)
  })

  it('initContext with a new key resets the filters', () => {
    const store = useMatchListFiltersStore()
    store.initContext('t1')
    store.myMatchesActive = true
    store.selectedPlayers = [{ id: 'p1', displayName: 'Alice' }]
    store.activeOutcomes.add('LOSS')

    store.initContext('t2')

    expect(store.contextKey).toBe('t2')
    expect(store.myMatchesActive).toBe(false)
    expect(store.selectedPlayers).toEqual([])
    expect(store.activeOutcomes.size).toBe(0)
  })

  it('reset clears all filters', () => {
    const store = useMatchListFiltersStore()
    store.myMatchesActive = true
    store.selectedPlayers = [{ id: 'p1', displayName: 'Alice' }]
    store.activeOutcomes.add('DRAW')

    store.reset()

    expect(store.myMatchesActive).toBe(false)
    expect(store.selectedPlayers).toEqual([])
    expect(store.activeOutcomes.size).toBe(0)
  })
})
