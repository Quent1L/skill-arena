/**
 * Bulk match generator — creates matches in an existing tournament through the HTTP API.
 *
 * Unlike the other seeds, this one talks to a running server rather than the database:
 * every match then goes through the real validation chain, the ranked auto-registration
 * and the MMR hook, exactly as a client would.
 *
 * Usage (from backend/, server already running):
 *   bun run seed:matches --tournament <uuid> --count 500 \
 *     --from 2026-01-01 --to 2026-08-01 \
 *     --email admin@skol-arena.local --password '…'
 *
 * Backdating a ranked match is refused by the server unless it is started with
 * RANKED_MATCH_MAX_AGE_HOURS=0 — the window is a server setting, not a script one.
 *
 * Matches are created in ascending playedAt order, which bounds the work each MMR job
 * has to do. It does not avoid it: MMR is computed off a per-season serial queue, so a
 * large run leaves a backlog that must be dropped and replaced by one season replay.
 * scripts/README.md has the procedure — read it before a run of any size.
 */

import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values } = parseArgs({
  options: {
    tournament: { type: "string" },
    count: { type: "string", default: "100" },
    from: { type: "string" },
    to: { type: "string" },
    api: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    "team-size": { type: "string" },
    seed: { type: "string", default: "1" },
    concurrency: { type: "string", default: "1" },
    "dry-run": { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: false,
});

const USAGE = `
Create matches in bulk in an existing tournament, through the API.

  --tournament <uuid>   Target tournament                        (required)
  --count <n>           Number of matches to create              (default 100)
  --from <date>         Start of the played-at range             (default: 30 days ago)
  --to <date>           End of the played-at range               (default: now)
  --api <url>           API base URL                             (default $API_URL or http://localhost:3000)
  --email <email>       Account used to create the matches       (default $SEED_API_EMAIL)
  --password <pw>       Its password                             (default $SEED_API_PASSWORD)
  --team-size <n>       Players per side                         (default: the tournament's minTeamSize)
  --seed <n>            RNG seed, for a reproducible run         (default 1)
  --concurrency <n>     Parallel creations                       (default 1)
  --dry-run             Print the payloads, create nothing
  --force               Required when --api is not localhost
  --help                Print this message

See scripts/README.md for the full walkthrough.
`;

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function parseCount(raw: string | undefined, name: string, min: number): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min) {
    fail(`--${name} must be an integer >= ${min} (got ${raw})`);
  }
  return parsed;
}

function parseDate(raw: string | undefined, fallback: Date, name: string): Date {
  if (!raw) return fallback;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) fail(`--${name} is not a valid date (got ${raw})`);
  return parsed;
}

const tournamentId = values.tournament ?? fail("--tournament <uuid> is required");
const count = parseCount(values.count, "count", 1);
const concurrency = parseCount(values.concurrency, "concurrency", 1);
const rngSeed = parseCount(values.seed, "seed", 0);
const teamSizeOverride = values["team-size"]
  ? parseCount(values["team-size"], "team-size", 1)
  : null;

const now = new Date();
const from = parseDate(values.from, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), "from");
const to = parseDate(values.to, now, "to");
if (from >= to) fail(`--from must be strictly before --to (${from.toISOString()} >= ${to.toISOString()})`);

const apiUrl = (values.api ?? process.env.API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const email = values.email ?? process.env.SEED_API_EMAIL;
const password = values.password ?? process.env.SEED_API_PASSWORD;
if (!email || !password) {
  fail("credentials are required: --email/--password, or SEED_API_EMAIL/SEED_API_PASSWORD");
}

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(apiUrl);
if (!isLocal && !values.force) {
  fail(`refusing to write ${count} matches to a non-local API (${apiUrl}) — pass --force if that is intended`);
}

const dryRun = values["dry-run"];

// ---------------------------------------------------------------------------
// Deterministic RNG — same LCG as scripts/seed-showcase.ts
// ---------------------------------------------------------------------------

let lcgState = rngSeed * 2654435761 + 1;
function rand(): number {
  lcgState = (lcgState * 1664525 + 1013904223) % 4294967296;
  return lcgState / 4294967296;
}
function randInt(minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rand() * (maxInclusive - minInclusive + 1));
}

