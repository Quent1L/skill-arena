CREATE TYPE "public"."match_team_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TABLE "match_participation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_side" "match_team_side" NOT NULL,
	CONSTRAINT "match_participation_match_id_player_id_unique" UNIQUE("match_id","player_id")
);
--> statement-breakpoint
ALTER TABLE "match_participation" ADD CONSTRAINT "match_participation_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participation" ADD CONSTRAINT "match_participation_player_id_app_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;