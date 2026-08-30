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

- **Routes** (`backend/src/routes/`): HTTP handling only, delegate to services. Use `validate()` from `backend/src/api/validator.ts` and `describe()` from `backend/src/api/describe.ts`.
- **Services** (`backend/src/services/`): Business logic, no HTTP concerns
- **Repositories** (`backend/src/repository/`): Database operations only (Drizzle ORM)
- **Errors**: Use I18n keys for user-facing error messages
- **API layer** (`backend/src/api/`): version negotiation, route manifest, OpenAPI — see below

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
- **`docs/src/content/blog/`** — a content collection whose entries **are** pages, unlike
  showcase: `pages/blog/[...slug].astro` routes them through `BlogPostLayout.astro` (no
  `layout:` frontmatter), and `pages/blog/index.astro` lists them. `src/lib/posts.ts` owns
  the sort and the draft filter — a `draft: true` post renders in dev and is dropped from
  the build.

Search is **Pagefind** (`astro-pagefind` integration), indexing the built HTML:

- `<main data-pagefind-body>` in `BaseLayout.astro` scopes indexing to page content
- Result titles come from each page's `<h1>` — a page without one shows up untitled
- Deep links rely on `id` anchors already present on feature blocks and markdown headings
- The index is generated into `docs/dist/` at build time and served from there in dev, so
  **`bun run build` must have run once for search to work locally**
- `SearchDialog.astro` loads `/pagefind/pagefind.js` through `Function()`. This is
  deliberate: any statically analysable specifier gets wrapped in `__vitePreload()` with an
  unresolved `__VITE_PRELOAD__` placeholder that throws at runtime.

SEO and GEO metadata is centralised, not spread across pages:

- **`src/components/Seo.astro`** owns the whole `<head>` metadata set — title, canonical,
  Open Graph, Twitter card, JSON-LD. `BaseLayout` renders it and forwards `title`,
  `description`, `ogType`, `publishedTime`, `noindex` and `jsonLd`; no page writes a meta
  tag of its own. A page that omits `title` gets the branded form instead of `… · Skol
  Arena`, which is how the homepage avoids `Home · Skol Arena`
- **Every absolute URL derives from `site` in `astro.config.mjs`**, read back at runtime
  through `Astro.site` and normalised by `canonicalUrl()` in `src/lib/site.ts`. Nothing
  hardcodes the origin, so a domain migration is a one-line edit. `build.format` stays at
  its `directory` default (a route answers at both `/about` and `/about/`); `canonicalUrl`
  picks the no-slash form and the canonical tag deduplicates the pair
- **JSON-LD is one `@graph` per page**, assembled in `Seo.astro` from builders in
  `src/lib/schema.ts`. Organization and WebSite are site-wide; pages add their own nodes
  via the `jsonLd` prop. Nodes reference each other by `@id` rather than repeating
  themselves. There is deliberately **no `SearchAction`** — Pagefind is client-side with no
  `?q=` route, so declaring one would point at a URL that does not exist
- **`robots.txt`, `llms.txt` and `llms-full.txt` are endpoints** (`src/pages/*.ts`), not
  files in `public/`, so their links derive from `site` and cannot drift. `robots.txt`
  lists the AI crawlers explicitly; the two `llms` files are generated from existing
  frontmatter and bodies, so no content is written twice
- Docs pages live in `src/pages/docs/*.md` and are **not** a collection, so `getCollection`
  cannot reach them — `src/lib/docs-pages.ts` reads them with a pair of `import.meta.glob`
  calls (eager for frontmatter, `?raw` for the body) for the consumers that need them as
  data
- Feature anchors on `/features` come from `slug(feature.id)` and are what `llms.txt` deep
  links to. A feature rendered without one silently breaks those links — the wide blocks
  and the `platform` `FeatureCard`s both set it

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
- Backend routes use `validate()` from `backend/src/api/validator.ts`, never `zValidator`
  or `hono-openapi`'s `validator` directly: the wrapper registers the schema with the
  OpenAPI generator and converts a failure into the canonical error envelope
- **Never throw a `ZodError`.** Zod 4's exported `ZodError` does not extend `Error`, and
  Hono's `compose` rethrows anything failing `instanceof Error` instead of routing it to
  `app.onError` — it escapes the app and surfaces as a crash page. Throw an `AppError`
  subclass instead

### Testing

- Backend: Bun's built-in test runner
- Frontend: Vitest
- Test files in `__tests__/` directories alongside source files

### API versioning (`backend/src/api/`)

The HTTP API has its own major version, **independent of `VERSION` / `MIN_VERSION`**.
Clients negotiate it with the `accept-version` request header; the resolved version comes
back in `X-API-VERSION`. No header means latest, an unknown one is a `400`.

