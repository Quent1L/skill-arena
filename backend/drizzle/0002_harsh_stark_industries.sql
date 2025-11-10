ALTER TABLE "tournaments" RENAME COLUMN "team_size" TO "min_team_size";--> statement-breakpoint
ALTER TABLE "tournaments" DROP CONSTRAINT "team_size_check";--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "max_team_size" integer NOT NULL;