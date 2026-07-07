import { vi } from 'vitest'
import { ref, computed } from 'vue'

/**
 * Module factories for vi.mock callbacks. vi.mock is hoisted, so specs use:
 *   vi.mock('@/config/ApiConfig', async () => (await import('@/test-support/mock-modules')).apiConfigMock())
 */

export function apiConfigMock() {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  }
}

/** vue-i18n mock where t echoes the key, appending #count for pluralized calls. */
export function i18nEchoMock() {
  const t = (key: string, params?: { count?: number }) =>
    params?.count !== undefined ? `${key}#${params.count}` : key
  return {
    useI18n: () => ({ t, locale: ref('fr') }),
    createI18n: () => ({ global: { t }, install: () => {} }),
  }
}

/**
 * Mutable auth state + a useAuth return value matching src/composables/useAuth.ts.
 * Use with vi.mocked(useAuth).mockReturnValue(makeAuthMock(state)).
 */
export interface AuthMockState {
  user: { id: string; email: string } | null
  role: 'player' | 'tournament_admin' | 'super_admin' | 'kiosk'
  initialized: boolean
}

export function makeAuthMock(state: AuthMockState) {
  const currentUser = computed(() => state.user)
  const appUser = computed(() =>
    state.user ? { id: state.user.id, email: state.user.email, role: state.role } : null,
  )
  return {
    currentUser,
    appUser,
    isAuthenticated: computed(() => !!state.user),
    isSuperAdmin: computed(() => state.role === 'super_admin'),
    isAdmin: computed(() => state.role === 'super_admin' || state.role === 'tournament_admin'),
    userRole: computed(() => state.role),
    loading: ref(false),
    error: ref<string | null>(null),
    isInitialized: computed(() => state.initialized),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    checkSession: vi.fn(),
    fetchUserData: vi.fn(),
    initialize: vi.fn(async () => {
      state.initialized = true
    }),
    authClient: {},
    token: computed(() => null),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    kioskSettingsLocked: ref(false),
    lockKioskSettings: vi.fn(),
  }
}
