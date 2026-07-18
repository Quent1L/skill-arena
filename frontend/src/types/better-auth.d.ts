/**
 * Better Auth type extension to add custom fields
 */

import 'better-auth/client'

declare module 'better-auth/client' {
  interface User {
    isAdmin: boolean
    role?: 'player' | 'tournament_admin' | 'super_admin'
  }
}
