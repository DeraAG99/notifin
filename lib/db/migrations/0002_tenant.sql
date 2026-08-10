-- Ensure a default superadmin exists so the admin_id backfill has a target on fresh databases.
-- Seed script will skip this email afterwards (idempotent).
INSERT INTO "admins" ("email", "password_hash", "name", "role", "is_active", "created_at", "updated_at")
SELECT 'admin@notifin.com', '$2b$10$jKlQ1PVvFhOahW2jN6PZA.TNCBjQTD3bPckP.DeOLgIQW7CcJvgBu', 'Admin Notifin', 'superadmin', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "admins");
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "admin_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD COLUMN "admin_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_schedules" ADD COLUMN "admin_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "admin_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "admin_id" uuid;--> statement-breakpoint
UPDATE "users" SET "admin_id" = (SELECT id FROM "admins" ORDER BY "created_at" LIMIT 1) WHERE "admin_id" IS NULL;--> statement-breakpoint
UPDATE "notification_templates" SET "admin_id" = (SELECT id FROM "admins" ORDER BY "created_at" LIMIT 1) WHERE "admin_id" IS NULL;--> statement-breakpoint
UPDATE "notification_schedules" SET "admin_id" = (SELECT id FROM "admins" ORDER BY "created_at" LIMIT 1) WHERE "admin_id" IS NULL;--> statement-breakpoint
UPDATE "notification_logs" SET "admin_id" = (SELECT id FROM "admins" ORDER BY "created_at" LIMIT 1) WHERE "admin_id" IS NULL;--> statement-breakpoint
UPDATE "settings" SET "admin_id" = (SELECT id FROM "admins" ORDER BY "created_at" LIMIT 1) WHERE "admin_id" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_templates" ALTER COLUMN "admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_schedules" ALTER COLUMN "admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ALTER COLUMN "admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "admin_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_schedules" ADD CONSTRAINT "notification_schedules_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_phone_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";--> statement-breakpoint
CREATE UNIQUE INDEX "users_admin_phone_unique" ON "users" USING btree ("admin_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "users_admin_email_unique" ON "users" USING btree ("admin_id","email");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_admin_id_key_pk" PRIMARY KEY("admin_id","key");
