import { describe, it, expect, beforeEach } from "bun:test";

import { tournamentService } from "../tournament.service";
import {
  tournamentRepository,
  TournamentRepository,
  CreateTournamentData,
  UpdateTournamentData,
} from "../../repository/tournament.repository";
import {
  participantRepository,
  ParticipantRepository,
} from "../../repository/participant.repository";
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
import type {
  CreateTournamentInput,
  UpdateTournamentInput,
  TournamentStatus,
  TournamentMode,
  JoinTournamentRequest,
} from "@skill-arena/shared/types/index";

let tourRepo: Partial<TournamentRepository>;
let partRepo: Partial<ParticipantRepository>;
let usrRepo: Partial<UserRepository>;

beforeEach(() => {
  tourRepo = tournamentRepository as unknown as Partial<TournamentRepository>;
  tourRepo.getById = async (_id: string) => undefined;
  tourRepo.create = async (data: CreateTournamentData) =>
    ({ id: "t-1", ...data } as any);
  tourRepo.update = async (_id: string, data: UpdateTournamentData) =>
    ({ id: _id, ...data } as any);
  tourRepo.delete = async () => undefined;
  tourRepo.list = async () => [];
  tourRepo.countByUserAndStatus = async () => 0;
  tourRepo.isUserTournamentAdmin = async () => false;
  tourRepo.addAdmin = async () => undefined;
  tourRepo.getUser = async (_id: string) => undefined;

  partRepo = participantRepository as unknown as Partial<ParticipantRepository>;
  partRepo.findTournamentById = async (_id: string) => undefined as any;
  partRepo.findParticipationByUserAndTournament = async () => undefined as any;
  partRepo.createParticipation = async (_userId: string, _tournamentId: string) =>
    ({ id: "p-1", userId: _userId, tournamentId: _tournamentId } as any);
  partRepo.findParticipationWithDetails = async (_id: string) =>
    ({ id: _id } as any);
  partRepo.deleteParticipation = async () => undefined;
  partRepo.findTournamentParticipants = async () => [];

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

describe("TournamentService - basic flows", () => {
  it("canManageTournament should return true for super_admin", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    const res = await tournamentService.canManageTournament("t-1", "u-1");
    expect(res).toBe(true);
  });

  it("canManageTournament should return true for tournament admin", async () => {
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => true;
    const res = await tournamentService.canManageTournament("t-1", "u-1");
    expect(res).toBe(true);
  });

  it("canManageTournament should return false for regular player", async () => {
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => false;
    const res = await tournamentService.canManageTournament("t-1", "u-1");
    expect(res).toBe(false);
  });

  it("canCreateTournament should return true for tournament_admin", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "tournament_admin" } as any);
    const res = await tournamentService.canCreateTournament("u-1");
    expect(res).toBe(true);
  });

  it("canCreateTournament should return true for super_admin", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    const res = await tournamentService.canCreateTournament("u-1");
    expect(res).toBe(true);
  });

  it("canCreateTournament should return false for player", async () => {
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    const res = await tournamentService.canCreateTournament("u-1");
    expect(res).toBe(false);
  });

  it("countDraftTournaments should return count from repository", async () => {
    tourRepo.countByUserAndStatus = async () => 3;
    const res = await tournamentService.countDraftTournaments("u-1");
    expect(res).toBe(3);
  });

  it("createTournament should throw ForbiddenError when user cannot create", async () => {
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    try {
      await tournamentService.createTournament({
        createdBy: "u-1",
        name: "Test",
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 1,
        maxTeamSize: 2,
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      } as CreateTournamentInput);
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("createTournament should throw ConflictError when max drafts exceeded", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "tournament_admin" } as any);
    tourRepo.countByUserAndStatus = async () => 5;
    try {
      await tournamentService.createTournament({
        createdBy: "u-1",
        name: "Test",
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 1,
        maxTeamSize: 2,
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      } as CreateTournamentInput);
      throw new Error("Expected ConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
    }
  });

  it("createTournament should throw BadRequestError when startDate >= endDate", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "tournament_admin" } as any);
    tourRepo.countByUserAndStatus = async () => 0;
    try {
      await tournamentService.createTournament({
        createdBy: "u-1",
        name: "Test",
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 1,
        maxTeamSize: 2,
        startDate: "2024-01-02",
        endDate: "2024-01-01",
      } as CreateTournamentInput);
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("createTournament should throw BadRequestError when minTeamSize < 1", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "tournament_admin" } as any);
    tourRepo.countByUserAndStatus = async () => 0;
    try {
      await tournamentService.createTournament({
        createdBy: "u-1",
        name: "Test",
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 0,
        maxTeamSize: 2,
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      } as CreateTournamentInput);
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("createTournament should throw BadRequestError when maxTeamSize <= minTeamSize", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "tournament_admin" } as any);
    tourRepo.countByUserAndStatus = async () => 0;
    try {
      await tournamentService.createTournament({
        createdBy: "u-1",
        name: "Test",
        mode: "championship",
        teamMode: "flex",
        minTeamSize: 2,
        maxTeamSize: 2,
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      } as CreateTournamentInput);
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("createTournament should create tournament and add creator as owner", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "tournament_admin" } as any);
    tourRepo.countByUserAndStatus = async () => 0;
    tourRepo.create = async (data: CreateTournamentData) =>
      ({ id: "t-new", ...data } as any);
    let addedAdminTournamentId: string | null = null;
    let addedAdminUserId: string | null = null;
    tourRepo.addAdmin = async (tournamentId: string, userId: string) => {
      addedAdminTournamentId = tournamentId;
      addedAdminUserId = userId;
    };

    const input: CreateTournamentInput = {
      createdBy: "u-1",
      name: "Test Tournament",
      mode: "championship",
      teamMode: "flex",
      minTeamSize: 1,
      maxTeamSize: 2,
      startDate: "2024-01-01",
      endDate: "2024-01-02",
    } as CreateTournamentInput;

    const result = await tournamentService.createTournament(input);
    expect(result).toBeTruthy();
    expect(result?.id).toBe("t-new");
    expect(addedAdminTournamentId).not.toBeNull();
    expect(addedAdminTournamentId!).toBe("t-new");
    expect(addedAdminUserId).not.toBeNull();
    expect(addedAdminUserId!).toBe("u-1");
  });

  it("getTournamentById should throw NotFoundError when tournament not found", async () => {
    tourRepo.getById = async () => undefined;
    try {
      await tournamentService.getTournamentById("t-not-exist");
      throw new Error("Expected NotFoundError");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it("getTournamentById should return tournament when exists", async () => {
    tourRepo.getById = async () =>
      ({ id: "t-1", name: "Test Tournament" } as any);
    const res = await tournamentService.getTournamentById("t-1");
    expect(res).toBeTruthy();
    expect(res.id).toBe("t-1");
  });

  it("listTournaments should return results from repository", async () => {
    tourRepo.list = async (filters?: {
      status?: TournamentStatus;
      mode?: TournamentMode;
      createdBy?: string;
    }) => [{ id: "t-1", status: filters?.status } as any];
    const res = await tournamentService.listTournaments({ status: "open" });
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].status).toBe("open");
  });

  it("updateTournament should throw ForbiddenError when user cannot manage", async () => {
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => false;
    tourRepo.getById = async () =>
      ({ id: "t-1", status: "draft" } as any);
    try {
      await tournamentService.updateTournament(
        "t-1",
        "u-1",
        { name: "New Name" } as UpdateTournamentInput
      );
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("updateTournament should throw BadRequestError when updating forbidden fields on non-draft tournament", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({
        id: "t-1",
        status: "open",
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      } as any);
    try {
      await tournamentService.updateTournament(
        "t-1",
        "u-1",
        { name: "New Name" } as UpdateTournamentInput
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("updateTournament should throw BadRequestError when invalid date range", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({
        id: "t-1",
        status: "draft",
        startDate: "2024-01-01",
        endDate: "2024-01-02",
      } as any);
    try {
      await tournamentService.updateTournament(
        "t-1",
        "u-1",
        {
          startDate: "2024-01-02",
          endDate: "2024-01-01",
        } as UpdateTournamentInput
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("updateTournament should throw BadRequestError when invalid team size", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({
        id: "t-1",
        status: "draft",
        minTeamSize: 1,
        maxTeamSize: 2,
      } as any);
    try {
      await tournamentService.updateTournament(
        "t-1",
        "u-1",
        { minTeamSize: 0 } as UpdateTournamentInput
      );
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("updateTournament should succeed when valid", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({
        id: "t-1",
        status: "draft",
        startDate: "2024-01-01",
        endDate: "2024-01-02",
        minTeamSize: 1,
        maxTeamSize: 2,
      } as any);
    tourRepo.update = async (_id: string, data: UpdateTournamentData) =>
      ({ id: _id, ...data } as any);
    const res = await tournamentService.updateTournament(
      "t-1",
      "u-1",
      { name: "Updated Name" } as UpdateTournamentInput
    );
    expect(res.name).toBe("Updated Name");
  });

  it("deleteTournament should throw NotFoundError when user not found", async () => {
    tourRepo.getUser = async () => undefined;
    try {
      await tournamentService.deleteTournament("t-1", "u-1");
      throw new Error("Expected NotFoundError");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it("deleteTournament should throw ForbiddenError when user is not owner or super_admin", async () => {
    tourRepo.getUser = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.getById = async () =>
      ({ id: "t-1", createdBy: "u-2" } as any);
    try {
      await tournamentService.deleteTournament("t-1", "u-1");
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("deleteTournament should throw BadRequestError when tournament not in draft", async () => {
    tourRepo.getUser = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({ id: "t-1", createdBy: "u-1", status: "open" } as any);
    try {
      await tournamentService.deleteTournament("t-1", "u-1");
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("deleteTournament should succeed when super_admin deletes", async () => {
    tourRepo.getUser = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({ id: "t-1", createdBy: "u-2", status: "draft" } as any);
    let deletedId: string | null = null;
    tourRepo.delete = async (id: string) => {
      deletedId = id;
    };
    const res = await tournamentService.deleteTournament("t-1", "u-1");
    expect(res.success).toBe(true);
    expect(deletedId).not.toBeNull();
    expect(deletedId!).toBe("t-1");
  });

  it("deleteTournament should succeed when owner deletes", async () => {
    tourRepo.getUser = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.getById = async () =>
      ({ id: "t-1", createdBy: "u-1", status: "draft" } as any);
    let deletedId: string | null = null;
    tourRepo.delete = async (id: string) => {
      deletedId = id;
    };
    const res = await tournamentService.deleteTournament("t-1", "u-1");
    expect(res.success).toBe(true);
    expect(deletedId).not.toBeNull();
    expect(deletedId!).toBe("t-1");
  });

  it("changeTournamentStatus should throw ForbiddenError when user cannot manage", async () => {
    usrRepo.getById = async () => ({ id: "u-1", role: "player" } as any);
    tourRepo.isUserTournamentAdmin = async () => false;
    tourRepo.getById = async () =>
      ({ id: "t-1", status: "draft" } as any);
    try {
      await tournamentService.changeTournamentStatus("t-1", "u-1", "open");
      throw new Error("Expected ForbiddenError");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
    }
  });

  it("changeTournamentStatus should throw BadRequestError when invalid transition", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({ id: "t-1", status: "draft" } as any);
    try {
      await tournamentService.changeTournamentStatus("t-1", "u-1", "finished");
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("changeTournamentStatus should succeed when valid transition", async () => {
    usrRepo.getById = async () =>
      ({ id: "u-1", role: "super_admin" } as any);
    tourRepo.getById = async () =>
      ({ id: "t-1", status: "draft" } as any);
    tourRepo.update = async (_id: string, data: UpdateTournamentData) =>
      ({ id: _id, ...data } as any);
    const res = await tournamentService.changeTournamentStatus(
      "t-1",
      "u-1",
      "open"
    );
    expect(res.status).toBe("open");
  });

  it("joinTournament should throw NotFoundError when tournament not found", async () => {
    partRepo.findTournamentById = async () => undefined as any;
    try {
      await tournamentService.joinTournament("u-1", {
        tournamentId: "t-not-exist",
      } as JoinTournamentRequest);
      throw new Error("Expected NotFoundError");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it("joinTournament should throw BadRequestError when tournament closed", async () => {
    partRepo.findTournamentById = async () =>
      ({ id: "t-1", status: "finished" } as any);
    try {
      await tournamentService.joinTournament("u-1", {
        tournamentId: "t-1",
      } as JoinTournamentRequest);
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("joinTournament should throw ConflictError when already registered", async () => {
    partRepo.findTournamentById = async () =>
      ({ id: "t-1", status: "open" } as any);
    partRepo.findParticipationByUserAndTournament = async () =>
      ({ id: "p-1", tournamentId: "t-1", userId: "u-1", teamId: null, matchesPlayed: 0, joinedAt: new Date() } as any);
    try {
      await tournamentService.joinTournament("u-1", {
        tournamentId: "t-1",
      } as JoinTournamentRequest);
      throw new Error("Expected ConflictError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
    }
  });

  it("joinTournament should create participation when valid", async () => {
    partRepo.findTournamentById = async () =>
      ({ id: "t-1", status: "open" } as any);
    partRepo.findParticipationByUserAndTournament = async () => undefined as any;
    partRepo.createParticipation = async (userId: string, tournamentId: string) =>
      ({ id: "p-new", userId, tournamentId } as any);
    partRepo.findParticipationWithDetails = async () =>
      ({ id: "p-new", userId: "u-1", tournamentId: "t-1" } as any);
    const res = await tournamentService.joinTournament("u-1", {
      tournamentId: "t-1",
    } as JoinTournamentRequest);
    expect(res).toBeTruthy();
    expect(res.userId).toBe("u-1");
  });

  it("leaveTournament should throw NotFoundError when tournament not found", async () => {
    partRepo.findTournamentById = async () => undefined as any;
    try {
      await tournamentService.leaveTournament("u-1", "t-not-exist");
      throw new Error("Expected NotFoundError");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it("leaveTournament should throw BadRequestError when tournament ongoing or finished", async () => {
    partRepo.findTournamentById = async () =>
      ({ id: "t-1", status: "ongoing" } as any);
    try {
      await tournamentService.leaveTournament("u-1", "t-1");
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("leaveTournament should throw BadRequestError when not registered", async () => {
    partRepo.findTournamentById = async () =>
      ({ id: "t-1", status: "open" } as any);
    partRepo.findParticipationByUserAndTournament = async () => undefined as any;
    try {
      await tournamentService.leaveTournament("u-1", "t-1");
      throw new Error("Expected BadRequestError");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
    }
  });

  it("leaveTournament should delete participation when valid", async () => {
    partRepo.findTournamentById = async () =>
      ({ id: "t-1", status: "open" } as any);
    partRepo.findParticipationByUserAndTournament = async () =>
      ({ id: "p-1" } as any);
    let deletedId: string | null = null;
    partRepo.deleteParticipation = async (id: string) => {
      deletedId = id;
    };
    const res = await tournamentService.leaveTournament("u-1", "t-1");
    expect(res.message).toContain("quitté");
    expect(deletedId).not.toBeNull();
    expect(deletedId!).toBe("p-1");
  });

  it("getTournamentParticipants should return results from repository", async () => {
    partRepo.findTournamentParticipants = async () => [
      { id: "p-1", userId: "u-1" } as any,
    ];
    const res = await tournamentService.getTournamentParticipants("t-1");
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].userId).toBe("u-1");
  });
});

