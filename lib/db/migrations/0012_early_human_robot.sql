ALTER TABLE "notification_schedules" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_schedules" ADD COLUMN "target" text DEFAULT 'specific' NOT NULL;--> statement-breakpoint
UPDATE "notification_schedules" SET "target" = 'specific' WHERE "target" IS NULL;