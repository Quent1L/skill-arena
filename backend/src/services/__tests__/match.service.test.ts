import { describe, it, expect, beforeEach } from "bun:test";

import { matchService } from "../match.service";
import {
  matchRepository,
  MatchRepository,
  CreateMatchParticipationData,
  UpdateMatchData,
} from "../../repository/match.repository";
import {
  tournamentRepository,
  TournamentRepository,
} from "../../repository/tournament.repository";
import {
  userRepository,
  UserRepository,
} from "../../repository/user.repository";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from "../../types/errors";
import { db } from "../../config/database";
import type {
  CreateMatchRequestData,
  UpdateMatchRequestData,
  ReportMatchResultRequestData,
  ConfirmMatchResultRequestData,
  ListMatchesQuery,
} from "@skill-arena/shared/types/index";

// Reset repository mocks before each test
let repo: Partial<MatchRepository>;
let tourRepo: Partial<TournamentRepository>;
let usrRepo: Partial<UserRepository>;

beforeEach(() => {
  // Default implementations (can be overridden per-test)
  repo = matchRepository as unknown as Partial<MatchRepository>;
  repo.getTournament = async (_id: string) => undefined;
  repo.create = async (data: CreateMatchRequestData) =>
    ({ id: "match-1", ...data } as any);
  repo.getById = async (_id: string) => undefined;
  repo.createMatchParticipation = async (p: CreateMatchParticipationData) =>
    p as any;
  repo.isUserInMatch = async (_matchId: string, _userId: string) => false;
  repo.validateTeamsForTournament = async () => undefined;
  repo.validatePlayersForTournament = async () => undefined;
  repo.countMatchesForUser = async () => 0;
  repo.countMatchesWithSamePartner = async () => 0;
  repo.countMatchesWithSameOpponent = async () => 0;

  tourRepo = tournamentRepository as unknown as Partial<TournamentRepository>;
  tourRepo.isUserTournamentAdmin = async () => false;

  usrRepo = userRepository as unknown as Partial<UserRepository>;
  usrRepo.getById = async (id: string) =>
    ({
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      externalId: "",
      displayName: "",
      role: "player",
    } as any);
});

