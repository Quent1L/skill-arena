export * from "./enums";
export * from "./tournament";
export * from "./user";
export * from "./match";
export * from "./team";
export * from "./participant";
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
export type DateString = string;
export type Timestamp = string;
