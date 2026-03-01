import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema";

type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

// Internal database reference that can be replaced for testing
let _db: AppDatabase | null = null;

/**
 * Get the database instance. For production, uses PostgreSQL via DATABASE_URL.
 * For tests, use setTestDatabase() to inject a test database instance.
 */
function getDb(): AppDatabase {
  _db ??= drizzle(process.env.DATABASE_URL!, { schema });
  return _db;
}

/**
 * Set the database instance. Used for testing with in-memory databases.
 * @param testDb The test database instance to use
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setTestDatabase(testDb: any): void {
  _db = testDb;
}

/**
 * Reset the database instance to null. Used after tests to restore default behavior.
 */
export function resetDatabase(): void {
  _db = null;
}

// Export a Proxy that always delegates to getDb()
// This ensures that even after setTestDatabase() is called, all code using `db` gets the updated instance
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
