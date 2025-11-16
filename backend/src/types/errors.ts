export enum ErrorCode {
  // Generic errors
  UNKNOWN = "UNKNOWN",
  VALIDATION_ERROR = "VALIDATION_ERROR",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  TOURNAMENT_NOT_FOUND = "TOURNAMENT_NOT_FOUND",
  MATCH_NOT_FOUND = "MATCH_NOT_FOUND",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  TEAM_NOT_FOUND = "TEAM_NOT_FOUND",
  DISCIPLINE_NOT_FOUND = "DISCIPLINE_NOT_FOUND",
  OUTCOME_TYPE_NOT_FOUND = "OUTCOME_TYPE_NOT_FOUND",
  OUTCOME_REASON_NOT_FOUND = "OUTCOME_REASON_NOT_FOUND",

  // Permission errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Business logic errors - Tournament
  TOURNAMENT_INVALID_STATUS = "TOURNAMENT_INVALID_STATUS",
  TOURNAMENT_CLOSED = "TOURNAMENT_CLOSED",
  TOURNAMENT_CANNOT_BE_DELETED = "TOURNAMENT_CANNOT_BE_DELETED",
  TOURNAMENT_FIELD_UPDATE_FORBIDDEN = "TOURNAMENT_FIELD_UPDATE_FORBIDDEN",
  INVALID_DATE_RANGE = "INVALID_DATE_RANGE",
  INVALID_TEAM_SIZE = "INVALID_TEAM_SIZE",
  INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION",
  MAX_DRAFT_TOURNAMENTS_EXCEEDED = "MAX_DRAFT_TOURNAMENTS_EXCEEDED",
  ALREADY_REGISTERED = "ALREADY_REGISTERED",
  NOT_REGISTERED = "NOT_REGISTERED",
  CANNOT_LEAVE_ONGOING_TOURNAMENT = "CANNOT_LEAVE_ONGOING_TOURNAMENT",

  // Business logic errors - Match
  MATCH_INVALID_STATUS = "MATCH_INVALID_STATUS",
  MATCH_ALREADY_CONFIRMED = "MATCH_ALREADY_CONFIRMED",
  MATCH_CANNOT_BE_DELETED = "MATCH_CANNOT_BE_DELETED",
  MATCH_INVALID_TEAMS = "MATCH_INVALID_TEAMS",
  MATCH_INVALID_PLAYERS = "MATCH_INVALID_PLAYERS",
  MATCH_DUPLICATE_TEAMS = "MATCH_DUPLICATE_TEAMS",
  MATCH_OVERLAPPING_PLAYERS = "MATCH_OVERLAPPING_PLAYERS",
  MATCH_INVALID_SCORE = "MATCH_INVALID_SCORE",
  MATCH_DRAW_NOT_ALLOWED = "MATCH_DRAW_NOT_ALLOWED",
  MATCH_SAME_REPORTER_CONFIRMER = "MATCH_SAME_REPORTER_CONFIRMER",
  MATCH_TEAM_SIZE_MISMATCH = "MATCH_TEAM_SIZE_MISMATCH",

  // Constraint violations
  MAX_MATCHES_EXCEEDED = "MAX_MATCHES_EXCEEDED",
  MAX_PARTNER_MATCHES_EXCEEDED = "MAX_PARTNER_MATCHES_EXCEEDED",
  MAX_OPPONENT_MATCHES_EXCEEDED = "MAX_OPPONENT_MATCHES_EXCEEDED",


  // Participant errors
  NOT_A_PARTICIPANT = "NOT_A_PARTICIPANT",
  PLAYER_NOT_IN_TOURNAMENT = "PLAYER_NOT_IN_TOURNAMENT",
  TEAM_NOT_IN_TOURNAMENT = "TEAM_NOT_IN_TOURNAMENT",
}

// Base error class
export abstract class AppError extends Error {
  constructor(public code: ErrorCode, public details?: Record<string, any>) {
    super(code);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  abstract get statusCode(): number;
}

// 400 Bad Request errors
export class BadRequestError extends AppError {
  get statusCode(): number {
    return 400;
  }
}

// 401 Unauthorized errors
export class UnauthorizedError extends AppError {
  get statusCode(): number {
    return 401;
  }
}

// 403 Forbidden errors
export class ForbiddenError extends AppError {
  get statusCode(): number {
    return 403;
  }
}

// 404 Not Found errors
export class NotFoundError extends AppError {
  get statusCode(): number {
    return 404;
  }
}

// 409 Conflict errors
export class ConflictError extends AppError {
  get statusCode(): number {
    return 409;
  }
}

// 500 Internal Server errors
export class InternalServerError extends AppError {
  get statusCode(): number {
    return 500;
  }
}
