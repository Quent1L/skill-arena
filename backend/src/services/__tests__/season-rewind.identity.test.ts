import { describe, it, expect } from "bun:test";

import { retagIdentities, type RewindIdentity } from "../season-rewind.identity";

function identities(): Map<string, RewindIdentity> {
  return new Map([["a", { displayName: "Archive 3", shortName: "ARCH3" }]]);
}

describe("retagIdentities", () => {
  it("rewrites an identity ref wherever it sits in the payload", () => {
    const payload = {
      performance: { king: { player: { playerId: "a", displayName: "Alice", shortName: "ALI" } } },
      feats: {
        bestPartner: { playerId: "a", displayName: "Alice", shortName: "ALI", wins: 8 },
        nemesis: null,
      },
    };

    expect(retagIdentities(payload, identities())).toBe(true);
    expect(payload.performance.king.player.displayName).toBe("Archive 3");
    expect(payload.feats.bestPartner.shortName).toBe("ARCH3");
    // Everything that is not a name is left exactly as the snapshot froze it.
    expect(payload.feats.bestPartner.wins).toBe(8);
  });

  it("walks through arrays", () => {
    const payload = {
      rivalry: {
        players: [
          { playerId: "b", displayName: "Bob", shortName: "BOB" },
          { playerId: "a", displayName: "Alice", shortName: "ALI" },
        ],
      },
    };

    expect(retagIdentities(payload, identities())).toBe(true);
    expect(payload.rivalry.players.map((p) => p.displayName)).toEqual(["Bob", "Archive 3"]);
  });

  it("reports no change when the payload does not mention the player", () => {
    const payload = { king: { player: { playerId: "b", displayName: "Bob", shortName: "BOB" } } };
    expect(retagIdentities(payload, identities())).toBe(false);
    expect(payload.king.player.displayName).toBe("Bob");
  });

  it("reports no change when the stored name is already the current one", () => {
    const payload = { player: { playerId: "a", displayName: "Archive 3", shortName: "ARCH3" } };
    expect(retagIdentities(payload, identities())).toBe(false);
  });

  it("leaves a playerId that carries no name alone", () => {
    // Badges reference a player without denormalising their name; growing one
    // here would invent a field the payload's format never had.
    const payload = { badges: [{ id: "x", playerId: "a", icon: "star", label: "MVP" }] };

    expect(retagIdentities(payload, identities())).toBe(false);
    expect(payload.badges[0]).not.toHaveProperty("displayName");
  });

  it("survives nulls and primitives in the tree", () => {
    const payload = { peak: null, totals: { matchesPlayed: 12 }, awardsWon: ["king", "sniper"] };
    expect(retagIdentities(payload, identities())).toBe(false);
  });
});
