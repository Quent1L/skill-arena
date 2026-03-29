/**
 * k6 load test — Skol public endpoints
 *
 * Usage:
 *   k6 run k6/script.js
 *   k6 run --env BASE_URL=http://localhost:3000 k6/script.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { randomItem } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Load profile
// ---------------------------------------------------------------------------

export const options = {
  stages: [
    { duration: "30s", target: 100 },   // ramp-up
    { duration: "1m",  target: 500 },   // sustained load
    { duration: "30s", target: 2000 },   // peak
    { duration: "30s", target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    http_req_failed:   ["rate<0.05"],
  },
};

// ---------------------------------------------------------------------------
// Setup — fetch tournament + player IDs once before the test
// ---------------------------------------------------------------------------

export function setup() {
  const res = http.get(`${BASE_URL}/api/tournaments`);
  if (res.status !== 200) {
    console.error(`Setup failed: GET /api/tournaments returned ${res.status}`);
    return { tournamentIds: [], playerIds: [] };
  }

  const body = JSON.parse(res.body);
  // Support both { data: [...] } and plain array responses
  const tournaments = Array.isArray(body) ? body : (body.data ?? []);
  const tournamentIds = tournaments.map((t) => t.id).filter(Boolean);

  if (tournamentIds.length === 0) {
    console.warn("No tournaments found — run the seed script first");
    return { tournamentIds: [], playerIds: [] };
  }

  // Collect player IDs from standings of the first tournament
  const playerIds = [];
  const standingsRes = http.get(
    `${BASE_URL}/api/tournaments/${tournamentIds[0]}/standings/official`,
  );
  if (standingsRes.status === 200) {
    const standings = JSON.parse(standingsRes.body);
    const entries = Array.isArray(standings) ? standings : (standings.data ?? []);
    for (const entry of entries.slice(0, 20)) {
      if (entry.playerId) playerIds.push(entry.playerId);
      else if (entry.players) {
        for (const p of entry.players) {
          if (p.id) playerIds.push(p.id);
        }
      }
    }
  }

  console.log(
    `Setup: ${tournamentIds.length} tournaments, ${playerIds.length} player IDs collected`,
  );
  return { tournamentIds, playerIds };
}

// ---------------------------------------------------------------------------
// Scenario weights
//   40% — browse tournaments list
//   20% — tournament detail
//   20% — standings
//   10% — match list
//   10% — player profile
// ---------------------------------------------------------------------------

export default function (data) {
  const { tournamentIds, playerIds } = data;

  if (tournamentIds.length === 0) {
    sleep(1);
    return;
  }

  const roll = Math.random();

  if (roll < 0.40) {
    // Browse tournaments
    const res = http.get(`${BASE_URL}/api/tournaments`);
    check(res, { "tournaments list 200": (r) => r.status === 200 });

  } else if (roll < 0.60) {
    // Tournament detail
    const id = randomItem(tournamentIds);
    const res = http.get(`${BASE_URL}/api/tournaments/${id}`);
    check(res, { "tournament detail 200": (r) => r.status === 200 });

  } else if (roll < 0.80) {
    // Standings
    const id = randomItem(tournamentIds);
    const res = http.get(`${BASE_URL}/api/tournaments/${id}/standings/official`);
    check(res, { "standings 200": (r) => r.status === 200 });

  } else if (roll < 0.90) {
    // Match list
    const id = randomItem(tournamentIds);
    const res = http.get(`${BASE_URL}/api/matches?tournamentId=${id}`);
    check(res, { "match list 200": (r) => r.status === 200 });

  } else {
    // Player profile
    if (playerIds.length > 0) {
      const id = randomItem(playerIds);
      const res = http.get(`${BASE_URL}/api/users/${id}`);
      check(res, { "player profile 200": (r) => r.status === 200 });
    } else {
      // Fallback to tournament list if no player IDs
      const res = http.get(`${BASE_URL}/api/tournaments`);
      check(res, { "tournaments list 200 (fallback)": (r) => r.status === 200 });
    }
  }

  sleep(Math.random() * 0.5 + 0.1); // 100–600ms think time
}