/** Draw `size` distinct items — partial Fisher-Yates over a copy, so no rejection loop. */
function sample<T>(pool: readonly T[], size: number): T[] {
  const copy = [...pool];
  for (let i = 0; i < size; i++) {
    const j = randInt(i, copy.length - 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, size);
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

const API_VERSION = "v1";
let sessionCookie = "";

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "accept-version": API_VERSION,
      ...(sessionCookie ? { cookie: sessionCookie } : {}),
      ...init.headers,
    },
  });

  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    const { error } = (body ?? {}) as ApiErrorBody;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? `HTTP ${response.status}`,
    );
  }

  return body as T;
}

/**
 * Better Auth answers with a session cookie; it is scoped to `localhost` and
 * port-agnostic, same as in frontend/e2e/auth.setup.ts.
 */
async function signIn(): Promise<void> {
  const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    fail(`sign-in failed for ${email}: HTTP ${response.status} ${await response.text()}`);
  }

  const cookies = response.headers.getSetCookie?.() ?? [];
  const header = cookies.map((c) => c.split(";")[0]).join("; ");
  if (!header) fail("sign-in succeeded but returned no session cookie");
  sessionCookie = header;
}

// ---------------------------------------------------------------------------
// Tournament shape (only the fields this script reads)
// ---------------------------------------------------------------------------

interface Tournament {
  id: string;
  name: string;
  mode: string;
  teamMode: string;
  status: string;
  minTeamSize: number;
  maxTeamSize: number;
  scoreEnabled?: boolean;
  allowDraw?: boolean;
  minScore?: number | null;
  maxScore?: number | null;
  validationMode: string;
}

interface Participant {
  userId: string;
  user: { displayName: string };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;

/**
 * One whole minute per match, strictly increasing, never reusing a minute a player is
 * already booked on: the server rejects two matches sharing a player within the same
 * DATE_TRUNC('minute', played_at) with PLAYER_SCHEDULE_CONFLICT.
 */
function nextFreeMinute(
  candidate: number,
  playerIds: string[],
  bookings: Map<string, Set<number>>,
): number {
  let minute = Math.floor(candidate / MINUTE_MS);
  while (playerIds.some((id) => bookings.get(id)?.has(minute))) minute++;
  for (const id of playerIds) {
    const slots = bookings.get(id) ?? new Set<number>();
    slots.add(minute);
    bookings.set(id, slots);
  }
  return minute * MINUTE_MS;
}

interface MatchPayload {
  tournamentId: string;
  status: "reported";
  playedAt: string;
  sides: { position: number; playerIds: string[] }[];
  scoreA?: number;
  scoreB?: number;
  winnerPosition: number | null;
}

function buildResult(
  tournament: Tournament,
): Pick<MatchPayload, "scoreA" | "scoreB" | "winnerPosition"> {
  const allowDraw = tournament.allowDraw ?? false;

  if (tournament.scoreEnabled === false) {
    return { winnerPosition: allowDraw && rand() < 0.1 ? null : randInt(1, 2) };
  }

  const min = tournament.minScore ?? 0;
  const max = tournament.maxScore ?? Math.max(min + 1, 21);
  let scoreA = randInt(min, max);
  let scoreB = randInt(min, max);

  if (scoreA === scoreB && !allowDraw) {
    // Nudge one side rather than redraw, so the score stays inside [min, max].
    if (scoreA < max) scoreA += 1;
    else scoreB -= 1;
  }

  if (scoreA === scoreB) return { scoreA, scoreB, winnerPosition: null };
  return { scoreA, scoreB, winnerPosition: scoreA > scoreB ? 1 : 2 };
}

function buildPayloads(tournament: Tournament, playerIds: string[], teamSize: number): MatchPayload[] {
  const bookings = new Map<string, Set<number>>();
  const span = to.getTime() - from.getTime();
  const step = span / count;

  return Array.from({ length: count }, (_, index) => {
    const roster = sample(playerIds, teamSize * 2);
    const slotStart = from.getTime() + index * step;
    const playedAtMs = nextFreeMinute(slotStart + rand() * step, roster, bookings);

    return {
      tournamentId,
      status: "reported" as const,
      playedAt: new Date(playedAtMs).toISOString(),
      sides: [
        { position: 1, playerIds: roster.slice(0, teamSize) },
        { position: 2, playerIds: roster.slice(teamSize) },
      ],
      ...buildResult(tournament),
    };
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/** Above this, the per-season MMR queue cannot keep up — see scripts/README.md. */
const MMR_BACKLOG_THRESHOLD = 500;

const MAX_CONSECUTIVE_FAILURES = 10;
const PROGRESS_EVERY = 25;

async function createAll(payloads: MatchPayload[]): Promise<{ created: number; failed: number }> {
  let created = 0;
  let failed = 0;
  let consecutiveFailures = 0;

  // Chunked rather than a worker pool: chunk N+1 only starts once N is fully written,
  // so matches reach the server in playedAt order.
  for (let offset = 0; offset < payloads.length; offset += concurrency) {
    const chunk = payloads.slice(offset, offset + concurrency);
    const results = await Promise.allSettled(
      chunk.map((payload) =>
        api<{ id: string }>("/api/matches", { method: "POST", body: JSON.stringify(payload) }),
      ),
    );

    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        created++;
        consecutiveFailures = 0;
        continue;
      }

      failed++;
      consecutiveFailures++;
      const error = result.reason;
      const at = chunk[index]!.playedAt;
      console.error(
        error instanceof ApiError
          ? `  ✖ ${at} — ${error.status} ${error.code}: ${error.message}`
          : `  ✖ ${at} — ${String(error)}`,
      );

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`\n✖ ${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting.`);
        return { created, failed };
      }
    }

    const done = offset + chunk.length;
    if (done % PROGRESS_EVERY < concurrency || done === payloads.length) {
      console.log(`  … ${done}/${payloads.length} (${created} created, ${failed} failed)`);
    }
  }

