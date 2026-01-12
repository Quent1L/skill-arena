# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Skill Arena is a tournament management application with a Bun monorepo structure:
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
bun run setup:db                 # Push schema to database
cd backend && bun run db:generate # Generate migration
cd backend && bun run db:push    # Push migrations

# Build
bun run build                    # Build shared + frontend
cd shared && bun run build       # Build shared package only
```

## Architecture

### Monorepo Structure
```
skill-arena/
├── shared/     # @skill-arena/shared - types + Zod schemas
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
- Import types from `@skill-arena/shared`, never duplicate locally
- If `Cannot find module '@skill-arena/shared'`: run `cd shared && bun run build`

## Key Conventions

### Code Style
- All code in English
- No `any` type - use proper types or `unknown`
- Functions should be under 30 lines
- Use Font Awesome icons (`fa fa-*`) for action buttons, not PrimeIcons
- Backend error messages use I18n keys (e.g., `throw new ValidationError('INVALID_EMAIL_FORMAT')`)

### Database
- Schema in `backend/src/db/schema.ts` using Drizzle ORM
- Migrations in `backend/drizzle/`
- Uses PostgreSQL with Better Auth for authentication

### Validation
- Use Zod schemas from `@skill-arena/shared` for all validation
- Backend routes use `zValidator` middleware from `@hono/zod-validator`

### Testing
- Backend: Bun's built-in test runner
- Frontend: Vitest
- Test files in `__tests__/` directories alongside source files
