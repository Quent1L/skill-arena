import { db } from "../config/database";
import { sql } from "drizzle-orm";

async function prepare() {
    console.log("Preparing database for migration...");

    try {
        // 1. Drop obsolete tables / dependencies
        console.log("Dropping match_participation...");
        await db.execute(sql`DROP TABLE IF EXISTS match_participation CASCADE`);
        console.log("Dropping match_games...");
        await db.execute(sql`DROP TABLE IF EXISTS match_games CASCADE`);
        console.log("Dropping match_confirmations...");
        await db.execute(sql`DROP TABLE IF EXISTS match_confirmations CASCADE`);

        // 2. Drop new tables if they (partially) exist from failed attempts
        console.log("Dropping match_participant_players/match_participants...");
        await db.execute(sql`DROP TABLE IF EXISTS match_participant_players CASCADE`);
        await db.execute(sql`DROP TABLE IF EXISTS match_participants CASCADE`);

        // 3. Drop matches to allow clean recreation (avoids column drop prompts)
        console.log("Dropping matches...");
        await db.execute(sql`DROP TABLE IF EXISTS matches CASCADE`);

        // 4. Rename tournament_participants if exists
        console.log("Renaming tournament_participants...");
        // Check if table exists first? PG handles IF EXISTS for drop, but not nice for RENAME IF EXISTS (Postgres 9.x+ doesn't support IF EXISTS on RENAME easily directly, but we can try).
        // Better: TRY CATCH the rename.
        try {
            await db.execute(sql`ALTER TABLE tournament_participants RENAME TO tournament_registrations`);
            console.log("Renamed tournament_participants to tournament_registrations");
        } catch (e: any) {
            if (e.code === '42P01') { // undefined_table
                console.log("tournament_participants does not exist (maybe already renamed or fresh db)");
            } else {
                console.log("Rename skipped/failed:", e.message);
            }
        }

        console.log("Preparation complete.");
        process.exit(0);
    } catch (err) {
        console.error("Error during preparation:", err);
        process.exit(1);
    }
}

prepare();
