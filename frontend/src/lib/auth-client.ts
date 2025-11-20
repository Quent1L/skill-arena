/**
 * Configuration Better Auth Client
 */

import { createAuthClient } from 'better-auth/vue'

const baseURL = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;

export const authClient = createAuthClient({
  baseURL
})

export const { signIn, signUp, signOut, useSession } = authClient
