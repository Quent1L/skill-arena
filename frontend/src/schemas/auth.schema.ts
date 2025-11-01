/**
 * Schémas de validation pour l'authentification avec Zod
 */

import { z } from 'zod'

// Regex simple pour valider l'email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Schéma de validation pour la connexion
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "L'adresse email est requise")
    .regex(emailRegex, 'Adresse email invalide'),
  password: z
    .string()
    .min(1, 'Le mot de passe est requis')
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

/**
 * Schéma de validation pour l'inscription
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, "L'adresse email est requise")
      .regex(emailRegex, 'Adresse email invalide'),
    name: z.string().optional(),
    password: z
      .string()
      .min(1, 'Le mot de passe est requis')
      .min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
    passwordConfirm: z.string().min(1, 'La confirmation du mot de passe est requise'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['passwordConfirm'],
  })

/**
 * Types inférés des schémas
 */
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
