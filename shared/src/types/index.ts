// ============================================
// Export de tous les types partagés
// ============================================

// Enums et types de base
export * from "./enums";

// Types métier
export * from "./season-form";
export * from "./tournament";
export * from "./user";
export * from "./match";
export * from "./team";
export * from "./participant";
export * from "./discipline";
export * from "./outcome-type";
export * from "./outcome-reason";
export * from "./standings";
export * from "./entry";
export * from "./bracket";
export * from "./player";
export * from "./game-rules";
export * from "./rules-engine";
export * from "./ranked";
export * from "./tournament-stats";
export * from "./organization";

// ============================================
// Types utilitaires
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

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
