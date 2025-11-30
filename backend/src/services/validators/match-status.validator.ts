import { BadRequestError, ErrorCode } from "../../types/errors";
import type { MatchStatus } from "@skill-arena/shared/types/index";

/**
 * Validator for match status transitions
 */
export class MatchStatusValidator {
    /**
     * Validate match status allows reporting
     */
    validateReportStatus(status: MatchStatus): void {
        if (!["scheduled", "reported", "pending_confirmation"].includes(status)) {
            throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
        }
    }

    /**
     * Validate match status allows confirmation
     */
    validateConfirmStatus(status: MatchStatus): void {
        if (!["reported", "pending_confirmation"].includes(status)) {
            throw new BadRequestError(ErrorCode.MATCH_INVALID_STATUS);
        }
    }

    /**
     * Validate match is not already finalized
     */
    validateNotFinalized(status: MatchStatus): void {
        if (status === "finalized") {
            throw new BadRequestError(ErrorCode.MATCH_ALREADY_FINALIZED);
        }
    }

    /**
     * Validate match is not confirmed (for updates/deletes)
     */
    validateNotConfirmed(status: MatchStatus): void {
        if (status === "confirmed") {
            throw new BadRequestError(ErrorCode.MATCH_ALREADY_CONFIRMED);
        }
    }

    /**
     * Validate match cannot be deleted
     */
    validateCanDelete(status: MatchStatus): void {
        if (status === "confirmed") {
            throw new BadRequestError(ErrorCode.MATCH_CANNOT_BE_DELETED);
        }
    }
}

export const matchStatusValidator = new MatchStatusValidator();
