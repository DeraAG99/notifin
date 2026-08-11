ALTER TABLE "data_imports" ADD COLUMN "import_category_id" uuid;
--> statement-breakpoint
-- Backfill: create a category from each legacy data_imports.key (name = key)
INSERT INTO "import_categories" ("admin_id", "key", "name", "is_active", "created_at", "updated_at")
SELECT DISTINCT di."admin_id", di."key", di."key", true, now(), now()
FROM "data_imports" di
WHERE di."key" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "import_categories" ic
    WHERE ic."admin_id" = di."admin_id" AND ic."key" = di."key"
  );
--> statement-breakpoint
UPDATE "data_imports" di
SET "import_category_id" = ic."id"
FROM "import_categories" ic
WHERE ic."admin_id" = di."admin_id" AND ic."key" = di."key";
--> statement-breakpoint
ALTER TABLE "data_imports" ALTER COLUMN "import_category_id" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "data_imports_admin_user_key_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "data_imports_admin_user_category_unique" ON "data_imports" USING btree ("admin_id","user_id","import_category_id");
--> statement-breakpoint
ALTER TABLE "data_imports" DROP COLUMN "key";
--> statement-breakpoint
ALTER TABLE "data_imports" DROP COLUMN "name";
--> statement-breakpoint
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_import_category_id_import_categories_id_fk" FOREIGN KEY ("import_category_id") REFERENCES "public"."import_categories"("id") ON DELETE restrict ON UPDATE no action;
