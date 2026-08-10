<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Notifin - Project Rules

## Project Overview
WhatsApp & Email notification system with scheduling, templates, and queue management.

## Tech Stack
- **Runtime:** Bun
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **UI:** shadcn/ui + Tailwind CSS v4
- **Queue:** BullMQ + Redis
- **WhatsApp:** Fonnte Gateway API
- **Email:** Nodemailer (SMTP)
- **Validation:** Zod v4

## Critical: Next.js 16 Breaking Changes
- `params` is a **Promise** — always `await params` in route handlers
- Route handlers use standard Web `Request`/`Response` APIs
- Tailwind CSS v4 uses `@import "tailwindcss"` syntax (no config file)
- Server Actions use `'use server'` directive

## Code Conventions
- All API routes go in `app/api/` using `route.ts` files
- Server Actions in separate `actions.ts` files with `'use server'`
- DB queries always go through `lib/db/` layer
- Validation schemas in `lib/validations.ts` using Zod v4
- Shared types in `types/index.ts`
- UI components use shadcn/ui pattern in `components/ui/`

## File Structure
```
app/
  (dashboard)/     # Dashboard layout group
    dashboard/      # Main dashboard
    templates/      # Template management
    users/          # User management
    schedules/      # Schedule management
    logs/           # Notification logs
    settings/       # App settings
  api/              # API route handlers
lib/
  db/               # Database schema, connection, migrations
  template-engine.ts
  fonnte.ts
  email.ts
  queue.ts
  scheduler.ts
  validations.ts
workers/            # Background job processors
```

## Commands
```bash
bun run dev          # Next.js dev server
bun run build        # Production build
bun run worker       # Notification worker
bun run scheduler    # Scheduler worker
bun run dev:all      # All services concurrently
bun run db:push      # Push schema changes
bun run db:seed      # Seed database
bun run lint         # ESLint
bunx tsc --noEmit    # Type check (ALWAYS run after changes)
```

## Important: Evolution API Provider
- Evolution API instance names must be URL-encoded (`encodeURIComponent`) when used in URL paths (`lib/wa/evolution-provider.ts`)
- Trailing spaces in instance names can sneak in via the Manager UI and cause 404 errors
- Integration type for normal WhatsApp Web QR: `"WHATSAPP-BAILEYS"` (hyphen, not underscore)
- Manager UI at `http://localhost:8080/manager/`
- Global API Key: `notifin_evolution_key`
- Instance state values: `"connecting"` (QR shown, not yet scanned), `"open"` (connected/ready)

## Docker Notes
- `evolutionBaseUrl` must use Docker internal DNS: `http://evolution-api:8080`
- `docker compose build web && docker compose up -d web` for code changes
- Six services: postgres, redis, web, worker, scheduler, openwa

## Migration & Redeploy Rules
- JANGAN pernah mengedit migration yang sudah ter-apply (0001-0007). Perubahan schema = selalu buat migration BARU: `bun run db:generate`, commit file `.sql` + snapshot `meta/*`.
- `lib/db/migrate.ts` idempotent — mencatat migration yang sudah jalan di tabel `__drizzle_migrations`, hanya menjalankan yang BARU. Redeploy TIDAK menghapus data.
- Data hanya hilang jika: (a) migration sengaja DROP tabel/kolom, atau (b) `docker compose down -v` menghapus volume postgres. `docker compose down` biasa TIDAK menghapus data.
- Alur deploy: `docker compose build web worker scheduler && docker compose up -d` — migration baru otomatis jalan saat container `web` start (`bun lib/db/migrate.ts && bun run start`).
- Cek status migration: `docker compose logs web | grep -i migrat`.
- Lokal: gunakan `bun run db:push`; file migration tetap di-commit untuk Docker.

## Before Making Changes
1. Always run `npx tsc --noEmit` to verify types
2. Check existing patterns in similar files
3. Use `eq()` from drizzle-orm for WHERE clauses
4. Wrap API handlers in try-catch blocks
5. Return `{ success: boolean, data?, error? }` from all APIs

## Git Conventions
- After completing each phase: commit & push to origin
- Commit format: `feat: Phase X - description` or `docs: description`
- Always update PHASES.md before committing

## Environment Variables
See `.env.example` for all required vars. Never commit secrets.
