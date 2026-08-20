ALTER TABLE "data_imports" ADD COLUMN "scope" text NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "data_imports" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "data_imports_admin_user_category_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "data_imports_user_unique" ON "data_imports" USING btree ("admin_id","user_id","import_category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_imports_global_unique" ON "data_imports" USING btree ("admin_id","import_category_id") WHERE scope = 'global';