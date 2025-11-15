Vite) concurrently.

3. **Run type checks:**
   ```bash
   bun run type-check
   ```

4. **Run tests:**
   ```bash
   # Backend tests
   cd backend && bun test
   
   # Frontend tests
   cd frontend && bun test
   
   # Shared tests
   cd shared && bun test
   ```

5. **Build for production:**
   ```bash
   bun run build
   ```

### Database Workflow

```bash
# Push schema changes to database
bun run setup:db

# Generate migration
cd backend && bun run db:generate

# Apply migrations
cd backend && bun run db:migrate
```

### Cleaning Build Artifacts

```bash
bun run clean
```

---

## Common Pitfalls

### 1. Importing from Wrong Workspace

❌ **BAD:**
```typescript
// backend/src/services/tournament.service.ts
import { Tournament } from '../types/tournament'; // Local duplicate
```

✅ **GOOD:**
```typescript
import { Tournament } from '@skill-arena/shared';
```

### 2. Not Building Shared Package

If you see `Cannot find module '@skill-arena/shared'`:

```bash
cd shared && bun run build
# Or restart dev servers
bun run dev
```

### 3. Using `any` Type

See [No `any` Type](#no-any-type) section. Always use proper types or `unknown`.

### 4. Committing Compiled Files

Ensure `dist/` directories are gitignored:

```gitignore
# .gitignore
**/dist/
**/.tsbuildinfo
**/node_modules/
```

### 5. Hardcoded Error Messages in Backend

Always use I18n keys for user-facing errors (see [I18n Error Messages](#i18n-error-messages)).

```typescript
// ❌ BAD
throw new ValidationError('Invalid email format');

// ✅ GOOD
throw new ValidationError('INVALID_EMAIL_FORMAT');
```

### 6. Long Functions

Break down functions longer than 30 lines (see [Keep Functions Small](#keep-functions-small)).

### 7. Business Logic in API Layer (Frontend)

❌ **BAD:**
```typescript
// frontend/src/api/tournament.api.ts
export const tournamentApi = {
  async getTournaments(): Promise<Tournament[]> {
    try {
      const response = await http.get<Tournament[]>('/api/tournaments');
      // ❌ Business logic in API layer
      return response.data.filter(t => t.isActive);
    } catch (err) {
      // ❌ Error handling in API layer
      console.error(err);
      return [];
    }
  }
};
```

✅ **GOOD:**
```typescript
// frontend/src/api/tournament.api.ts
export const tournamentApi = {
  async getTournaments(): Promise<Tournament[]> {
    const response = await http.get<Tournament[]>('/api/tournaments');
    return response.data;
  }
};

// frontend/src/services/tournament.service.ts
export function useTournamentService() {
  async function loadActiveTournaments() {
    try {
      const allTournaments = await tournamentApi.getTournaments();
      tournaments.value = allTournaments.filter(t => t.isActive);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load';
    }
  }
}
```

### 8. Try-Catch in API Layer (Frontend)

❌ **BAD:**
```typescript
// frontend/src/api/tournament.api.ts
export const tournamentApi = {
  async getTournamentById(id: string): Promise<Tournament> {
    try {
      const response = await http.get<Tournament>(`/api/tournaments/${id}`);
      return response.data;
    } catch (err) {
      throw err; // Unnecessary try-catch
    }
  }
};
```

✅ **GOOD:**
```typescript
// frontend/src/api/tournament.api.ts
export const tournamentApi = {
  async getTournamentById(id: string): Promise<Tournament> {
    const response = await http.get<Tournament>(`/api/tournaments/${id}`);
    return response.data;
  }
};
```

**Reason:** The xior interceptor already handles all errors. Let errors propagate naturally to the service layer.

### 9. Components Calling API Layer Directly

❌ **BAD:**
```vue
<script setup lang="ts">
import { tournamentApi } from '@/api/tournament.api';

const tournaments = ref<Tournament[]>([]);

async function loadData() {
  tournaments.value = await tournamentApi.getTournaments();
}
</script>
```

✅ **GOOD:**
```vue
<script setup lang="ts">
import { useTournamentService } from '@/services/tournament.service';

const { tournaments, loadTournaments } = useTournamentService();

onMounted(() => {
  loadTournaments();
});
</script>
```

**Reason:** Components should only interact with services. Services handle state, errors, and business logic.

### 10. Not Using Zod Validation

Always validate external input (API requests, user input) with Zod.

```typescript
// ✅ GOOD - Backend route validation
import { zValidator } from '@hono/zod-validator';
import { CreateTournamentSchema } from '@skill-arena/shared';

tournamentRoute.post(
  '/',
  zValidator('json', CreateTournamentSchema),
  async (c) => {
    const data = c.req.valid('json');
    // data is now typed and validated
  }
);
```

### 11. Duplicating State Management

❌ **BAD:**
```typescript
// Multiple services managing the same data
// service1.ts
const tournaments = ref<Tournament[]>([]);

// service2.ts
const tournaments = ref<Tournament[]>([]); // Duplicate state
```

✅ **GOOD:**
```typescript
// Single source of truth
// tournament.service.ts
const tournaments = ref<Tournament[]>([]);

// Export composable for sharing state
export function useTournamentService() {
  return { tournaments };
}
```

### 12. Manual Date Conversion

❌ **BAD:**
```typescript
// frontend/src/services/tournament.service.ts
async function loadTournaments() {
  const data = await tournamentApi.getTournaments();
  // ❌ Manual date conversion
  tournaments.value = data.map(t => ({
    ...t,
    startDate: new Date(t.startDate)
  }));
}
```

✅ **GOOD:**
```typescript
// frontend/src/services/tournament.service.ts
async function loadTournaments() {
  // ✅ xior interceptor handles date conversion automatically
  tournaments.value = await tournamentApi.getTournaments();
}
```

**Reason:** The `convertStringDatesToJS` utility in xior interceptor handles all date conversions automatically.

---

## File Naming & Organization

### Backend Structure

```
backend/
├── src/
│   ├── index.ts                    # App entry point
│   ├── routes/
│   │   ├── tournament.route.ts     # Tournament routes
│   │   ├── participant.route.ts    # Participant routes
│   │   └── auth.route.ts           # Auth routes
│   ├── services/
│   │   ├── tournament.service.ts   # Tournament business logic
│   │   ├── participant.service.ts  # Participant business logic
│   │   └── __tests__/
│   │       └── tournament.service.test.ts
│   ├── repository/
│   │   ├── tournament.repository.ts
│   │   ├── participant.repository.ts
│   │   └── __tests__/
│   │       └── tournament.repository.test.ts
│   ├── errors/
│   │   ├── base.error.ts
│   │   ├── tournament.errors.ts
│   │   └── participant.errors.ts
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   └── auth.middleware.ts
│   └── db/
│       ├── index.ts                # Database connection
│       └── schema.ts               # Drizzle schema
└── drizzle/                        # Migrations
```

### Frontend Structure

```
frontend/
├── src/
│   ├── main.ts                     # App entry point
│   ├── http.ts                     # xior configuration
│   ├── views/
│   │   ├── TournamentList.vue
│   │   ├── TournamentDetail.vue
│   │   └── NotFound.vue
│   ├── components/
│   │   ├── TournamentCard.vue
│   │   └── ParticipantList.vue
│   ├── api/                        # HTTP client layer
│   │   ├── tournament.api.ts       # Mirrors backend tournament routes
│   │   ├── participant.api.ts      # Mirrors backend participant routes
│   │   └── auth.api.ts             # Mirrors backend auth routes
│   ├── services/                   # Business logic layer
│   │   ├── tournament.service.ts   # Tournament state & logic
│   │   ├── participant.service.ts  # Participant state & logic
│   │   └── __tests__/
│   │       └── tournament.service.test.ts
│   ├── composables/                # Reusable composition functions
│   │   ├── useAuth.ts
│   │   └── useToast.ts
│   └── utils/
│       ├── DateUtils.ts
│       └── ValidationUtils.ts
```

### Shared Structure

```
shared/
├── src/
│   ├── index.ts                    # Main export file
│   ├── schemas/
│   │   ├── tournament.schema.ts    # Tournament Zod schemas
│   │   ├── participant.schema.ts   # Participant Zod schemas
│   │   └── user.schema.ts          # User Zod schemas
│   ├── types/
│   │   ├── tournament.types.ts     # Tournament TypeScript types
│   │   └── common.types.ts         # Common types
│   └── utils/
│       └── date.utils.ts           # Shared utilities
└── dist/                           # Compiled output (gitignored)
```

---

## Best Practices Summary

### Backend

- ✅ Use layered architecture: Routes → Services → Repositories
- ✅ Validate all input with Zod schemas
- ✅ Use I18n keys for all error messages
- ✅ Keep functions under 30 lines
- ✅ Write unit tests for all services and repositories
- ✅ Use custom error classes extending `AppError`
- ✅ No business logic in routes or repositories

### Frontend

- ✅ API layer mirrors backend routes exactly (no logic)
- ✅ Services contain all business logic and state management
- ✅ No try-catch in API layer (xior handles errors)
- ✅ Components only consume services, never API directly
- ✅ xior interceptor handles date conversion automatically
- ✅ Write unit tests for all services
- ✅ Use PrimeVue components consistently

### Shared

- ✅ Single source of truth for types and schemas
- ✅ Define Zod schemas first, infer types
- ✅ Export all types and schemas from index.ts
- ✅ No business logic in shared package
- ✅ Build shared package before backend/frontend

### General

- ✅ All code in English
- ✅ No `any` type - use proper types or `unknown`
- ✅ Self-documenting code with clear naming
- ✅ Comments explain WHY, not WHAT
- ✅ Use Conventional Commits for git messages
- ✅ Keep PRs small and focused

---

## Additional Resources

- [Hono Documentation](https://hono.dev/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Documentation](https://zod.dev/)
- [xior Documentation](https://github.com/suhaotian/xior)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [PrimeVue Documentation](https://primevue.org/)

---

## Summary Checklist for AI Agents

Before submitting code, verify:

**General:**
- [ ] All code is in English
- [ ] No `any` types used
- [ ] Functions are < 30 lines
- [ ] Code is properly decomposed
- [ ] Meaningful variable/function names (no unnecessary comments)
- [ ] Commit messages follow Conventional Commits

**Backend:**
- [ ] Routes only handle HTTP, delegate to services
- [ ] Services contain business logic, no HTTP concerns
- [ ] Repositories only do database operations
- [ ] All input validated with Zod
- [ ] Error messages use I18n keys
- [ ] Custom errors extend `AppError`
- [ ] Unit tests written for services/repositories

**Frontend:**
- [ ] API layer is 1:1 mirror of backend routes
- [ ] No business logic or try-catch in API layer
- [ ] Services handle all business logic and state
- [ ] Components only use services, never API directly
- [ ] No manual date conversion (xior handles it)
- [ ] Unit tests written for services

**Shared:**
- [ ] Types/schemas imported from `@skill-arena/shared`
- [ ] No type duplication across workspaces
- [ ] Zod schemas defined before type inference

**Build & Deploy:**
- [ ] No `dist/` or build artifacts committed
- [ ] Type-check passes (`bun run type-check`)
- [ ] Tests pass (`bun test`)
- [ ] Shared package builds successfully

---

**Last Updated:** November 2025  
**Maintainers:** Skill Arena Development Team