  return { created, failed };
}

async function main(): Promise<void> {
  await signIn();

  const tournament = await api<Tournament>(`/api/tournaments/${tournamentId}`);
  console.log(`Tournament: ${tournament.name} (${tournament.mode}/${tournament.teamMode}, ${tournament.status})`);

  if (tournament.teamMode === "static") {
    fail("static team mode is not supported — this script draws from the player pool, not from teams");
  }
  if (!["open", "ongoing"].includes(tournament.status)) {
    fail(`tournament status is "${tournament.status}" — the server only accepts matches on open/ongoing tournaments`);
  }
  if (tournament.mode !== "ranked") {
    console.warn(`⚠ tournament mode is "${tournament.mode}", not "ranked" — no MMR will be computed.`);
  }
  if (tournament.validationMode !== "none") {
    console.warn(
      `⚠ validationMode is "${tournament.validationMode}": the matches will stay in "reported" ` +
        "until participants confirm them, and no MMR will be computed.",
    );
  }
  if (tournament.mode === "ranked" && tournament.validationMode === "none" && count > MMR_BACKLOG_THRESHOLD) {
    console.warn(
      `\n⚠ ${count} matches will queue ${count} MMR jobs on this season's serial worker queue.\n` +
        "  Expect a backlog that takes days to drain, during which no real match gets an\n" +
        "  MMR animation. When the run finishes, drop the queued finalize_match_mmr jobs and\n" +
        "  replay the season once instead — see scripts/README.md, \"MMR is computed off a\n" +
        "  serial queue\".\n",
    );
  }

  const teamSize = teamSizeOverride ?? tournament.minTeamSize;
  const participants = await api<Participant[]>(`/api/tournaments/${tournamentId}/participants`);
  const playerIds = participants.map((p) => p.userId);
  if (playerIds.length < teamSize * 2) {
    fail(`${playerIds.length} participant(s) registered, ${teamSize * 2} needed for ${teamSize}v${teamSize}`);
  }

  console.log(
    `Generating ${count} ${teamSize}v${teamSize} match(es) from ${playerIds.length} players, ` +
      `between ${from.toISOString()} and ${to.toISOString()}.`,
  );

  const payloads = buildPayloads(tournament, playerIds, teamSize);

  if (dryRun) {
    console.log("\n--dry-run: nothing was created. First payloads:\n");
    for (const payload of payloads.slice(0, 5)) console.log(JSON.stringify(payload, null, 2));
    if (payloads.length > 5) console.log(`… and ${payloads.length - 5} more.`);
    return;
  }

  const { created, failed } = await createAll(payloads);
  console.log(`\n✔ ${created} match(es) created, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Match seed failed:", error);
  process.exit(1);
});
