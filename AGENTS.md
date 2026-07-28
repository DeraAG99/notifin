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
- **Email:** Resend
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