describe("MatchService - basic flows", () => {
  it("createMatch should throw NotFoundError when tournament does not exist", async () => {
    // matchRepository.getTournament returns null by default
    try {
      await matchService.createMatch(
        { tournamentId: "t-1" } as CreateMatchRequestData,
        "u-1"
      );
      throw new Error("Expected NotFoundError");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it("getMatchById should return match when exists", async () => {
    repo.getById = async () =>
      ({ id: "m-10", tournamentId: "t-10", status: "scheduled" } as any);
    const res = await matchService.getMatchById("m-10");
    expect(res).toBeTruthy();
    expect(res.id).toBe("m-10");
  });

  it("listMatches should return results from repository", async () => {
    repo.list = async (filters?: ListMatchesQuery) => [
      { id: "m-l", tournamentId: filters?.tournamentId } as any,
    ];
    const res = await matchService.listMatches({
      tournamentId: "t-l",
    } as ListMatchesQuery);
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].tournamentId).toBe("t-l");
  });

  it("updateMatch should succeed when user can manage matches", async () => {
    repo.getById = async () =>
      ({ id: "m-u", tournamentId: "t-1", status: "scheduled" } as any);
    usrRepo.getById = async () =>
      ({ id: "u-admin", role: "super_admin" } as any);
    repo.update = async (_id: string, data: UpdateMatchRequestData) =>
      ({ id: _id, ...data } as any);
    const res = await matchService.updateMatch(
      "m-u",
      { round: 3 } as UpdateMatchRequestData,
      "u-admin"
    );
    expect(res.round).toBe(3);
  });

  it("deleteMatch should succeed when user can manage matches", async () => {
    repo.getById = async () =>
      ({ id: "m-d", tournamentId: "t-1", status: "scheduled" } as any);
    usrRepo.getById = async () =>
      ({ id: "u-admin", role: "super_admin" } as any);
    let deletedId: string | null = null;
    repo.deleteMatchParticipation = async (id: string) => {
      deletedId = id;
    };
    repo.delete = async (id: string) => {
      deletedId = id;
    };
    const res = await matchService.deleteMatch("m-d", "u-admin");
    expect(res.success).toBe(true);
    expect(deletedId).not.toBeNull();
    expect(deletedId!).toBe("m-d");
  });

  it("reportMatchResult draw allowed should set no winner and include reportProof", async () => {
    repo.getById = async () =>
      ({
        id: "m-draw",
        tournamentId: "t-1",
        status: "scheduled",
        teamAId: "A",
        teamBId: "B",
      } as any);
    repo.isUserInMatch = async () => true;
    repo.getTournament = async () => ({ id: "t-1", allowDraw: true } as any);
    repo.update = async (_id: string, data: UpdateMatchData) => {
      return { id: _id, ...data } as any;
    };
    const res = await matchService.reportMatchResult(
      "m-draw",
      {
        scoreA: 1,
        scoreB: 1,
        reportProof: "img",
      } as ReportMatchResultRequestData,
      "u-1"
    );
    expect((res as any).winnerId).toBeUndefined();
    expect((res as any).reportProof).toBe("img");
    expect((res as any).status).toBe("reported");
  });

  it("confirmMatchResult should throw ForbiddenError when user not participant", async () => {
    repo.getById = async () =>
      ({
        id: "m-x",
        tournamentId: "t-1",
        status: "reported",
        reportedBy: "u-rep",
      } as any);
    repo.isUserInMatch = async () => false;
    try {
      await matchService.confirmMatchResult(
        "m-x",
        { confirmed: true } as ConfirmMatchResultRequestData,
        "u-other"
      );
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("validateMatch should return error when tournament not found or not open", async () => {
    repo.getTournament = async () => undefined;
    const res1 = await matchService.validateMatch({
      tournamentId: "no",
    } as CreateMatchRequestData);
    expect(res1.valid).toBe(false);
    repo.getTournament = async () =>
      ({ id: "t", status: "closed", teamMode: "flex" } as any);
    const res2 = await matchService.validateMatch({
      tournamentId: "t",
    } as CreateMatchRequestData);
    expect(res2.valid).toBe(false);
  });

  it("createMatch should throw BadRequestError when tournament status invalid", async () => {
    repo.getTournament = async () =>
      ({ id: "t-1", status: "closed", teamMode: "flex" } as any);
    try {
      await matchService.createMatch(
        { tournamentId: "t-1" } as CreateMatchRequestData,
        "u-1"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("createMatch should create match when creator is listed as player", async () => {
    // Tournament open and flex mode
    repo.getTournament = async () =>
      ({
        id: "t-1",
        status: "open",
        teamMode: "flex",
        maxMatchesPerPlayer: 10,
        maxTimesWithSamePartner: 2,
        maxTimesWithSameOpponent: 2,
      } as any);

    // Simulate create returning an id and getById returning full match
    repo.create = async (data: CreateMatchRequestData) =>
      ({ id: "m-1", ...data } as any);
    repo.getById = async (id: string) =>
      ({ id, tournamentId: "t-1", status: "scheduled" } as any);

    const input: CreateMatchRequestData = {
      tournamentId: "t-1",
      playerIdsA: ["u-1"],
      playerIdsB: ["u-2"],
    } as CreateMatchRequestData;

    const result = await matchService.createMatch(input, "u-1");
    expect(result).toBeTruthy();
    expect(result?.id).toBe("m-1");
  });

  it("reportMatchResult should reject non-participant", async () => {
    repo.getById = async () =>
      ({ id: "m-1", tournamentId: "t-1", status: "scheduled" } as any);
    repo.isUserInMatch = async () => false;

    try {
      await matchService.reportMatchResult(
        "m-1",
        { scoreA: 1, scoreB: 0 } as ReportMatchResultRequestData,
        "u-3"
      );
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("reportMatchResult should reject negative scores", async () => {
    repo.getById = async () =>
      ({
        id: "m-1",
        tournamentId: "t-1",
        status: "scheduled",
        teamAId: "tA",
        teamBId: "tB",
      } as any);
    repo.isUserInMatch = async () => true;
    repo.getTournament = async () => ({ id: "t-1", allowDraw: true } as any);

    try {
      await matchService.reportMatchResult(
        "m-1",
        { scoreA: -1, scoreB: 0 } as ReportMatchResultRequestData,
        "u-1"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("validateMatch should report overlapping players as error", async () => {
    repo.getTournament = async () =>
      ({ id: "t-1", status: "open", teamMode: "flex", name: "T" } as any);

    const input: CreateMatchRequestData = {
      tournamentId: "t-1",
      playerIdsA: ["p1", "p2"],
      playerIdsB: ["p2", "p3"],
    } as CreateMatchRequestData;

    const res = await matchService.validateMatch(input);
    expect(res.valid).toBe(false);
    expect(
      res.errors.some((e: string) => e.includes("Un joueur ne peut pas être"))
    ).toBe(true);
  });

  it("getMatchById should throw NotFoundError when missing", async () => {
    repo.getById = async (_id: string) => undefined;
    try {
      await matchService.getMatchById("m-not-exist");
      throw new Error("Expected NotFoundError");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it("updateMatch should throw ForbiddenError when user cannot manage matches", async () => {
    repo.getById = async () =>
      ({ id: "m-1", tournamentId: "t-1", status: "scheduled" } as any);
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => false;

    try {
      await matchService.updateMatch(
        "m-1",
        { round: 2 } as UpdateMatchRequestData,
        "u-1"
      );
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("deleteMatch should throw ForbiddenError when user cannot manage matches", async () => {
    repo.getById = async () =>
      ({ id: "m-1", tournamentId: "t-1", status: "scheduled" } as any);
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => false;

    try {
      await matchService.deleteMatch("m-1", "u-1");
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("confirmMatchResult should accept confirmation when valid", async () => {
    repo.getById = async () =>
      ({
        id: "m-1",
        tournamentId: "t-1",
        status: "reported",
        reportedBy: "u-rep",
      } as any);
    repo.isUserInMatch = async () => true;
    repo.update = async (_id: string, data: UpdateMatchRequestData) =>
      ({ id: "m-1", ...data } as any);

    const res = await matchService.confirmMatchResult(
      "m-1",
      { confirmed: true } as ConfirmMatchResultRequestData,
      "u-conf"
    );
    expect(res).toBeTruthy();
    expect((res as any).status).toBe("confirmed");
    expect((res as any).confirmationBy).toBe("u-conf");
  });

  it("confirmMatchResult should set disputed when not confirmed", async () => {
    repo.getById = async () =>
      ({
        id: "m-2",
        tournamentId: "t-1",
        status: "reported",
        reportedBy: "u-rep",
      } as any);
    repo.isUserInMatch = async () => true;
    repo.update = async (_id: string, data: UpdateMatchRequestData) =>
      ({ id: "m-2", ...data } as any);

    const res = await matchService.confirmMatchResult(
      "m-2",
      { confirmed: false } as ConfirmMatchResultRequestData,
      "u-conf"
    );
    expect(res).toBeTruthy();
    expect((res as any).status).toBe("disputed");
  });

  it("createMatch should throw ConflictError when max matches per player exceeded", async () => {
    repo.getTournament = async () =>
      ({
        id: "t-1",
        status: "open",
        teamMode: "flex",
        maxMatchesPerPlayer: 1,
        maxTimesWithSamePartner: 2,
        maxTimesWithSameOpponent: 2,
      } as any);

    repo.countMatchesForUser = async () => 2; // exceeds max

    const input: CreateMatchRequestData = {
      tournamentId: "t-1",
      playerIdsA: ["u-1"],
      playerIdsB: ["u-2"],
    } as CreateMatchRequestData;

    try {
      await matchService.createMatch(input, "u-1");
      throw new Error("Expected ConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
    }
  });

  it("createMatch should throw ConflictError when partner count exceeded", async () => {
    repo.getTournament = async () =>
      ({
        id: "t-1",
        status: "open",
        teamMode: "flex",
        maxMatchesPerPlayer: 10,
        maxTimesWithSamePartner: 1,
        maxTimesWithSameOpponent: 10,
      } as any);

    repo.countMatchesWithSamePartner = async () => 2; // exceeds

    const input: CreateMatchRequestData = {
      tournamentId: "t-1",
      playerIdsA: ["u-1", "u-2"],
      playerIdsB: ["u-3", "u-4"],
    } as CreateMatchRequestData;

    try {
      await matchService.createMatch(input, "u-1");
      throw new Error("Expected ConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
    }
  });

  it("createMatch should throw ConflictError when opponent count exceeded", async () => {
    repo.getTournament = async () =>
      ({
        id: "t-1",
        status: "open",
        teamMode: "flex",
        maxMatchesPerPlayer: 10,
        maxTimesWithSamePartner: 10,
        maxTimesWithSameOpponent: 1,
      } as any);

    repo.countMatchesWithSameOpponent = async () => 3; // exceeds

    const input: CreateMatchRequestData = {
      tournamentId: "t-1",
      playerIdsA: ["u-1", "u-2"],
      playerIdsB: ["u-3", "u-4"],
    } as CreateMatchRequestData;

    try {
      await matchService.createMatch(input, "u-1");
      throw new Error("Expected ConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
    }
  });

  it("canManageMatches returns true for super_admin", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-admin", role: "super_admin" } as any);
    const res = await matchService.canManageMatches("t-1", "u-admin");
    expect(res).toBe(true);
  });

  it("canManageMatches returns true for tournament admin", async () => {
    usrRepo.getById = async () => ({ id: "u-2", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => true;
    const res = await matchService.canManageMatches("t-1", "u-2");
    expect(res).toBe(true);
  });

  it("createMatch static mode should require team ids and create match if valid", async () => {
    repo.getTournament = async () =>
      ({
        id: "t-2",
        status: "open",
        teamMode: "static",
      } as any);

    // missing teams should error — use super_admin so we bypass permission check
    usrRepo.getById = async () =>
      ({ id: "u-admin", role: "super_admin" } as any);
    try {
      await matchService.createMatch(
        { tournamentId: "t-2" } as CreateMatchRequestData,
        "u-admin"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }

    // valid teams -> should call validateTeamsForTournament and create
    repo.validateTeamsForTournament = async () => undefined;
    repo.create = async (data: CreateMatchRequestData) =>
      ({ id: "ms-1", ...data } as any);
    repo.getById = async (id: string) => ({ id, tournamentId: "t-2" } as any);

    const input: CreateMatchRequestData = {
      tournamentId: "t-2",
      teamAId: "A",
      teamBId: "B",
    } as CreateMatchRequestData;
    const result = await matchService.createMatch(input, "u-admin");
    expect(result).toBeTruthy();
    expect(result?.id).toBe("ms-1");
  });

  it("updateMatch should throw BadRequestError when match already confirmed", async () => {
    repo.getById = async () =>
      ({ id: "m-c", tournamentId: "t-1", status: "confirmed" } as any);
    usrRepo.getById = async () => ({ id: "u-1", role: "super_admin" } as any);
    try {
      await matchService.updateMatch(
        "m-c",
        { round: 2 } as UpdateMatchRequestData,
        "u-1"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("deleteMatch should throw BadRequestError when match confirmed", async () => {
    repo.getById = async () =>
      ({ id: "m-c", tournamentId: "t-1", status: "confirmed" } as any);
    usrRepo.getById = async () => ({ id: "u-1", role: "super_admin" } as any);
    try {
      await matchService.deleteMatch("m-c", "u-1");
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("reportMatchResult should reject when match status invalid", async () => {
    repo.getById = async () =>
      ({ id: "m-1", tournamentId: "t-1", status: "confirmed" } as any);
    repo.isUserInMatch = async () => true;
    try {
      await matchService.reportMatchResult(
        "m-1",
        { scoreA: 1, scoreB: 0 } as ReportMatchResultRequestData,
        "u-1"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("reportMatchResult should reject draw when tournament does not allow draws", async () => {
    repo.getById = async () =>
      ({ id: "m-1", tournamentId: "t-1", status: "scheduled" } as any);
    repo.isUserInMatch = async () => true;
    repo.getTournament = async () => ({ id: "t-1", allowDraw: false } as any);
    try {
      await matchService.reportMatchResult(
        "m-1",
        { scoreA: 1, scoreB: 1 } as ReportMatchResultRequestData,
        "u-1"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("reportMatchResult should determine winner and call update", async () => {
    repo.getById = async () =>
      ({
        id: "m-w",
        tournamentId: "t-1",
        status: "scheduled",
        teamAId: "A",
        teamBId: "B",
      } as any);
    repo.isUserInMatch = async () => true;
    repo.update = async (_id: string, data: UpdateMatchData) => {
      return { id: _id, ...data } as any;
    };
    repo.getTournament = async () => ({ id: "t-1", allowDraw: true } as any);

    const res = await matchService.reportMatchResult(
      "m-w",
      { scoreA: 2, scoreB: 1 } as ReportMatchResultRequestData,
      "u-1"
    );
    expect((res as any).winnerId).toBe("A");
    expect((res as any).status).toBe("reported");
  });

  it("confirmMatchResult should throw BadRequestError when same reporter confirms", async () => {
    repo.getById = async () =>
      ({
        id: "m-1",
        tournamentId: "t-1",
        status: "reported",
        reportedBy: "u-rep",
      } as any);
    repo.isUserInMatch = async () => true;
    try {
      await matchService.confirmMatchResult(
        "m-1",
        { confirmed: true } as ConfirmMatchResultRequestData,
        "u-rep"
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("validateMatch should add warning when similar match exists", async () => {
    repo.getTournament = async () =>
      ({ id: "t-1", status: "open", teamMode: "static", name: "T" } as any);
    // mock db existing match
    const dbTyped = db as unknown as {
      query?: {
        matches?: { findFirst?: () => Promise<{ id: string } | null> };
      };
    };
    dbTyped.query = dbTyped.query || {};
    dbTyped.query.matches = dbTyped.query.matches || {};
    dbTyped.query.matches.findFirst = async () => ({ id: "exists" });

    const input: CreateMatchRequestData = {
      tournamentId: "t-1",
      teamAId: "A",
      teamBId: "B",
    } as CreateMatchRequestData;
    const res = await matchService.validateMatch(input);
    expect(res.warnings.length).toBeGreaterThan(0);
  });
});
