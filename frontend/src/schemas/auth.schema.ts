/**
 * Schémas de validation pour l'authentification avec Zod
 */

import { z } from 'zod'
import { i18n } from '@/i18n'

// Regex simple pour valider l'email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Schéma de validation pour la connexion
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, i18n.global.t('authSchema.validation.emailRequired'))
    .regex(emailRegex, i18n.global.t('authSchema.validation.emailInvalid')),
  password: z
    .string()
    .min(1, i18n.global.t('authSchema.validation.passwordRequired'))
    .min(8, i18n.global.t('authSchema.validation.passwordMinLength')),
})

/**
 * Schéma de validation pour l'inscription
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, i18n.global.t('authSchema.validation.emailRequired'))
      .regex(emailRegex, i18n.global.t('authSchema.validation.emailInvalid')),
    name: z.string().optional(),
    password: z
      .string()
      .min(1, i18n.global.t('authSchema.validation.passwordRequired'))
      .min(8, i18n.global.t('authSchema.validation.passwordMinLength')),
    passwordConfirm: z.string().min(1, i18n.global.t('authSchema.validation.passwordConfirmRequired')),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: i18n.global.t('authSchema.validation.passwordsMismatch'),
    path: ['passwordConfirm'],
  })

/**
 * Schéma de validation pour la demande de réinitialisation de mot de passe
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, i18n.global.t('authSchema.validation.emailRequired'))
    .regex(emailRegex, i18n.global.t('authSchema.validation.emailInvalid')),
})

/**
 * Schéma de validation pour la réinitialisation de mot de passe
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, i18n.global.t('authSchema.validation.passwordRequired'))
      .min(8, i18n.global.t('authSchema.validation.passwordMinLength')),
    passwordConfirm: z.string().min(1, i18n.global.t('authSchema.validation.passwordConfirmRequired')),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: i18n.global.t('authSchema.validation.passwordsMismatch'),
    path: ['passwordConfirm'],
  })

/**
 * Schéma de validation pour le changement de mot de passe (utilisateur connecté)
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, i18n.global.t('authSchema.validation.currentPasswordRequired')),
    newPassword: z
      .string()
      .min(1, i18n.global.t('authSchema.validation.newPasswordRequired'))
      .min(8, i18n.global.t('authSchema.validation.passwordMinLength')),
    passwordConfirm: z.string().min(1, i18n.global.t('authSchema.validation.passwordConfirmRequired')),
  })
  .refine((data) => data.newPassword === data.passwordConfirm, {
    message: i18n.global.t('authSchema.validation.passwordsMismatch'),
    path: ['passwordConfirm'],
  })

/**
 * Types inférés des schémas
 */
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
