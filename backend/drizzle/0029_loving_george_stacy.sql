ALTER TABLE "matches" ALTER COLUMN "played_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "confirmation_deadline" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
