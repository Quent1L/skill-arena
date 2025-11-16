// ============================================
// Export de tous les types partagés
// ============================================

// Enums et types de base
export * from "./enums";

// Types métier
export * from "./tournament";
export * from "./user";
export * from "./match";
export * from "./team";
export * from "./participant";
export * from "./discipline";
export * from "./outcome-type";
export * from "./outcome-reason";
export * from "./standings";

// ============================================
// Types utilitaires
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T = any> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Types pour les dates
export type DateString = string; // ISO date string
export type Timestamp = string; // ISO datetime string

// ============================================
// Types utilitaires pour transformation de dates
// ============================================

/**
 * Type utilitaire qui transforme toutes les propriétés de type string
 * qui correspondent à des dates ISO en objets Date.
 * Utilisé côté frontend où l'intercepteur transforme automatiquement les dates.
 */
export type WithClientDates<T> = {
  [K in keyof T]: T[K] extends string
    ? K extends `${string}At` | `${string}Date`
      ? Date
      : T[K]
    : T[K] extends object
    ? WithClientDates<T[K]>
    : T[K];
};

/**
 * Type utilitaire pour les payloads d'API côté frontend.
 * Les dates sont acceptées en tant qu'objets Date, mais seront sérialisées en string par JSON.stringify.
 */
export type ClientPayload<T> = {
  [K in keyof T]: T[K] extends string
    ? K extends `${string}At` | `${string}Date`
      ? Date | string
      : T[K]
    : T[K];
};
