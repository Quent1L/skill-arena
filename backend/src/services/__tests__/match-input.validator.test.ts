import { describe, it, expect, afterEach } from "bun:test";

import { matchInputValidator } from "../validators/match-input.validator";
import { BadRequestError, ErrorCode } from "../../types/errors";

const ORIGINAL_MAX_AGE = process.env.RANKED_MATCH_MAX_AGE_HOURS;

function setMaxAgeHours(value: string | undefined): void {
  if (value === undefined) delete process.env.RANKED_MATCH_MAX_AGE_HOURS;
  else process.env.RANKED_MATCH_MAX_AGE_HOURS = value;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function expectTooOld(playedAt: Date | string | undefined, expectedHours: number): void {
  try {
    matchInputValidator.validateRankedPlayedAt(playedAt);
    throw new Error("expected validateRankedPlayedAt to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestError);
    const appError = error as BadRequestError;
    expect(appError.code).toBe(ErrorCode.RANKED_MATCH_TOO_OLD);
    expect(appError.details).toEqual({ hours: expectedHours });
  }
}

describe("matchInputValidator.validateRankedPlayedAt", () => {
  afterEach(() => setMaxAgeHours(ORIGINAL_MAX_AGE));

  it("defaults to a 48h window when the variable is unset", () => {
    setMaxAgeHours(undefined);

    expect(() => matchInputValidator.validateRankedPlayedAt(hoursAgo(47))).not.toThrow();
    expectTooOld(hoursAgo(49), 48);
  });

  it("honours a custom window", () => {
    setMaxAgeHours("72");

    expect(() => matchInputValidator.validateRankedPlayedAt(hoursAgo(60))).not.toThrow();
    expectTooOld(hoursAgo(80), 72);
  });

  it("skips the age check entirely when set to 0", () => {
    setMaxAgeHours("0");

    expect(() => matchInputValidator.validateRankedPlayedAt(hoursAgo(24 * 365))).not.toThrow();
  });

  it("falls back to the default on an unparseable or negative value", () => {
    setMaxAgeHours("not-a-number");
    expectTooOld(hoursAgo(49), 48);

    setMaxAgeHours("-5");
    expectTooOld(hoursAgo(49), 48);
  });

  it("still requires a date, even with the window disabled", () => {
    setMaxAgeHours("0");
    expectTooOld(undefined, 0);

    setMaxAgeHours(undefined);
    expectTooOld(undefined, 48);
  });

  it("accepts an ISO string as well as a Date", () => {
    setMaxAgeHours("48");

    expect(() =>
      matchInputValidator.validateRankedPlayedAt(hoursAgo(1).toISOString()),
    ).not.toThrow();
    expectTooOld(hoursAgo(100).toISOString(), 48);
  });
});

describe("matchInputValidator.collectRankedPlayedAt", () => {
  afterEach(() => setMaxAgeHours(ORIGINAL_MAX_AGE));

  it("collects the same rule the create path enforces, instead of throwing", () => {
    setMaxAgeHours(undefined);
    const errors: string[] = [];

    matchInputValidator.collectRankedPlayedAt(hoursAgo(49), errors);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("48");
  });

  it("stays silent on a date inside the window", () => {
    setMaxAgeHours("72");
    const errors: string[] = [];

    matchInputValidator.collectRankedPlayedAt(hoursAgo(60), errors);

    expect(errors).toEqual([]);
  });

  it("stays silent when the window is disabled", () => {
    setMaxAgeHours("0");
    const errors: string[] = [];

    matchInputValidator.collectRankedPlayedAt(hoursAgo(24 * 365), errors);

    expect(errors).toEqual([]);
  });

  it("ignores a missing date — the dry run can precede the date step", () => {
    setMaxAgeHours(undefined);
    const errors: string[] = [];

    matchInputValidator.collectRankedPlayedAt(undefined, errors);

    expect(errors).toEqual([]);
  });
});