The version never appears in a URL. `withApiVersion` (`api/dispatch.ts`) rewrites
`/api/…` onto an internal `/__api/<version>/…` prefix at the fetch boundary so Hono's own
router does the dispatch; that prefix is unreachable from outside. `/api/auth/*`,
`/api/ws`, `/api/docs` and `/api/openapi/*` are exempt.

Route modules in `backend/src/routes/` are **not** duplicated per version — they are
shared by reference. Only the manifest in `api/registry.ts` is per-version.

**To add a version:**

1. Add it to `API_VERSIONS` and move `LATEST_API_VERSION` in `api/versions.ts`
2. Add a `VERSION_MOUNTS` entry in `api/registry.ts` via `withOverrides(BASE_MOUNTS, …)`,
   naming only the routers whose behaviour actually changed
3. Bump `API_VERSION` in `frontend/src/config/ApiConfig.ts` only once the client has been
   adapted — the server keeps serving the old major meanwhile

### OpenAPI and Scalar

The spec is generated from the live route table by `hono-openapi`, so a route that exists
is a route that is documented. Scalar is served at `/api/docs`, specs at
`/api/openapi/:version.json`, both gated by `API_DOCS_ENABLED` (on in dev, off in prod).

- Request schemas come free from `validate()`; response shape and prose come from
  `describe()`. Shared failure responses are declared once in `api/openapi.ts` and
  `$ref`-ed, never repeated per route
- Response schemas live in `shared/`, are **the source of truth for their TS type**
  (`export type X = z.infer<typeof xSchema>`), and are documentation-only — never run
  against a response at runtime
- Tag a reusable schema with `.meta({ id: "Name" })` so it lands in `components.schemas`
  instead of being inlined at each use. Ids must be unique across the shared package
- Model the **wire** shape: `z.iso.datetime()` where the existing interface said `string`,
  `z.date()` where it said `Date` (a payload the frontend interceptor has already
  revived). Both render as `string`/`date-time` in the spec

### What triggers a release

A push to `main` does **not** release by itself. `scripts/release-gate.ts` decides, and
the `gate` step of `.github/workflows/release.yml` is its only caller in CI — the same
script backs `bun run release` locally, so there is one source of truth. It runs before
`bun install`, so a push that ships nothing pays neither the install nor the build.

A commit is releasable when **both** hold, on that same commit:

- its type is one of `feat fix perf refactor chore style revert` — `docs`, `test` and `ci`
  never release, and `chore(release)` is skipped outright (its `package.json` bump would
  otherwise make every release trigger the next one)
- it touches at least one path **outside** `NON_RELEASE_PATHS` — `docs/`, `load-test/`,
  `scripts/`, `.github/`, `.husky/`, the root prose files, and `bun.lock`

The path filter is a **denylist**, like `.husky/pre-commit`: a path nobody listed (a new
workspace, a new packaging file) releases by default rather than being silently dropped.

Two consequences worth knowing:

- **`bun.lock` never counts.** Bun workspaces share one lockfile, so it moves for a `docs/`
  dependency exactly as for a backend one. It is never the only useful signal either — an
  applicative dependency also touches its own workspace `package.json`. The **root**
  `package.json` does count: it holds the `catalog` (zod, better-auth, typescript), so a
  catalog bump can ship real dependencies without touching anything else.
- **Type and path must meet on one commit.** A `feat(docs)` in `docs/` plus a `ci(backend)`
  in `backend/` does not release — neither commit satisfies both halves.

Overrides: a breaking change (`type!:` or a `BREAKING CHANGE:` footer) releases whatever
its type, and a `FORCE_UPDATE` marker always releases — see below, the marker is consumed
by the release itself and would otherwise stay stuck in the tree.

Skipped commits are not lost: a `docs` commit still lands in the changelog of the next
real release. The bump level, though, is computed by conventional-changelog over the whole
range — a docs-only `feat` sitting next to a backend `fix` still yields a `minor`.

### Releasing a blocking update

Updates are normally applied in the background: the new bundle is precached silently and
only swapped in when it costs a single reload. A release that breaks compatibility (or
fixes something severe enough that staying on the old bundle is not acceptable) must
instead block the user until the update lands.

Signal it by committing an empty marker file in the same PR:

```bash
touch FORCE_UPDATE && git add FORCE_UPDATE
```

The version number cannot be written by hand — release-it derives it from the
conventional commits at merge time. `scripts/apply-force-update.ts`, run from the
`after:bump` hook in `.release-it.json`, resolves the marker into the published version:
it writes `MIN_VERSION` and deletes the marker, both inside the `chore(release)` commit.

`MIN_VERSION` is a floor, not a per-release flag: a client that has been away skips
straight to the latest version without passing through the intermediate ones, so the
floor is what tells it whether one of the versions it skipped was breaking. **Never edit
`MIN_VERSION` by hand.** The frontend build reads it and ships it in `version.json`
alongside `version` (`frontend/vite.config.ts`); the client compares it against its own
`__APP_VERSION__` in `frontend/src/composables/pwa/pwa.update.ts`.

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
