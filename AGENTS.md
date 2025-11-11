# Skill Arena — Project Overview and Dev Commands

This file documents the repository structure and common developer commands to run the project locally. It's written for contributors and automated agents working on the monorepo.

## Repository layout

Root contains three workspaces: `shared`, `backend`, `frontend`.

- shared/

  - Purpose: Type definitions and Zod schemas shared between frontend and backend.
  - Key files:
    - `src/` — TypeScript source for types and Zod schemas
    - `package.json` — build scripts for shared package
    - `dist/` — compiled output (should be ignored by Git)

- backend/

  - Purpose: Hono-based API server using Drizzle ORM and BetterAuth.
  - Key files:
    - `src/index.ts` — app entry and route mounting
    - `src/routes/` — route definitions (e.g., `tournaments.route.ts`)
    - `src/services/` — business logic (e.g., `tournament.service.ts`)
    - `src/repository/` — data access with Drizzle (e.g., `participant.repository.ts`)
    - `package.json` — scripts to run the Hono dev server

- frontend/
  - Purpose: Vue 3 application (Vite) with PrimeVue components.
  - Key files:
    - `src/main.ts` — app entry
    - `src/views/` — pages (Tournaments list, Tournament detail, NotFound, etc.)
    - `src/composables/` — API composables and services (e.g., `participant.api.ts`)
    - `package.json` — scripts for dev/build/test

## Important files at repo root

- `package.json` — monorepo scripts for launching all services during development.
- `restart-dev.sh` — helper script to rebuild `shared` and restart dev servers.
- `.gitignore` — ensure `**/dist` is ignored to avoid committing compiled artifacts.

## Coding conventions (project rules)

- All code, identifiers, comments, and git messages must be written in English.
- Avoid superfluous comments. Prefer self-explanatory code and good naming for variables, functions, and types.
- Use clear, descriptive names instead of relying on comments to explain intent.
- Do not generate or append a markdown summary after every action unless explicitly requested.

These rules help keep the codebase consistent and readable.

## How to run locally (developer workflow)

Prerequisites:

- Bun installed (recommended; project scripts assume Bun)

1. Install dependencies for the monorepo

```bash
bun install
# or, if you prefer per-workspace: cd shared && bun install && cd ../backend && bun install && cd ../frontend && bun install
```

2. Development (start shared building + backend + frontend)

From repo root run the single command that wraps everything:

```bash
bun run dev
```

This runs `dev:setup` (builds `shared` once), then `dev:all` which launches watchers for `shared`, `backend` and `frontend` concurrently:

- `shared`: `bun run dev` → `tsc --watch` to keep `dist/` updated
- `backend`: `bun run dev` → Hono server (default: http://localhost:3000)
- `frontend`: `bun run dev` → Vite dev server (default: http://localhost:5173)

If you need to rebuild `shared` manually and restart dev servers, use the helper script:

```bash
./restart-dev.sh
```

3. Build for production (frontend + shared)

```bash
bun run build
```

This runs `build:shared` then `build:frontend` (backend doesn't need a build step here).

4. Type-check all workspaces

```bash
bun run type-check
```

This runs TypeScript checks for `shared`, `backend` and `frontend`.

5. Clean

```bash
bun run clean
```

Removes `dist/` in `shared` (and `frontend`'s `dist` via script).

## API base URL and routes

- Backend routes are mounted under `/api` in the Hono app. Example endpoints:
  - `GET /api/tournaments` — list tournaments
  - `GET /api/tournaments/:id` — tournament detail
  - `POST /api/tournaments/:id/participants` — join tournament
  - `DELETE /api/tournaments/:id/participants` — leave tournament

## Common troubleshooting

- If you see `Cannot find module './participant' from .../dist/index.js` or similar errors:

  - Make sure `shared` was built (`cd shared && bun run build`) and the `dist/` files exist.
  - Check `.gitignore` to ensure compiled `dist/` files are not accidentally tracked.
  - Run `./restart-dev.sh` to rebuild and restart watchers.

- If a frontend API request returns 404, verify the URL used in the frontend includes the `/api` prefix (e.g. `/api/tournaments/...`). The frontend `ApiConfig` uses `baseURL=http://localhost:3000`.

## Notes for contributors

- Keep `shared` as the source of truth for types and Zod schemas. The backend and frontend should import from `@skill-arena/shared`.
- Avoid committing `dist/` contents — the repo now ignores them. If they were committed previously, they've been removed and the `.gitignore` updated.

## Quick commands cheat-sheet

```bash
# install deps
bun install

# start dev (shared + backend + frontend)
bun run dev

# build shared and frontend for production
bun run build

# run TS checks
bun run type-check

# clean build artifacts
bun run clean
```

---

If you want, I can also add a short CI snippet (GitHub Actions) to run `bun run type-check` and `bun run build` on PRs. Would you like that?
