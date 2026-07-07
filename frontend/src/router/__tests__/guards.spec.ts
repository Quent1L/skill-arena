import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { errorService } from '@/composables/useErrorService.ts'
import { makeAuthMock, type AuthMockState } from '@/test-support/mock-modules'
import {
  requireAuth,
  requireAdmin,
  requireSettingsAccess,
  redirectIfAuthenticated,
} from '../guards'

vi.mock('@/composables/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('@/composables/useErrorService.ts', () => ({
  errorService: { showError: vi.fn() },
}))

const to = { fullPath: '/tournaments/42' } as RouteLocationNormalized

const state: AuthMockState = { user: null, role: 'player', initialized: true }
let auth: ReturnType<typeof makeAuthMock>

function setAuth(over: Partial<AuthMockState>) {
  Object.assign(state, { user: null, role: 'player', initialized: true }, over)
}

beforeEach(() => {
  vi.clearAllMocks()
  setAuth({})
  auth = makeAuthMock(state)
  vi.mocked(useAuth).mockReturnValue(auth as unknown as ReturnType<typeof useAuth>)
  document.cookie = 'invitation_code=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  localStorage.clear()
})

describe('requireAuth', () => {
  it('laisse passer un utilisateur authentifié', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' } })
    expect(await requireAuth(to)).toBeUndefined()
  })

  it('initialise la session si nécessaire', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' }, initialized: false })
    await requireAuth(to)
    expect(auth.initialize).toHaveBeenCalledOnce()
  })

  it('redirige vers /login avec la cible en query', async () => {
    expect(await requireAuth(to)).toEqual({
      path: '/login',
      query: { redirect: '/tournaments/42' },
    })
  })

  it('INVITATION_CODE_REQUIRED sans cookie → /submit-invitation + toast', async () => {
    setAuth({ initialized: false })
    auth.initialize.mockRejectedValue(
      new Error('invitation', { cause: 'INVITATION_CODE_REQUIRED' }),
    )
    expect(await requireAuth(to)).toBe('/submit-invitation')
    expect(errorService.showError).toHaveBeenCalledOnce()
  })

  it('INVITATION_CODE_REQUIRED avec cookie → /submit-invitation sans toast', async () => {
    document.cookie = 'invitation_code=abc; path=/'
    setAuth({ initialized: false })
    auth.initialize.mockRejectedValue(
      new Error('invitation', { cause: 'INVITATION_CODE_REQUIRED' }),
    )
    expect(await requireAuth(to)).toBe('/submit-invitation')
    expect(errorService.showError).not.toHaveBeenCalled()
  })

  it('autre erreur d’init → redirection /login', async () => {
    setAuth({ initialized: false })
    auth.initialize.mockRejectedValue(new Error('boom'))
    expect(await requireAuth(to)).toEqual({
      path: '/login',
      query: { redirect: '/tournaments/42' },
    })
  })
})

describe('requireAdmin', () => {
  it('redirige un anonyme vers /login', async () => {
    expect(await requireAdmin(to)).toEqual({
      path: '/login',
      query: { redirect: '/tournaments/42' },
    })
  })

  it('laisse passer un super admin', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' }, role: 'super_admin' })
    expect(await requireAdmin(to)).toBeUndefined()
  })

  it('renvoie un joueur connecté vers l’accueil', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' }, role: 'player' })
    expect(await requireAdmin(to)).toEqual({ path: '/', replace: true })
  })

  it('INVITATION_CODE_REQUIRED (message) → /submit-invitation', async () => {
    setAuth({ initialized: false })
    auth.initialize.mockRejectedValue(new Error('INVITATION_CODE_REQUIRED'))
    expect(await requireAdmin(to)).toBe('/submit-invitation')
  })
})

describe('requireSettingsAccess', () => {
  it('redirige un anonyme vers /login', async () => {
    expect(await requireSettingsAccess(to)).toEqual({
      path: '/login',
      query: { redirect: '/tournaments/42' },
    })
  })

  it('bloque un kiosk verrouillé', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' }, role: 'kiosk' })
    localStorage.setItem('kiosk_settings_locked', 'true')
    expect(await requireSettingsAccess(to)).toEqual({ path: '/', replace: true })
  })

  it('laisse passer un kiosk non verrouillé', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' }, role: 'kiosk' })
    expect(await requireSettingsAccess(to)).toBeUndefined()
  })

  it('laisse passer un joueur', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' } })
    expect(await requireSettingsAccess(to)).toBeUndefined()
  })
})

describe('redirectIfAuthenticated', () => {
  it('renvoie un connecté vers la query redirect', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' } })
    const login = { fullPath: '/login', query: { redirect: '/foo' } } as unknown as RouteLocationNormalized
    expect(await redirectIfAuthenticated(login)).toEqual({ path: '/foo', replace: true })
  })

  it('renvoie vers / sans query redirect', async () => {
    setAuth({ user: { id: 'u1', email: 'a@b.c' } })
    const login = { fullPath: '/login', query: {} } as unknown as RouteLocationNormalized
    expect(await redirectIfAuthenticated(login)).toEqual({ path: '/', replace: true })
  })

  it('ne fait rien pour un anonyme', async () => {
    const login = { fullPath: '/login', query: {} } as unknown as RouteLocationNormalized
    expect(await redirectIfAuthenticated(login)).toBeUndefined()
  })

  it('avale les erreurs d’initialisation', async () => {
    setAuth({ initialized: false })
    auth.initialize.mockRejectedValue(new Error('boom'))
    const login = { fullPath: '/login', query: {} } as unknown as RouteLocationNormalized
    expect(await redirectIfAuthenticated(login)).toBeUndefined()
  })
})
