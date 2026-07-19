# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skol is a tournament management application with a Bun monorepo structure:

- **Backend**: Hono + Bun + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend**: Vue 3 + Vite + PrimeVue + TailwindCSS
- **Shared**: TypeScript types and Zod schemas consumed by both
- **Docs**: Astro static showcase + self-hosting documentation site

## Common Commands

```bash
# Development - launches all workspaces concurrently
bun run dev

# Type checking across all workspaces
bun run type-check

# Tests
cd backend && bun run test             # Backend: unit + integration
cd backend && bun run test:unit        # Backend: unit only
cd backend && bun run test:integration # Backend: integration only
cd frontend && bun run test:unit       # Frontend tests (Vitest)

# Always use the backend scripts, never a bare `bun test`: they pass --isolate,
# which is required. Without it the state leaks between test files and produces
# dozens of bogus failures.

# Single test file
cd backend && bun test path/to/file.test.ts --isolate
cd frontend && bun run test:unit path/to/file.test.ts

# Linting
bun run lint                     # All workspaces
cd frontend && bun run lint      # Frontend only
cd docs && bun run lint          # Docs only (Prettier)

# Database
# Create migration files in backend/drizzle and reference this migration in backend/drizzle/meta/_journal.json
# Migrations are applied automatically at server startup (no manual migrate command)

# Build
bun run build                    # Build shared + frontend + backend + docs
cd shared && bun run build       # Build shared package only
cd docs && bun run build         # Build docs site only (also generates the search index)
```

All four workspaces are wired into the root `dev`, `build`, `type-check` and `lint`
scripts — `bun run dev` starts the docs site alongside backend and frontend.

## Architecture

### Monorepo Structure

```
skol-arena/
├── shared/     # @skol-arena/shared - types + Zod schemas
├── backend/    # Hono API server
├── frontend/   # Vue 3 SPA
└── docs/       # @skol-arena/docs - Astro static site (showcase + self-hosting docs)
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

### Documentation Site (`docs/`)

Custom Astro static site (no Starlight), Tailwind v4 via `@tailwindcss/vite`. Dark theme
only, brand tokens declared with `@theme` in `docs/src/styles/global.css` — there is no
`tailwind.config.js`. Content is authored in English.

Content lives in two places:

- **`docs/src/content/showcase/`** — a content collection (schema in
  `docs/src/content.config.ts`). These Markdown files are **fragments, not pages**: they
  have no routes and are pulled into `/`, `/features` and `/about` via `getCollection` +
  `render()`, filtered by id prefix and sorted by `data.order`.
- **`docs/src/pages/docs/*.md`** — real routes using the `layout:` frontmatter pattern.
  Outside any collection, so no schema validation. The sidebar in `DocsLayout.astro` is a
  hardcoded array — add new pages there manually.

Search is **Pagefind** (`astro-pagefind` integration), indexing the built HTML:

- `<main data-pagefind-body>` in `BaseLayout.astro` scopes indexing to page content
- Result titles come from each page's `<h1>` — a page without one shows up untitled
- Deep links rely on `id` anchors already present on feature blocks and markdown headings
- The index is generated into `docs/dist/` at build time and served from there in dev, so
  **`bun run build` must have run once for search to work locally**
- `SearchDialog.astro` loads `/pagefind/pagefind.js` through `Function()`. This is
  deliberate: any statically analysable specifier gets wrapped in `__vitePreload()` with an
  unresolved `__VITE_PRELOAD__` placeholder that throws at runtime.

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
