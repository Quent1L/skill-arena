/**
 * Load test seed script — standalone Bun script (no monorepo deps)
 * Usage: DATABASE_URL=postgres://... bun run load-test/seed/seed.ts
 *
 * Idempotent: skips all inserts if load-test users already exist.
 */

import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://skolarena:skolarena@localhost:5434/skolarena_load";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID();
}

function nanoid(): string {
  // Better Auth uses ~21-char IDs for the `user` table
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = crypto.getRandomValues(new Uint8Array(21));
  for (const b of bytes) result += chars[b % chars.length];
  return result;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

interface AuthUser {
  id: string; // text (Better Auth)
  name: string;
  email: string;
}

interface AppUser {
  id: string; // uuid
  externalId: string; // FK → user.id
  displayName: string;
  shortName: string;
}

interface Tournament {
  id: string;
  name: string;
  mode: "championship" | "bracket";
  teamMode: "flex" | "static";
  status: "draft" | "open" | "ongoing" | "finished";
  startDate: Date;
  endDate: Date;
  createdBy: string; // appUsers.id
}

interface Entry {
  id: string;
  tournamentId: string;
  playerId: string; // appUsers.id
}

interface Match {
  id: string;
  tournamentId: string;
  entryA: string; // entry id
  entryB: string;
  scoreA: number;
  scoreB: number;
  winnerSide: "A" | "B" | null;
  playedAt: Date;
}

// ---------------------------------------------------------------------------
// Fixture generation
// ---------------------------------------------------------------------------

function buildUsers(count: number): { authUsers: AuthUser[]; appUsers: AppUser[] } {
  const authUsers: AuthUser[] = [];
  const appUsers: AppUser[] = [];
  for (let i = 1; i <= count; i++) {
    const authId = nanoid();
    const appId = uuid();
    authUsers.push({ id: authId, name: `Player ${i}`, email: `player${i}@load-test.com` });
    appUsers.push({ id: appId, externalId: authId, displayName: `Player ${i}`, shortName: `p${i}` });
  }
  return { authUsers, appUsers };
}

function buildTournaments(createdBy: string): Tournament[] {
  return [
    {
      id: uuid(), name: "Championship Alpha",
      mode: "championship", teamMode: "flex", status: "ongoing",
      startDate: daysAgo(30), endDate: daysFromNow(30), createdBy,
    },
    {
      id: uuid(), name: "Championship Beta",
      mode: "championship", teamMode: "flex", status: "finished",
      startDate: daysAgo(90), endDate: daysAgo(10), createdBy,
    },
    {
      id: uuid(), name: "Championship Gamma",
      mode: "championship", teamMode: "flex", status: "open",
      startDate: daysFromNow(7), endDate: daysFromNow(60), createdBy,
    },
    {
      id: uuid(), name: "Bracket Sigma",
      mode: "bracket", teamMode: "flex", status: "finished",
      startDate: daysAgo(20), endDate: daysAgo(5), createdBy,
    },
    {
      id: uuid(), name: "Bracket Delta",
      mode: "bracket", teamMode: "flex", status: "open",
      startDate: daysFromNow(14), endDate: daysFromNow(21), createdBy,
    },
  ];
}

function buildEntries(tournaments: Tournament[], appUsers: AppUser[]): Entry[] {
  const entries: Entry[] = [];
  // Alpha (ongoing): players 0-19  — 20 entries
  // Beta  (finished): players 0-24 — 25 entries
  // Gamma (open):     players 0-14 — 15 entries
  // Sigma (finished): players 0-15 — 16 entries
  // Delta (open):     players 0-11 — 12 entries
  const slices: [number, number, number][] = [
    [0, 0, 20], [1, 0, 25], [2, 0, 15], [3, 0, 16], [4, 0, 12],
  ];
  for (const [ti, start, count] of slices) {
    for (let i = start; i < start + count; i++) {
      entries.push({ id: uuid(), tournamentId: tournaments[ti].id, playerId: appUsers[i].id });
    }
  }
  return entries;
}

/**
 * Build a partial round-robin: each pair plays once, up to `maxMatches`.
 */
function buildMatches(
  tournament: Tournament,
  entries: Entry[],
  maxMatches: number,
  baseDate: Date,
): Match[] {
  const matches: Match[] = [];
  const pairs: [Entry, Entry][] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      pairs.push([entries[i], entries[j]]);
    }
  }
  // Shuffle deterministically (Fisher-Yates with index seed)
  for (let k = pairs.length - 1; k > 0; k--) {
    const r = (k * 7 + 3) % (k + 1);
    [pairs[k], pairs[r]] = [pairs[r], pairs[k]];
  }

  for (let k = 0; k < Math.min(maxMatches, pairs.length); k++) {
    const [a, b] = pairs[k];
    const scoreA = Math.floor((k * 13 + 7) % 5);
    const scoreB = Math.floor((k * 11 + 3) % 5);
    const winnerSide: "A" | "B" | null =
      scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;
    const dayOffset = Math.floor((k / maxMatches) * 60);
    const playedAt = new Date(baseDate.getTime() + dayOffset * 86400000);
    matches.push({
      id: uuid(),
      tournamentId: tournament.id,
      entryA: a.id, entryB: b.id,
      scoreA, scoreB, winnerSide, playedAt,
    });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// DB insertion
// ---------------------------------------------------------------------------

async function waitForMigrations(client: Client, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await client.query('SELECT 1 FROM "user" LIMIT 1');
      return;
    } catch {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`  Waiting for migrations... (${elapsed}s)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Timeout waiting for migrations to complete");
}

async function isAlreadySeeded(client: Client): Promise<boolean> {
  const res = await client.query(
    "SELECT 1 FROM \"user\" WHERE email = 'player1@load-test.com' LIMIT 1",
  );
  return res.rowCount! > 0;
}

async function insertAuthUsers(client: Client, users: AuthUser[]): Promise<void> {
  for (const u of users) {
    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, false, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [u.id, u.name, u.email],
    );
  }
  console.log(`  Inserted ${users.length} auth users`);
}

async function insertAppUsers(client: Client, users: AppUser[]): Promise<void> {
  for (const u of users) {
    await client.query(
      `INSERT INTO app_users (id, external_id, display_name, short_name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'player', NOW(), NOW())
       ON CONFLICT (external_id) DO NOTHING`,
      [u.id, u.externalId, u.displayName, u.shortName],
    );
  }
  console.log(`  Inserted ${users.length} app users`);
}

async function insertTournaments(client: Client, tournaments: Tournament[]): Promise<void> {
  for (const t of tournaments) {
    await client.query(
      `INSERT INTO tournaments (
         id, name, mode, team_mode, status,
         min_team_size, max_team_size, start_date, end_date,
         created_by, created_at
       ) VALUES ($1,$2,$3,$4,$5,1,1,$6,$7,$8,NOW())
       ON CONFLICT (name) DO NOTHING`,
      [t.id, t.name, t.mode, t.teamMode, t.status,
       t.startDate.toISOString().slice(0, 10),
       t.endDate.toISOString().slice(0, 10),
       t.createdBy],
    );
  }
  console.log(`  Inserted ${tournaments.length} tournaments`);
}

async function insertEntries(client: Client, entries: Entry[]): Promise<void> {
  for (const e of entries) {
    // tournament_entries row
    await client.query(
      `INSERT INTO tournament_entries (id, tournament_id, entry_type, created_at)
       VALUES ($1, $2, 'PLAYER', NOW())
       ON CONFLICT DO NOTHING`,
      [e.id, e.tournamentId],
    );
    // link player
    await client.query(
      `INSERT INTO tournament_entry_players (entry_id, player_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [e.id, e.playerId],
    );
  }
  console.log(`  Inserted ${entries.length} tournament entries`);
}

