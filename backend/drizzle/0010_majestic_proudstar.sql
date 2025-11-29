CREATE TYPE "public"."device_type" AS ENUM('WEB', 'ANDROID', 'IOS');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('MATCH_INVITE', 'MATCH_REMINDER', 'TOURNAMENT_UPDATE', 'SYSTEM_ALERT');--> statement-breakpoint
CREATE TABLE "notification_status" (
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"action_completed" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"action_completed_at" timestamp,
	CONSTRAINT "notification_status_notification_id_user_id_unique" UNIQUE("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title_key" text NOT NULL,
	"message_key" text NOT NULL,
	"action_url" text,
	"requires_action" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"emailed_at" timestamp,
	"pushed_at" timestamp,
	"resent_count" integer DEFAULT 0 NOT NULL,
	"next_reminder_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_type" "device_type" NOT NULL,
	"subscription_endpoint" text NOT NULL,
	"subscription_data" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "played_at" SET DEFAULT '2025-11-24 17:14:31.690';--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_status" ADD CONSTRAINT "notification_status_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_push_devices" ADD CONSTRAINT "user_push_devices_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;