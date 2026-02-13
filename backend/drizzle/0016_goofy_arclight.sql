CREATE TABLE "invitation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	CONSTRAINT "invitation_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invitation_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"ip_address" text
);
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2026-01-24 18:35:43.081';--> statement-breakpoint
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_usages" ADD CONSTRAINT "invitation_usages_code_id_invitation_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."invitation_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_usages" ADD CONSTRAINT "invitation_usages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;