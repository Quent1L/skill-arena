# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skol is a tournament management application with a Bun monorepo structure:

- **Backend**: Hono + Bun + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend**: Vue 3 + Vite + PrimeVue + TailwindCSS
- **Shared**: TypeScript types and Zod schemas consumed by both

## Common Commands

```bash
# Development - launches all workspaces concurrently
bun run dev

# Type checking across all workspaces
bun run type-check

# Tests
cd backend && bun test           # Backend tests
cd frontend && bun run test:unit # Frontend tests (Vitest)

# Single test file
cd backend && bun test path/to/file.test.ts
cd frontend && bun run test:unit path/to/file.test.ts

# Linting (frontend)
cd frontend && bun run lint

# Database
# Create migration files in backend/drizzle and reference this migration in backend/drizzle/meta/_journal.json
# Migrations are applied automatically at server startup (no manual migrate command)

# Build
bun run build                    # Build shared + frontend
cd shared && bun run build       # Build shared package only
```

## Architecture

### Monorepo Structure

```
skol-arena/
├── shared/     # @skol-arena/shared - types + Zod schemas
├── backend/    # Hono API server
└── frontend/   # Vue 3 SPA
```

### Backend Layered Architecture (Routes → Services → Repositories)

- **Routes** (`backend/src/routes/`): HTTP handling only, delegate to services. Use `@hono/zod-validator` for validation.
- **Services** (`backend/src/services/`): Business logic, no HTTP concerns
- **Repositories** (`backend/src/repository/`): Database operations only (Drizzle ORM)
- **Errors**: Use I18n keys for user-facing error messages

### Frontend Layer Pattern (Components → Services → API)

- **Views** (`frontend/src/views/`): Page components
- **Components** (`frontend/src/components/`): Reusable UI components - consume services, never API directly
- **Composables** (`frontend/src/composables/`): Contains both services and API layers
  - **Services**: Business logic, state management, error handling
  - **API** (`.api.ts` files): 1:1 mirror of backend routes, no logic or try-catch (xior interceptor handles errors)
- xior interceptor handles automatic date conversion via `convertStringDatesToJS`

### Shared Package

- Import types from `@skol-arena/shared`, never duplicate locally
- If `Cannot find module '@skol-arena/shared'`: run `cd shared && bun run build`

## Key Conventions

### Code Style

- All code in English
- No `any` type - use proper types or `unknown`
- Functions should be under 30 lines
- Use Font Awesome icons (`fa fa-*`) for action buttons, not PrimeIcons
- Backend error messages use I18n keys (e.g., `throw new ValidationError('INVALID_EMAIL_FORMAT')`)

### Database

- Schema in `backend/src/db/schema.ts` using Drizzle ORM
- Migrations in `backend/drizzle/` — **applied automatically at server startup** via `backend/src/utils/migrate.ts`
- No manual `db:migrate` command needed: generate the migration with `db:generate`, then restart the server
- When using `db:push` during development, write migration SQL with `IF NOT EXISTS` / conditional blocks to stay idempotent
- Uses PostgreSQL with Better Auth for authentication

### Validation

- Use Zod schemas from `@skol-arena/shared` for all validation
- Backend routes use `zValidator` middleware from `@hono/zod-validator`

### Testing

- Backend: Bun's built-in test runner
- Frontend: Vitest
- Test files in `__tests__/` directories alongside source files

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
