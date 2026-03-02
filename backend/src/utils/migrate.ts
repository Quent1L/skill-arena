import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Run pending database migrations
 * Should be called before starting the server
 */
export async function runMigrations(): Promise<void> {
  console.log("=".repeat(80));
  console.log("🔄 Checking database migrations...");

  try {
    // Create a temporary connection pool for migrations
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const db = drizzle(pool);

    // Run migrations - Drizzle automatically:
    // 1. Creates __drizzle_migrations table if it doesn't exist
    // 2. Checks which migrations have been applied
    // 3. Applies only the pending ones
    // 4. Does everything in a transaction
    await migrate(db, { migrationsFolder: process.env.MIGRATIONS_FOLDER ?? "./drizzle" });

    console.log("✅ Database migrations completed successfully");
    console.log("=".repeat(80));

    // Close the pool after migrations
    await pool.end();
  } catch (error) {
    console.error("=".repeat(80));
    console.error("❌ Database migration failed!");
    console.error("Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("Stack:", error.stack);
    }
    console.error("=".repeat(80));

    // Exit the process - we don't want to start the server with failed migrations
    process.exit(1);
  }
}