async function insertMatches(client: Client, matches: Match[]): Promise<void> {
  for (const m of matches) {
    await client.query(
      `INSERT INTO matches (id, tournament_id, status, played_at, winner_side, created_at)
       VALUES ($1, $2, 'finalized', $3, $4, NOW())
       ON CONFLICT DO NOTHING`,
      [m.id, m.tournamentId, m.playedAt.toISOString(), m.winnerSide],
    );
    // Side A (position 1)
    await client.query(
      `INSERT INTO match_sides (id, match_id, entry_id, position, score, points_awarded)
       VALUES ($1, $2, $3, 1, $4, $5)
       ON CONFLICT DO NOTHING`,
      [uuid(), m.id, m.entryA, m.scoreA, m.winnerSide === "A" ? 3 : m.winnerSide === null ? 1 : 0],
    );
    // Side B (position 2)
    await client.query(
      `INSERT INTO match_sides (id, match_id, entry_id, position, score, points_awarded)
       VALUES ($1, $2, $3, 2, $4, $5)
       ON CONFLICT DO NOTHING`,
      [uuid(), m.id, m.entryB, m.scoreB, m.winnerSide === "B" ? 3 : m.winnerSide === null ? 1 : 0],
    );
    // match_results row
    await client.query(
      `INSERT INTO match_results (match_id, finalized_at, finalization_reason)
       VALUES ($1, NOW(), 'admin_override')
       ON CONFLICT DO NOTHING`,
      [m.id],
    );
  }
  console.log(`  Inserted ${matches.length} matches`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log("Connected to database");

  try {
    await waitForMigrations(client);

    if (await isAlreadySeeded(client)) {
      console.log("Database already seeded — skipping.");
      return;
    }

    console.log("Seeding fixtures...");

    // Users
    const { authUsers, appUsers } = buildUsers(50);
    await insertAuthUsers(client, authUsers);
    await insertAppUsers(client, appUsers);

    // Tournaments
    const tournaments = buildTournaments(appUsers[0].id);
    await insertTournaments(client, tournaments);

    // Entries
    const allEntries = buildEntries(tournaments, appUsers);
    await insertEntries(client, allEntries);

    // Matches + standings for Alpha (ongoing) and Beta (finished)
    const byTournament = new Map<string, Entry[]>();
    for (const e of allEntries) {
      if (!byTournament.has(e.tournamentId)) byTournament.set(e.tournamentId, []);
      byTournament.get(e.tournamentId)!.push(e);
    }

    const matchConfigs: [Tournament, number][] = [
      [tournaments[0], 60],  // Alpha ongoing
      [tournaments[1], 100], // Beta finished
      [tournaments[3], 15],  // Sigma bracket finished
    ];

    let totalMatches = 0;
    for (const [tournament, max] of matchConfigs) {
      const entries = byTournament.get(tournament.id) ?? [];
      const matches = buildMatches(tournament, entries, max, tournament.startDate);
      await insertMatches(client, matches);
      totalMatches += matches.length;
    }

    console.log(`\nSeed complete:`);
    console.log(`  50 users | 5 tournaments | ${allEntries.length} entries | ~${totalMatches} matches`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
