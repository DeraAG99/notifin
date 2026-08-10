CREATE TABLE "import_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"engine" text DEFAULT 'table' NOT NULL,
	"format" text DEFAULT 'html' NOT NULL,
	"detect_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"column_mapping" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "data_imports" ADD COLUMN "engine" text DEFAULT 'table' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_types" ADD CONSTRAINT "import_types_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_types_admin_key_unique" ON "import_types" USING btree ("admin_id","key");