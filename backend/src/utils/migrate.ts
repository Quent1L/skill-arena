import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { logger } from "./logger";

/**
 * Run pending database migrations
 * Should be called before starting the server
 */
export async function runMigrations(): Promise<void> {
  logger.info("Checking database migrations...");

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

    logger.info("Database migrations completed successfully");

    // Close the pool after migrations
    await pool.end();
  } catch (error) {
    logger.fatal({ err: error }, "Database migration failed!");

    // Exit the process - we don't want to start the server with failed migrations
    process.exit(1);
  }
}
