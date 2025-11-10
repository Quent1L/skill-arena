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
