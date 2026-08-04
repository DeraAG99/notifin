-- Migration: Phase 15 - Multi-tenant
-- Run: psql -U postgres -d notifin -f /path/to/0002_tenant.sql
-- OR: bun run db:migrate (if journal entry added)

DO $$
DECLARE
    v_admin_id uuid;
BEGIN
    SELECT id INTO v_admin_id FROM admins ORDER BY created_at ASC LIMIT 1;
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'No admin found — seed first';
    END IF;

    -- Add admin_id column (nullable first for backfill)
    ALTER TABLE users                        ADD COLUMN IF NOT EXISTS admin_id uuid;
    ALTER TABLE notification_templates       ADD COLUMN IF NOT EXISTS admin_id uuid;
    ALTER TABLE notification_schedules      ADD COLUMN IF NOT EXISTS admin_id uuid;
    ALTER TABLE notification_logs          ADD COLUMN IF NOT EXISTS admin_id uuid;
    ALTER TABLE settings                     ADD COLUMN IF NOT EXISTS admin_id uuid;

    -- Backfill to first admin
    UPDATE users                        SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE notification_templates       SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE notification_schedules      SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE notification_logs          SET admin_id = v_admin_id WHERE admin_id IS NULL;
    UPDATE settings                     SET admin_id = v_admin_id WHERE admin_id IS NULL;

    -- NOT NULL
    ALTER TABLE users                        ALTER COLUMN admin_id SET NOT NULL;
    ALTER TABLE notification_templates       ALTER COLUMN admin_id SET NOT NULL;
    ALTER TABLE notification_schedules      ALTER COLUMN admin_id SET NOT NULL;
    ALTER TABLE notification_logs          ALTER COLUMN admin_id SET NOT NULL;
    ALTER TABLE settings                     ALTER COLUMN admin_id SET NOT NULL;

    -- FK constraints (idempotent)
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_admin_id_fk') THEN
        ALTER TABLE users ADD CONSTRAINT users_admin_id_fk FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_admin_id_fkey') THEN
        ALTER TABLE notification_templates ADD CONSTRAINT notification_templates_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_schedules_admin_id_fkey') THEN
        ALTER TABLE notification_schedules ADD CONSTRAINT notification_schedules_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_logs_admin_id_fkey') THEN
        ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_admin_id_fkey') THEN
        ALTER TABLE settings ADD CONSTRAINT settings_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE;
    END IF;

    -- settings: drop old single-key PK, add composite PK
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE settings DROP CONSTRAINT settings_pkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE settings ADD PRIMARY KEY (admin_id, key);
    END IF;

    -- users: drop global uniques, add per-admin uniques
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS users_admin_phone_unique ON users(admin_id, phone);
    CREATE UNIQUE INDEX IF NOT EXISTS users_admin_email_unique ON users(admin_id, email);

END $$;
