# Skol - Tournament Management App

Tournament management application with a Hono/Bun backend and a Vue 3 frontend.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)

### Installation

```bash
bun install
```

### Development

```bash
# Launches everything concurrently:
# - Shared types in watch mode
# - Backend with hot reload
# - Frontend with hot reload
bun run dev
```

- **Shared** (TypeScript watch) → internal compilation
- **Backend** (Hono + Bun) → http://localhost:3000
- **Frontend** (Vue + Vite) → http://localhost:5173

## Project Structure

```
skol-arena/
├── shared/          # @skol-arena/shared — TypeScript types + Zod schemas
├── backend/         # Hono API server
└── frontend/        # Vue 3 SPA
```

## Available Commands

### Development

| Command | Description |
|---------|-------------|
| `bun run dev` | **Start everything** ⭐ |
| `bun run dev:shared` | Shared types in watch mode only |
| `bun run dev:backend` | Backend only |
| `bun run dev:frontend` | Frontend only |

### Build

| Command | Description |
|---------|-------------|
| `bun run build` | Full production build (shared + frontend + backend) |
| `bun run build:shared` | Compile shared types only |
| `bun run build:frontend` | Frontend production build |

### Quality

| Command | Description |
|---------|-------------|
| `bun run type-check` | TypeScript check across all workspaces |
| `bun run lint` | Lint all workspaces |
| `bun run test:unit` | Run all unit tests |

### Database

| Command | Description |
|---------|-------------|
| `bun run setup:db` | Initialize DB schema (first-time setup) |

> Migrations in `backend/drizzle/` are applied automatically at server startup — no manual migrate command needed. To create a new migration: run `bun run db:generate` in the backend, then restart the server.

### Utilities

| Command | Description |
|---------|-------------|
| `bun run clean` | Clean all build directories |
| `bun run release` | Cut a release with changelog |

## Architecture

### Backend: Routes → Services → Repositories

- **Routes** (`backend/src/routes/`): HTTP handling only, validated with `@hono/zod-validator`
- **Services** (`backend/src/services/`): Business logic, no HTTP concerns
- **Repositories** (`backend/src/repository/`): Drizzle ORM queries only
- Error messages use i18n keys (e.g. `throw new ValidationError('INVALID_EMAIL_FORMAT')`)

### Frontend: Views → Components → Composables

- **Views** (`frontend/src/views/`): Page-level components
- **Components** (`frontend/src/components/`): Reusable UI — consume services, never API directly
- **Composables** (`frontend/src/composables/`): Split into two layers:
  - `*.api.ts` — 1:1 mirror of backend routes, no logic or try-catch
  - `*.service.ts` — state management and error handling
- xior handles automatic date conversion via `convertStringDatesToJS`

### Shared Package

Import types from `@skol-arena/shared`, never duplicate locally.
If you get `Cannot find module '@skol-arena/shared'`: run `cd shared && bun run build`.

## Stack

- **Frontend**: Vue 3, TypeScript, Vite, TailwindCSS, PrimeVue, vue-i18n (FR/EN), xior
- **Backend**: Hono, Bun, Drizzle ORM, PostgreSQL, Better Auth
- **Shared**: TypeScript, Zod
- **Tooling**: Bun workspaces, Concurrently, ESLint, Prettier, Husky, commitlint, release-it

---

## Git Hooks & Conventional Commits

This project uses [Husky](https://typicode.github.io/husky/) for Git hooks and [commitlint](https://commitlint.js.org/) to enforce [Conventional Commits](https://www.conventionalcommits.org/). Hooks are installed automatically on `bun install` via the `prepare` script.

### Commit format

```
type(scope): description

# Examples
feat(ranked): add MMR recalculation
fix(bracket): correct seeding order
docs: update setup instructions
```

Accepted types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore`, `ci`, `revert`.

### Bun PATH issue (Linux/macOS)

Husky runs hooks in a restricted shell that doesn't load your user profile. If Bun isn't on the PATH at commit time, you'll get:

```
.husky/commit-msg: bun: not found
husky - commit-msg script failed (code 127)
```

Fix: add Bun to `~/.config/husky/init.sh` (Husky sources this file before every hook):

```bash
mkdir -p ~/.config/husky
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.config/husky/init.sh
```

> This file is machine-local and should not be committed. Each contributor using Bun needs to do this once.
