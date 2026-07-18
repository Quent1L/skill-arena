/**
 * Zod validation schemas for authentication
 */

import { z } from 'zod'
import { i18n } from '@/i18n'

// Simple regex to validate the email
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validation schema for login
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
 * Validation schema for sign-up
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
 * Validation schema for the password reset request
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, i18n.global.t('authSchema.validation.emailRequired'))
    .regex(emailRegex, i18n.global.t('authSchema.validation.emailInvalid')),
})

/**
 * Validation schema for the password reset
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
 * Validation schema for password change (logged-in user)
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
 * Types inferred from the schemas
 */
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
