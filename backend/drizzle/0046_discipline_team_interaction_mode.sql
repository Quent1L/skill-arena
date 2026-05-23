CREATE TYPE "public"."team_interaction_mode" AS ENUM ('INDIVIDUAL', 'SHARED_RESOURCE', 'COLLABORATIVE');
ALTER TABLE "disciplines" ADD COLUMN "team_interaction_mode" "team_interaction_mode";
