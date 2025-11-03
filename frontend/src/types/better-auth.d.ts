/**
 * Extension des types Better Auth pour ajouter des champs personnalisés
 */

import 'better-auth/client'

declare module 'better-auth/client' {
  interface User {
    isAdmin: boolean
    role?: 'player' | 'tournament_admin' | 'super_admin'
  }
}
