/**
 * Configuration Better Auth Client
 */

import { createAuthClient } from 'better-auth/vue'
import { genericOAuthClient } from 'better-auth/client/plugins'

const baseURL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    genericOAuthClient()
  ]
})

export const { signIn, signUp, signOut, useSession } = authClient
