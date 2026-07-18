/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";

import { matchNotificationBuilder } from "../match-notification.builder";
import { matchRepository } from "../../repository/match.repository";
import { userRepository } from "../../repository/user.repository";
import { notificationService } from "../notification.service";

let sentPayloads: any[] = [];

beforeEach(() => {
  sentPayloads = [];
  (notificationService as any).send = async (payload: any) => {
    sentPayloads.push(payload);
    return undefined;
  };
  (userRepository as any).getById = async (id: string) =>
    ({ id, displayName: `User-${id}` });
  (matchRepository as any).getParticipationsByMatchId = async () => [
    { playerId: "p1", teamSide: "A" },
    { playerId: "p2", teamSide: "A" },
    { playerId: "p3", teamSide: "B" },
    { playerId: "p4", teamSide: "B" },
  ];
});

afterEach(() => {
  const restore = (instance: object) => {
    if (Object.getPrototypeOf(instance) === Object.prototype) return;
    for (const key of Object.getOwnPropertyNames(instance)) {
      delete (instance as Record<string, unknown>)[key];
    }
  };
  restore(matchRepository);
  restore(userRepository);
  restore(notificationService);
});

describe("MatchNotificationBuilder", () => {
  it("notifyMatchCreated sends notification to all participants except creator with rich context", async () => {
    (matchRepository as any).getById = async () => ({
      id: "m-1",
      tournamentId: "t-1",
      status: "scheduled",
      playedAt: new Date("2026-06-01T15:00:00Z"),
    });

    await matchNotificationBuilder.notifyMatchCreated("m-1", "p1", "Tour");

    expect(sentPayloads).toHaveLength(3); // p2, p3, p4
    const p2Notif = sentPayloads.find((p) => p.userId === "p2");
    expect(p2Notif).toBeDefined();
    expect(p2Notif.type).toBe("match_created");
    expect(p2Notif.translationParams.creatorName).toBe("User-p1");
    expect(p2Notif.translationParams.tournamentName).toBe("Tour");
    expect(p2Notif.translationParams.matchFormat).toBe("2v2");
    // p2 is on team A — teammates exclude p2 itself, so only p1
    expect(p2Notif.translationParams.teammates).toBe("User-p1");
    expect(p2Notif.translationParams.opponents).toBe("User-p3, User-p4");
    expect(p2Notif.requiresAction).toBe(false);
    // Raw instant, so the reader's device owns the locale and the timezone
    expect(p2Notif.translationParams.matchDate).toBe("2026-06-01T15:00:00.000Z");
    expect(p2Notif.matchId).toBe("m-1");
  });

  it("stores a null matchDate when the match has no date yet", async () => {
    (matchRepository as any).getById = async () => ({
      id: "m-4",
      tournamentId: "t-1",
      status: "draft",
      playedAt: null,
    });

    await matchNotificationBuilder.notifyMatchCreated("m-4", "p1", "Tour");

    expect(sentPayloads[0].translationParams.matchDate).toBeNull();
  });

  it("leaves participant lists empty rather than baking in a localized label", async () => {
    (matchRepository as any).getById = async () => ({
      id: "m-5",
      tournamentId: "t-1",
      status: "scheduled",
      playedAt: new Date("2026-06-01T15:00:00Z"),
    });
    (matchRepository as any).getParticipationsByMatchId = async () => [
      { playerId: "p1", teamSide: "A" },
      { playerId: "p3", teamSide: "B" },
    ];

    await matchNotificationBuilder.notifyMatchCreated("m-5", "p1", "Tour");

    expect(sentPayloads[0].translationParams.teammates).toBe("");
  });

  it("notifyMatchValidationRequired sends action notification with reporter context", async () => {
    (matchRepository as any).getById = async () => ({
      id: "m-2",
      tournamentId: "t-1",
      status: "reported",
      playedAt: new Date("2026-06-02T15:00:00Z"),
    });
    (matchRepository as any).getTournament = async () => ({
      id: "t-1",
      name: "Tournament X",
    });

    await matchNotificationBuilder.notifyMatchValidationRequired("m-2", "p3");

    expect(sentPayloads).toHaveLength(3); // p1, p2, p4
    const p4Notif = sentPayloads.find((p) => p.userId === "p4");
    expect(p4Notif).toBeDefined();
    expect(p4Notif.type).toBe("MATCH_VALIDATION");
    expect(p4Notif.translationParams.reporterName).toBe("User-p3");
    expect(p4Notif.translationParams.tournamentName).toBe("Tournament X");
    // p4 is on team B — teammates is p3
    expect(p4Notif.translationParams.teammates).toBe("User-p3");
    expect(p4Notif.translationParams.opponents).toBe("User-p1, User-p2");
    expect(p4Notif.requiresAction).toBe(true);
    expect(p4Notif.matchId).toBe("m-2");
  });

  it("notifyScoreProposal sends MATCH_SCORE_PROPOSAL with proposer + scores", async () => {
    (matchRepository as any).getById = async () => ({
      id: "m-3",
      tournamentId: "t-1",
      status: "pending_confirmation",
    });

    await matchNotificationBuilder.notifyScoreProposal("m-3", "p1", 5, 3);

    expect(sentPayloads).toHaveLength(3);
    const sample = sentPayloads[0];
    expect(sample.type).toBe("MATCH_SCORE_PROPOSAL");
    expect(sample.translationParams.proposerName).toBe("User-p1");
    expect(sample.translationParams.scoreA).toBe("5");
    expect(sample.translationParams.scoreB).toBe("3");
    expect(sample.requiresAction).toBe(true);
    expect(sample.matchId).toBe("m-3");
  });

  it("returns silently when match not found", async () => {
    (matchRepository as any).getById = async () => null;

    await matchNotificationBuilder.notifyMatchCreated("missing", "p1", "Tour");
    await matchNotificationBuilder.notifyMatchValidationRequired("missing", "p1");
    await matchNotificationBuilder.notifyScoreProposal("missing", "p1", 1, 0);

    expect(sentPayloads).toHaveLength(0);
  });
});
