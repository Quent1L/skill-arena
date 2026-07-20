import { z } from "zod";
import { userRoleEnum, userRoleSchema, type UserRole } from "./enums";
import { displayNameRegex } from "../schemas/user.schema";

// ============================================
// Admin user management (super_admin only)
// ============================================

export interface AdminUserListItem {
  id: string;
  displayName: string;
  shortName: string;
  email: string | null;
  emailVerified: boolean;
  role: UserRole;
  createdAt: Date;
  lastLoginAt: Date | null;
  deactivatedAt: Date | null;
  /**
   * Set when the Better Auth identity was destroyed and the name anonymised.
   * The row is kept so matches, standings and MMR history stay intact.
   */
  archivedAt: Date | null;
  matchCount: number;
  tournamentCount: number;
  /**
   * providerId of the `account` rows: "credential" (native password) and/or
   * "keycloak" (SSO). Both can coexist since Better Auth links accounts sharing
   * the same email. Empty for accounts created outside Better Auth (seeds).
   */
  authProviders: string[];
}

export interface AdminUserOrganization {
  id: string;
  name: string;
  role: "owner" | "member";
  joinedAt: Date;
}

export interface AdminUserDetail extends AdminUserListItem {
  organizations: AdminUserOrganization[];
}

export interface AdminUserListResponse {
  data: AdminUserListItem[];
  total: number;
}

export interface AdminUserStats {
  total: number;
  activeLast7Days: number;
  activeLast30Days: number;
  newThisMonth: number;
  deactivated: number;
  archived: number;
  byRole: Record<UserRole, number>;
}

/** Tables whose restrict FK blocks a permanent deletion. */
export interface AdminUserDeletionBlocker {
  resource: string;
  count: number;
}

export const adminUserStatusEnum = ["active", "deactivated"] as const;
export type AdminUserStatus = (typeof adminUserStatusEnum)[number];

export const adminUserSortEnum = [
  "displayName",
  "role",
  "createdAt",
  "lastLoginAt",
] as const;
export type AdminUserSort = (typeof adminUserSortEnum)[number];

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  role: userRoleSchema.optional(),
  status: z.enum(adminUserStatusEnum).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(adminUserSortEnum).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;

export const adminUpdateUserSchema = z
  .object({
    displayName: z.string().trim().min(3).max(50).regex(displayNameRegex).optional(),
    shortName: z
      .string()
      .trim()
      .min(3)
      .max(8)
      .regex(displayNameRegex)
      .transform((v) => v.toUpperCase())
      .optional(),
    role: z.enum(userRoleEnum).optional(),
    email: z.email().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

/** Both optional: the backend falls back to a generated "Archive N" label. */
export const adminArchiveUserSchema = z.object({
  displayName: z.string().trim().min(3).max(50).regex(displayNameRegex).optional(),
  shortName: z
    .string()
    .trim()
    .min(3)
    .max(8)
    .regex(displayNameRegex)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export type AdminArchiveUserInput = z.infer<typeof adminArchiveUserSchema>;

/**
 * Moves the sign-in identity of `sourceUserId` onto an archived profile, so a
 * returning player recovers their history. The source account must hold no data
 * of its own, otherwise two histories would have to be merged.
 */
export const adminRestoreUserSchema = z.object({
  sourceUserId: z.uuid(),
});

export type AdminRestoreUserInput = z.infer<typeof adminRestoreUserSchema>;

export const adminAddOrganizationSchema = z.object({
  organizationId: z.uuid(),
});

export type AdminAddOrganizationInput = z.infer<typeof adminAddOrganizationSchema>;
