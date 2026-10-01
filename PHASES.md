# Notifin - Implementation Phases

## Tech Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **UI:** shadcn/ui + Tailwind CSS v4
- **Queue:** BullMQ + Redis
- **WhatsApp:** Fonnte Gateway API
- **Email:** Nodemailer (SMTP)
- **Validation:** Zod v4
- **Charts:** Recharts
- **Scheduler:** node-cron
- **CSV:** PapaParse

---

## Phase 1: Project Scaffolding ✅

### Completed
- [x] Init Next.js 16 project with TypeScript, Tailwind CSS v4, App Router
- [x] Install all production dependencies
- [x] Init shadcn/ui + add 21 components
- [x] Write drizzle.config.ts + .env.example
- [x] Write DB schema (4 tables + 3 enums)
- [x] Write DB connection pool (postgres.js)
- [x] Write migration runner
- [x] Write seed script (5 users, 3 templates, 2 schedules, 10 logs)
- [x] Write shared TypeScript types
- [x] Write utils.ts (cn helper)
- [x] Update package.json scripts

### Files
```
.env.example
drizzle.config.ts
lib/db/schema.ts
lib/db/index.ts
lib/db/migrate.ts
lib/db/seed.ts
types/index.ts
lib/utils.ts
package.json (updated scripts)
components/ui/ (21 shadcn components)
```

### Database Schema
| Table | Description |
|-------|-------------|
| `users` | Recipients (name, phone, email, timezone, metadata) |
| `notification_templates` | Message templates (channel, content, variables) |
| `notification_schedules` | Cron-based schedules (template + user + cron expression) |
| `notification_logs` | Delivery logs (status, error, metadata, timestamps) |

### Enums
- `channel`: `wa`, `email`, `both`
- `status`: `pending`, `sent`, `failed`, `delivered`, `read`
- `priority`: `urgent`, `normal`, `low`

---

## Phase 2: Core Libraries ✅

### Completed
- [x] Template engine (`lib/template-engine.ts`)
  - `{{variable}}` syntax with nested objects
  - Conditionals: `{{#if status}}...{{/if}}`
  - Date formatting: `{{date format="DD/MM/YYYY"}}`
  - Currency formatting: `{{amount format="currency"}}`
- [x] Fonnte WhatsApp client (`lib/fonnte.ts`)
  - sendText, sendMedia, sendTemplate
  - Rate limiting (token bucket)
  - Auto retry 3x with exponential backoff
  - Webhook handler
  - Device status check
- [x] Email client (`lib/email.ts`)
  - Nodemailer (SMTP) integration
  - sendEmail, sendBulkEmail
  - Health check
- [x] Queue setup (`lib/queue.ts`)
  - BullMQ queues: whatsapp-queue, email-queue, scheduled-queue
  - Job types: send-wa, send-email, batch-send
  - Priority levels: urgent(1), normal(2), low(3)
  - Concurrency: WA (10), Email (20)
  - Rate limits: WA (100/min), Email (50/sec)
- [x] Scheduler service (`lib/scheduler.ts`)
  - Load all active schedules
  - Create/update/delete schedules
  - Cron-based execution with node-cron
  - Next run time calculation
- [x] Zod validation schemas (`lib/validations.ts`)
  - All CRUD schemas (users, templates, schedules)
  - Send/batch notification schemas
  - Log filter schema
  - Settings schema
  - Type exports for all schemas

---

## Phase 3: API Routes ✅

### Completed
- [x] CRUD `/api/templates`
  - GET /api/templates (list, filter by channel)
  - POST /api/templates (create)
  - PUT /api/templates/[id] (update)
  - DELETE /api/templates/[id] (delete)
  - POST /api/templates/[id]/preview (preview with sample data)
- [x] CRUD `/api/users`
  - GET /api/users (list with pagination, search)
  - POST /api/users (create single/bulk)
  - PUT /api/users/[id]
  - DELETE /api/users/[id]
- [x] Notifications `/api/notifications`
  - POST /api/notifications/send
  - POST /api/notifications/batch
- [x] CRUD `/api/schedules`
  - GET /api/schedules (list all)
  - POST /api/schedules (create)
  - PUT /api/schedules/[id] (update/toggle)
  - DELETE /api/schedules/[id]
- [x] Webhooks
  - POST /api/webhooks/fonnte (delivery status, incoming messages)
- [x] Logs & Monitoring
  - GET /api/logs (list with filters)
  - GET /api/logs/stats (statistics)
  - GET /api/queue/stats (BullMQ metrics)
- [x] Settings
  - GET/PUT /api/settings (config management + health check)

### Files to Create
```
app/api/templates/route.ts
app/api/templates/[id]/route.ts
app/api/templates/[id]/preview/route.ts
app/api/users/route.ts
app/api/users/[id]/route.ts
app/api/notifications/send/route.ts
app/api/notifications/batch/route.ts
app/api/schedules/route.ts
app/api/schedules/[id]/route.ts
app/api/webhooks/fonnte/route.ts
app/api/logs/route.ts
app/api/logs/stats/route.ts
app/api/queue/stats/route.ts
app/api/settings/route.ts
```

---

## Phase 4: Workers ✅

### Completed
- [x] Notification worker (`workers/notification-worker.ts`)
  - Process WA and email jobs
  - Update notification logs (sent/failed)
  - Error handling with retry support
- [x] Scheduler worker (`workers/scheduler-worker.ts`)
  - Load and process active schedules
  - Graceful shutdown handling
  - Heartbeat logging every 60s

### Files to Create
```
workers/notification-worker.ts
workers/scheduler-worker.ts
```

---

## Phase 5: Frontend - Layout & Dashboard ✅

### Completed
- [x] Root layout update (`app/layout.tsx`)
  - Metadata (title, description)
  - Font configuration
  - Toaster provider
- [x] Dashboard layout (`app/(dashboard)/layout.tsx`)
  - Sidebar navigation
  - Header with date display
  - Mobile responsive sheet menu
- [x] Dashboard page (`app/(dashboard)/dashboard/page.tsx`)
  - Stat cards: Total sent, Delivered, Failed, Pending
  - Chart: Notifications per day (recharts bar chart)
  - Recent logs table
  - Queue health indicator (WA + Email)
- [x] Shared components
  - Loading skeletons (dashboard + table)
  - Empty state with CTA

### Files to Create/Update
```
app/layout.tsx (update)
app/(dashboard)/layout.tsx
app/(dashboard)/dashboard/page.tsx
components/layouts/sidebar.tsx
components/layouts/header.tsx
components/dashboard/stat-cards.tsx
components/dashboard/notification-chart.tsx
components/dashboard/recent-logs.tsx
components/dashboard/queue-health.tsx
```

---

## Phase 6: Frontend - Feature Pages ✅

### Completed
- [x] Templates page (`app/(dashboard)/templates/page.tsx`)
  - Table list with channel badge, search, create button
  - Create/Edit form with channel selection, subject, content, variables
  - Live preview with sample data
  - Delete confirmation
- [x] Template detail (`app/(dashboard)/templates/[id]/page.tsx`)
  - Detail view with variable list, test send button
- [x] Users page (`app/(dashboard)/users/page.tsx`)
  - Table with pagination, search, CRUD operations
  - Import CSV dialog with PapaParse
  - Create/Edit user form with timezone
- [x] Schedules page (`app/(dashboard)/schedules/page.tsx`)
  - Table with template/user info
  - Cron builder with presets (daily, weekly, monthly)
  - Create/Edit form with template/user selection
- [x] Logs page (`app/(dashboard)/logs/page.tsx`)
  - Filterable table (date, channel, status, search)
  - Status badges (color coded)
  - Detail modal with full log info
  - Export to CSV
  - Retry failed notifications
- [x] Settings page (`app/(dashboard)/settings/page.tsx`)
  - System health check (Fonnte, SMTP, Redis, DB)
  - Fonnte config form (token, rate limit)
  - SMTP config form (host, port, user, pass, from)
  - General settings (timezone)

### Files Created
```
app/(dashboard)/templates/page.tsx
app/(dashboard)/templates/[id]/page.tsx
app/(dashboard)/users/page.tsx
app/(dashboard)/schedules/page.tsx
app/(dashboard)/logs/page.tsx
app/(dashboard)/settings/page.tsx
components/templates/template-form.tsx
components/templates/template-preview.tsx
components/users/user-form.tsx
components/users/csv-import.tsx
```

---

## Phase 7: React Email Templates ✅

### Completed
- [x] Welcome email (`emails/welcome.tsx`)
  - React Email component with Tailwind-like styles
  - Props: name, loginUrl
- [x] Notification email (`emails/notification.tsx`)
  - React Email component for message delivery
  - Props: title, message, recipientName, actionUrl, actionLabel
- [x] Template renderer (`lib/email-templates.ts`)
  - renderWelcomeEmail(), renderNotificationEmail()
  - Renders React components to HTML strings via @react-email/render
- [x] Updated `lib/email.ts`
  - Added sendWelcomeEmail() and sendNotificationEmail() helpers
  - Uses template renderer + Nodemailer SMTP

### Files Created/Modified
```
emails/welcome.tsx
emails/notification.tsx
lib/email-templates.ts (new)
lib/email.ts (updated with template helpers)
```

---

## Phase 8: Polish & Finishing ✅

### Completed
- [x] `loading.tsx` for all dashboard routes (dashboard, templates, users, schedules, logs)
- [x] `error.tsx` for dashboard layout
- [x] `not-found.tsx` for dashboard
- [x] README.md with setup instructions
- [x] Final TypeScript check (clean)
- [x] ESLint check (3 React Compiler false positives, 46 unused var warnings - non-blocking)

### Files Created/Modified
```
app/(dashboard)/dashboard/loading.tsx (new)
app/(dashboard)/templates/loading.tsx (new)
app/(dashboard)/users/loading.tsx (new)
app/(dashboard)/schedules/loading.tsx (new)
app/(dashboard)/logs/loading.tsx (new)
app/(dashboard)/error.tsx (new)
app/(dashboard)/not-found.tsx (new)
README.md (new)
```

---

## Phase 10: Landing Page ✅

### Completed
- [x] Convert `theme/landingpage.html` to Next.js App Router landing page at `app/page.tsx`
- [x] Add landing design tokens (`nf-*`) + custom classes (brand-gradient, glass-panel, reveal, nav-glass, hero-title-text, stat-card) to `app/globals.css`
- [x] Add Hanken Grotesk + JetBrains Mono fonts (next/font) and updated metadata in `app/layout.tsx`
- [x] `components/landing/reveal.tsx` — client IntersectionObserver scroll-reveal animation
- [x] Replace Material Symbols with lucide-react (consistent with codebase)
- [x] All CTAs link to `/login`; `next.config.ts` remotePatterns for `lh3.googleusercontent.com` images
- [x] `bun run build` clean — `/` prerendered static
- [x] Fix gradient text bug — `.brand-gradient` uses `background-image` (was `background:` shorthand resetting `background-clip` → invisible text)
- [x] Add real logo/favicon from design assets: `public/notifin-logo.svg` (transparent banner: gradient bell icon + NOTIFIN wordmark + tagline, extracted from 15MB asset, chroma-keyed transparent) + `public/icon.svg` favicon (registered via `metadata.icons`)
- [x] Interactivity: `tilt.tsx` (3D hover), `countup.tsx` (animated stats), `cursor-glow.tsx` (mouse spotlight), `mobile-nav.tsx` (hamburger menu), `.btn-shine` (button sweep), animated `.gradient-text`
- [x] Responsive: bento shows from `md` breakpoint + compact mobile mockup, responsive title/CTA sizes
- [x] Login page redesign to match `theme/loginpage.html`: glass card, brand-gradient CTA, `.form-input` focus glow, logo header, password toggle, ambient orbs, reveal animation (`app/(auth)/login/page.tsx` + layout)
- [x] Register page matching login theme (`app/(auth)/register/page.tsx`): glass card, Full Name / Work Email / Password / Confirm Password fields, terms checkbox, brand-gradient "Create Account" CTA, ambient orbs
- [x] `POST /api/auth/register` — validates via `registerSchema`, checks email uniqueness (409), hashes password (bcrypt), creates admin with role `admin`, auto-login (sets session cookie, same as login)
- [x] `register()` added to `lib/auth/context.tsx`; login footer links to `/register`; middleware allows `/register` publicly + redirects authed users away from it
- [x] Login CTA renamed from "Secure Sign In" → "Sign In"
- [x] Dashboard re-themed to match landing/login: shadcn `:root` tokens overridden to dark `nf` palette (`#061423` bg, `#0e1b2b` cards, `#41ddc2` primary/ring, translucent white borders) — all shadcn components across dashboard go dark automatically
- [x] Dashboard layout: `bg-nf-bg` + fixed ambient orbs + `dashboard-bg` radial accents
- [x] Sidebar: dark glass (`#081627`/90 + blur), logo image in header, teal accent for active/hover items, `font-label` uppercase group labels
- [x] Header: glass bar, `font-label` uppercase page title, date in muted text
- [x] Dashboard page: `hero-title-text` gradient heading; stat cards / chart / queue / recent-logs restyled with `nf-card` glass + dark translucent badges; recharts dark axes/tooltip/legend, bars `#25D366` + `#41ddc2`
- [x] Fixed hardcoded light colors in feature pages (green/red translucent badges in templates preview, template form, template detail, CSV import, log error box)

### Files Modified/Created
```
app/page.tsx (rewritten as landing page)
app/globals.css (landing tokens + classes)
app/layout.tsx (fonts + metadata + favicon icons)
next.config.ts (remote images)
middleware.ts (allow / without auth; redirect authed users to /dashboard)
components/landing/reveal.tsx (new)
components/landing/tilt.tsx (new)
components/landing/countup.tsx (new)
components/landing/cursor-glow.tsx (new)
components/landing/mobile-nav.tsx (new)
public/notifin-logo.svg (new — brand logo, transparent bg)
public/icon.svg (new — favicon, from design asset)
theme/landingpage.html (design source)
app/(auth)/register/page.tsx (new)
app/api/auth/register/route.ts (new)
lib/auth/context.tsx (register added)
app/(dashboard)/layout.tsx (dark theme + orbs)
components/layouts/sidebar.tsx (dark glass + logo)
components/layouts/header.tsx (glass header)
app/(dashboard)/dashboard/page.tsx (gradient title)
components/dashboard/stat-cards.tsx (dark glass cards)
components/dashboard/notification-chart.tsx (dark chart)
components/dashboard/recent-logs.tsx (dark badges)
components/dashboard/queue-health.tsx (dark theme)
app/(dashboard)/templates/[id]/page.tsx (badge colors)
app/(dashboard)/logs/page.tsx (error box colors)
components/templates/template-form.tsx (badge colors)
components/templates/template-preview.tsx (badge colors)
components/users/csv-import.tsx (badge colors)
```

---

## Phase 11: Theme Toggle & Landing i18n ✅

### Completed
- [x] `lib/theme/provider.tsx` — new `ThemeProvider` (light / dark / system): persists choice to `localStorage("theme")`, resolves system preference via `matchMedia`, toggles `.dark` class + `color-scheme` on `<html>`, syncs `<meta name="theme-color">`; wraps whole app inside `Providers`
- [x] FOUC-prevention inline script in `app/layout.tsx` `<head>` — applies saved/system dark class before first paint
- [x] `app/globals.css`: light `:root` tokens (background `#f4f6fb`, teal primary, light `nf-*` palette, light sidebar) + existing dark palette moved to `.dark`; theme-aware variants for `.glass-panel`, `.nav-glass`, `.stat-card`, `.nf-card`, `.hero-title-text`, `.form-input` (focus glow), orbs opacity
- [x] `components/layouts/theme-toggle.tsx` — Sun/Moon dropdown (Light/Dark/System), translated labels via i18n, current-mode icon adapts to resolved theme
- [x] Toggle placed in: dashboard header (next to language switcher), auth layout (fixed top-right corner), landing navbar (desktop + mobile)
- [x] Landing page converted to client component + full i18n: all strings now live in `lib/i18n/en.json` / `id.json` under `landing.*` (nav, hero, bento, features, stats, visual section, CTA, footer)
- [x] Landing `text-white*` / `border-white*` hardcoded colors replaced with theme-aware `nf-*` tokens (light mode readable)
- [x] `components/landing/mobile-nav.tsx` — translated labels + LanguageSwitcher/ThemeToggle row in menu
- [x] Light-mode fixes in auth + dashboard: checkbox icons use `nf-on-secondary-container`, checkbox borders `nf-outline/30`, card shadows `black/20 dark:black/50`, sidebar/header use `bg-sidebar` / `bg-background` tokens, status badges + stat icons use `*-600 dark:*-400` variants
- [x] `bunx tsc --noEmit` clean + `bun run build` clean; smoke-tested `/` (renders in ID by default), `/login` (200), `/dashboard` (307 auth redirect); CSS contains both light + dark token sets

### Files Modified/Created
```
lib/theme/provider.tsx (new)
components/layouts/theme-toggle.tsx (new)
components/layouts/providers.tsx (ThemeProvider added)
app/layout.tsx (FOUC script in head)
app/globals.css (light/dark token variants)
lib/i18n/en.json (landing.* + theme labels)
lib/i18n/id.json (landing.* + theme labels)
app/page.tsx (client + i18n + theme-aware)
components/landing/mobile-nav.tsx (i18n + switchers)
app/(auth)/layout.tsx (theme/lang switchers)
components/layouts/header.tsx (ThemeToggle + token colors)
components/layouts/sidebar.tsx (token colors)
app/(auth)/login/page.tsx (light-mode fixes)
app/(auth)/register/page.tsx (light-mode fixes)
components/dashboard/recent-logs.tsx (badge variants)
components/dashboard/queue-health.tsx (light-mode fixes)
components/dashboard/stat-cards.tsx (icon variants)
```

---

## Phase 12: Theme Default + Logo Readability Fixes ✅

### Completed
- [x] **Dark is default again** — `ThemeProvider` now initializes to `dark` (not `system`); saved `light`/`dark`/`system` preferences still respected. FOUC script in `app/layout.tsx` defaults to dark when no theme is saved, so the site no longer flashes/applies the default shadcn light palette on light-OS machines
- [x] `app/globals.css` — new `.nf-logo` class: `filter: brightness(0.3)` in light mode, `filter: none` in `.dark`; makes the light-blue banner `notifin-logo.svg` readable on white/near-white backgrounds while keeping the original bright logo on dark
- [x] `nf-logo` applied to logo `<img>` in landing (`app/page.tsx`), login, and register
- [x] Verified end-to-end via headless Edge + CDP (Bun WebSocket client): no saved theme + light `prefers-color-scheme` → `.dark` applied; saved `light` → light palette + logo `brightness(0.3)`; saved `dark` → original dark palette + logo un-filtered. Root cause of the "dark uses default colors" report: theme followed OS (`system` default) + hardcoded-dark legacy classes, plus a stale production server squatted on port 3000 during testing
- [x] `bunx tsc --noEmit` clean + `bun run build` clean; `.nf-logo` + `.dark .nf-logo` present in compiled CSS

### Files Modified
```
lib/theme/provider.tsx (default theme dark)
app/layout.tsx (FOUC script defaults to dark)
app/globals.css (.nf-logo light/dark variants)
app/page.tsx (logo nf-logo class)
app/(auth)/login/page.tsx (logo nf-logo class)
app/(auth)/register/page.tsx (logo nf-logo class)
```

---

## Phase 9: Docker/VPS Deployment Fixes ✅

### Completed
- [x] Fix `REDIS_URL` port bug in docker-compose (was using `${REDIS_PORT}` as container port; internal Redis port is always 6379) — applied to web, worker, scheduler
- [x] Add `COOKIE_SECURE` env toggle so session cookie can work over plain HTTP (VPS without HTTPS)
- [x] Refactor login route to use `getCookieOptions()` from `lib/auth/session.ts` (single source of truth)
- [x] Add 60s TTL to WA provider cache (`lib/wa/index.ts`) so API key/config changes propagate to worker/scheduler without restart (was cached forever → stale key caused OpenWA 403 "Insufficient permissions")

### Files Modified
```
docker-compose.yml
lib/auth/session.ts
lib/wa/index.ts
app/api/auth/login/route.ts
.env.docker.example
```

---

## Phase 13: Theme Alignment, Auth Fixes & DB Tooling

### Completed
- [x] Align dark theme tokens (`globals.css` `.dark`) with `theme/landingpage.html` palette (background, surface containers, primary/secondary, outline, error)
- [x] Align light theme `:root` tokens with the brand palette (primary `#2563eb`, secondary `#00a58f`, ring, sidebar, charts)
- [x] Add `.dark` overrides for `nf-*` tokens so dashboard/login/landing match the landing page in dark mode
- [x] Make `migrate.ts`, `seed.ts`, `drizzle.config.ts`, `lib/db/index.ts` load `.env.local` (previously fell back to system user causing auth failures)
- [x] Sync local DB schema via `drizzle-kit push` (created missing `admins` table + `admin_role` enum)
- [x] Fix seed to run under Bun runtime (`db:seed` now `bun run lib/db/seed.ts`) so `Bun.password` works
- [x] Fix 500 on `POST /api/auth/login`: replace `Bun.password` (Node-incompatible) with `bcryptjs` in `lib/auth/session.ts`
- [x] Seed default admin: `admin@notifin.com` / `admin123` (superadmin)
- [x] Light-theme logo: generate `public/notifin-logo-dark.svg` (navy text variant), add theme-aware `NotifinLogo` component, remove `brightness(0.3)` hack

### Files Modified
```
app/globals.css
app/page.tsx
app/(auth)/login/page.tsx
app/(auth)/register/page.tsx
app/(dashboard)/settings/page.tsx
components/layouts/notifin-logo.tsx  (new)
public/notifin-logo-dark.svg  (new)
lib/auth/session.ts
lib/db/index.ts
lib/db/migrate.ts
lib/db/seed.ts
drizzle.config.ts
package.json
bun.lock
```

---

## Phase 14: SMTP Config from DB + Connection Security Option

### Completed
- [x] Make `lib/email.ts` read SMTP config from DB settings (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpSecure`, `emailFrom`) with env fallback — previously it only read `process.env.SMTP_*` so SMTP saved via Settings UI was never used by sending or the health check
- [x] Add `smtpSecure` setting (`ssl` | `starttls` | `none`) persisted via `/api/settings` + Zod validation
- [x] Add Connection Security dropdown to Settings > Email UI (SSL/TLS implicit, STARTTLS, None) with EN/ID i18n labels
- [x] Nodemailer transport maps `ssl` → `secure: true`, `starttls` → `requireTLS`, `none` → plain
- [x] Add `resetEmailTransporter()` + call it from the settings PUT route when SMTP config changes (cache TTL 60s)
- [x] Reset stale admin password hash in local DB (was no longer verifiable) back to bcryptjs hash so login works

### Files Modified
```
app/(dashboard)/settings/page.tsx
app/api/settings/route.ts
lib/email.ts
lib/i18n/en.json
lib/i18n/id.json
lib/validations.ts
```

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run worker` | Start notification worker |
| `bun run scheduler` | Start scheduler worker |
| `bun run dev:all` | Start all services concurrently |
| `bun run db:generate` | Generate Drizzle migrations |
| `bun run db:push` | Push schema to database |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run db:seed` | Seed database with sample data |
| `bun run lint` | Run ESLint |

---

## Phase 15: Multi-Tenant SaaS ✅

### Scope
Every admin sees only their own data; superadmin sees all.

### Changes
- [x] Add `adminId` (FK→admins, NOT NULL) to `users`, `notificationTemplates`,
      `notificationSchedules`, `notificationLogs`, `settings`
- [x] Settings PK changed to composite `(adminId, key)` — per-admin settings store
- [x] Per-admin unique indexes `(adminId, phone)` + `(adminId, email)` on users
- [x] Blindshell migration: add column → backfill to first admin → set NOT NULL → add FK
- [x] `lib/email.ts` — per-admin SMTP: `getSetting(adminId, key)`, `getSmtpConfig(adminId)`,
      `Map<string, Transporter>` cache, `sendEmail(adminId, params)`, `resetEmailTransporter(adminId?)`
- [x] `lib/wa/index.ts` — `Map<string, CachedEntry>` per-admin provider cache,
      `getWaProvider(adminId)`, `getWaHealth(adminId)`, `resetWaProvider(adminId?)`
- [x] `lib/wa/baileys-manager.ts` — `Map<string, BaileysManager>` per-admin singletons,
      settings writes include `adminId`, per-admin auth dir (`.baileys-auth/<adminId>`)
- [x] `lib/wa/baileys-provider.ts` — constructor takes `adminId`, per-admin DB settings read
- [x] `lib/queue.ts` — `adminId: string` in `NotificationJobData` + `BaileysConnectData`
- [x] `lib/scheduler.ts` — `adminId` in `ScheduleConfig`, jobs carry `adminId`
- [x] `workers/notification-worker.ts` — `getWaProvider(adminId)`, `sendEmail(adminId, ...)`,
      `autoConnectBaileys()` loops all admins with `waProvider=baileys`,
      `handleBaileysConnect(job)` reads `job.data.adminId`
- [x] `lib/auth/api.ts` — `getSession`, `unauthorizedResponse`, `isSuperadmin` helpers
- [x] `lib/db/seed.ts` — all inserts include `adminId` from first admin
- [x] Isolation test: `admin2` logs in → 0 users / templates / logs

### API Changes
| Route | Before | After |
|-------|--------|-------|
| `GET /api/*` | return all tenant data | filter by `session.adminId` unless superadmin |
| `POST /api/*` | tenant insert w/o FK | always include `session.adminId` |
| `PUT/DELETE /api/*/id` | no ownership check | `where id = ? AND adminId = ?` (superadmin bypass) |
| `GET/PUT /api/settings` | global | per-admin |
| `POST /api/baileys/connect` | no arg | passes `adminId` to queue job |
| `GET /api/baileys/status` | global | per-admin |
| `GET /api/baileys/qr` | global | per-admin |
| All API routes | no auth | 401 if no session cookie |

---

## Phase 16: Superadmin Admin Management (SaaS) ✅

### Scope
Superadmin CRUD admin (tenant organization) accounts. Open registration locked — admin accounts are only created by superadmin.

### Changes
- [x] Validations: `createAdminSchema` + `updateAdminSchema` (name, email, password, isActive) in `lib/validations.ts`
- [x] Types: `AdminRole`, `Admin`, `AdminSummary` (incl. `userCount`), `AdminFormInput` in `types/index.ts`
- [x] `forbiddenResponse()` helper (403) in `lib/auth/api.ts`
- [x] `GET /api/admins` — superadmin only; search (name/email) + pagination + per-admin `userCount` subquery
- [x] `POST /api/admins` — superadmin only; role fixed to `admin`, bcrypt hash, 409 on duplicate email
- [x] `PATCH /api/admins/[id]` — superadmin only; update name/email/isActive + optional password reset; guards: cannot edit a superadmin account, 409 on duplicate email
- [x] `DELETE /api/admins/[id]` — superadmin only; guards: cannot delete self, cannot delete superadmin account (cascades users/templates/schedules/logs)
- [x] Registration locked: `POST /api/auth/register` → 403; `app/(auth)/register/page.tsx` removed; login footer link removed; `/register` dropped from middleware public paths; `register()` removed from `lib/auth/context.tsx`; dead `registerSchema` removed
- [x] `app/(dashboard)/admins/page.tsx` — table (name, email, role badge, user count, status, created date) + create/edit dialog + delete dialog + role-guard redirect; `loading.tsx`
- [x] `components/admins/admin-form.tsx` — create/edit form with optional password reset + isActive switch
- [x] Sidebar — "Admin" menu item rendered only when `user.role === "superadmin"`
- [x] i18n keys: `nav.admins` + `admins.*` in `lib/i18n/en.json` & `id.json`
- [x] `bunx tsc --noEmit` clean (lint baseline pre-existing errors unchanged)

### Files Created/Modified
```
lib/validations.ts (admin schemas)
types/index.ts (Admin types)
lib/auth/api.ts (forbiddenResponse)
app/api/admins/route.ts (new)
app/api/admins/[id]/route.ts (new)
app/api/auth/register/route.ts (locked → 403)
app/(dashboard)/admins/page.tsx (new)
app/(dashboard)/admins/loading.tsx (new)
components/admins/admin-form.tsx (new)
components/layouts/sidebar.tsx (superadmin nav)
app/(auth)/register/page.tsx (removed)
app/(auth)/login/page.tsx (footer link removed)
lib/auth/context.tsx (register removed)
middleware.ts (/register removed from public paths)
lib/i18n/en.json (admins.* keys)
lib/i18n/id.json (admins.* keys)
PHASES.md (this update)
```

### API Changes
| Route | Access | Notes |
|-------|--------|-------|
| `GET /api/admins` | superadmin | list + search + pagination + userCount |
| `POST /api/admins` | superadmin | create admin (role admin) |
| `PATCH /api/admins/[id]` | superadmin | update / reset password (not superadmin) |
| `DELETE /api/admins/[id]` | superadmin | delete (not self, not superadmin) |
| `POST /api/auth/register` | closed | always 403 |

---

## Phase 17: Schedules UX - Human-readable Cron & Month Presets ✅

### Scope
Make the schedules list easy to read: no raw UUIDs, cron shown as plain language, plus "start of month" / "end of month" presets.

### Changes
- [x] `lib/cron-utils.ts` (new) — `describeCron(expression, locale)`: converts 5-field cron into human-readable ID/EN text (every minute/hour, daily/weekly at time, weekday ranges, day-of-month lists, `L` = end of month); falls back to raw expression
- [x] Schedules table — template & user columns now show **names** (looked up from fetched options) instead of UUID slices; cron column shows readable description + raw cron as small caption
- [x] New presets in schedule form: **Start of month** (`0 9 1 * *`) and **End of month** (`0 9 L * *`); removed redundant `monthly1st` (same as start of month)
- [x] `lib/scheduler.ts` — `calculateNextRun` rewritten: correctly resolves day-of-month (numeric/lists/ranges/`L`), month, and day-of-week so "Next Run" is accurate (e.g. next Monday, last day of month)
- [x] Verified node-cron v4 supports `L` in day-of-month (`cron.validate` + `getNextRun`)
- [x] i18n keys `startOfMonth` / `endOfMonth` in `schedules.presets` (en/id); `monthly1st` removed
- [x] `bunx tsc --noEmit` clean

### Files Created/Modified
```
lib/cron-utils.ts (new)
app/(dashboard)/schedules/page.tsx (names + readable cron + presets)
lib/scheduler.ts (calculateNextRun day/month/dow handling)
lib/i18n/en.json (presets)
lib/i18n/id.json (presets)
PHASES.md (this update)
```

---

## Phase 18: Server Timezone Alignment ✅

### Scope
Ensure cron schedules & "next run" are computed against the correct timezone (Asia/Jakarta default), not the container's UTC clock.

### Changes
- [x] `docker-compose.yml` — set `TZ: ${TZ:-Asia/Jakarta}` on `web`, `worker`, `scheduler` services (containers previously ran UTC, so `0 9 * * *` fired at 09:00 UTC = 16:00 WIB)
- [x] `lib/scheduler.ts` — timezone-aware scheduling:
  - `cron.schedule(expr, fn, { timezone })` now passes each admin's `defaultTimezone` setting (from `settings` table), falling back to `DEFAULT_TIMEZONE` env → `Asia/Jakarta`
  - `getAdminTimezone(adminId)` reads per-admin setting; `isValidTimezone()` validates via `Intl`; invalid values fall back safely
  - `calculateNextRun(expr, timezone)` rewritten to compute in the target timezone via UTC-based virtual clock (fixed-offset; correct for Asia/* non-DST zones) — matches node-cron's `getNextRun` for Jakarta/Jayapura/Makassar, incl. `1,L` & `L`
  - `loadSchedules` now selects `adminId` so each schedule is scheduled in its admin's timezone
- [x] `app/api/settings/route.ts` — GET returns `serverTime` (ISO) + `serverTimezone` (IANA) so admins can verify the server clock from the UI
- [x] `app/(dashboard)/settings/page.tsx` — System Health card shows Server Time (in server timezone), Server Timezone, and the configured Default Timezone
- [x] i18n keys `serverTime` / `serverTimezone` in en.json & id.json
- [x] Verified: dev machine is `SE Asia Standard Time` (WIB, +07:00); node-cron v4 timezone option works and throws on invalid zones; `bunx tsc --noEmit` clean; `docker compose config` valid

### Files Created/Modified
```
docker-compose.yml (TZ on web/worker/scheduler)
lib/scheduler.ts (timezone-aware cron + next-run)
app/api/settings/route.ts (serverTime/serverTimezone)
app/(dashboard)/settings/page.tsx (server clock display)
lib/i18n/en.json (settings.serverTime/timezone)
lib/i18n/id.json (settings.serverTime/timezone)
PHASES.md (this update)
```

---

## Phase 19: Admin Account Expiry Date ✅

### Scope
Regular admin accounts can have an expiry date — login is blocked automatically after that date. Superadmin has no expiry.

### Changes
- [x] Schema: `admins.expiresAt` (`expires_at` timestamp, nullable) + migration `0003_sudden_angel.sql` (via `drizzle-kit push`)
- [x] Validations: `expiresAt` (nullable ISO datetime) added to `createAdminSchema` & `updateAdminSchema`
- [x] Types: `Admin.expiresAt`, `AdminFormInput.expiresAt`
- [x] `POST /api/admins` & `PATCH /api/admins/[id]` — accept & persist `expiresAt` (empty → `null` removes expiry); superadmin accounts remain uneditable
- [x] `GET /api/admins` — includes `expiresAt` in list response
- [x] `POST /api/auth/login` — rejects expired admins: `expiresAt < now` → 401 "Akun telah kedaluwarsa"
- [x] Admin form (`components/admins/admin-form.tsx`) — date input "Expiry Date" (min = today); empty = no expiry; shown for admin create/edit only
- [x] Admins table — "Expires" column: date badge, or red "Expired" badge when past; `—` for superadmin/none
- [x] i18n keys `admins.expires`, `admins.expired`, `admins.form.expiresAt`, `admins.form.expiresAtHint` (en/id)
- [x] `bunx tsc --noEmit` clean

### Notes
- Dev DB had leaked 97 idle connections (postgres.js pool re-created on Next hot reload without closing) blocking migrations — cleaned via `pg_terminate_backend` before pushing.

### Files Created/Modified
```
lib/db/schema.ts (expiresAt)
lib/db/migrations/0003_sudden_angel.sql (new)
lib/validations.ts (expiresAt)
types/index.ts (expiresAt)
app/api/admins/route.ts (expiresAt in list/create)
app/api/admins/[id]/route.ts (expiresAt in update)
app/api/auth/login/route.ts (expiry check)
components/admins/admin-form.tsx (date field)
app/(dashboard)/admins/page.tsx (expires column + expired badge)
lib/i18n/en.json (admins keys)
lib/i18n/id.json (admins keys)
PHASES.md (this update)
```

---

## Phase 20: Enforce Inactive/Expired Admin Blocking ✅

### Scope
An inactive or expired admin must not trigger any notifications: schedules don't fire, queued jobs don't send, WhatsApp doesn't auto-connect. Enforcement-only (no data mutation).

### Changes
- [x] `lib/admin-status.ts` (new) — `isAdminActive(adminId)`: `isActive === true` AND (`expiresAt` IS NULL OR `expiresAt > now`); false on lookup error
- [x] `lib/scheduler.ts` — `loadSchedules` now `innerJoin(admins)` filtered to active & non-expired admins; `processSchedule` guards with `isAdminActive(schedule.adminId)`
- [x] `workers/notification-worker.ts` —
  - `processNotification`: skips job for inactive/expired admin, marks log `failed` ("Admin tidak aktif atau kedaluwarsa"), returns **without throwing** (no BullMQ retry)
  - `autoConnectBaileys`: only connects admins that are active & non-expired
  - `handleBaileysConnect`: rejects connect jobs for inactive/expired admins
- [x] `POST /api/notifications/send` & `/api/notifications/batch` — 403 via `forbiddenResponse()` when admin inactive/expired (covers still-live session cookies)
- [x] Verified against local DB: active superadmin → `true`; expired admin → `false`; `bunx tsc --noEmit` clean

### Notes
- Admin/user data is untouched; reactivation simply re-enables sending. Time-based expiry is handled naturally at processing time (no background job needed).

### Files Created/Modified
```
lib/admin-status.ts (new)
lib/scheduler.ts (loadSchedules join + processSchedule guard)
workers/notification-worker.ts (guards + autoConnect filter)
app/api/notifications/send/route.ts (403 guard)
app/api/notifications/batch/route.ts (403 guard)
PHASES.md (this update)
```

---

## Phase 21: Baileys Provider in Settings UI ✅

### Scope
Expose Baileys (WhatsApp Web) as a selectable provider in the Settings UI, with per-admin QR connect flow. Each admin keeps its own independent session.

### Background (already existed)
- Per-admin instances: `BaileysManager` `Map<adminId, ...>`, own auth dir `.baileys-auth/<adminId>`, per-admin QR/status in `settings` table
- Worker `autoConnectBaileys` connects only admins with `waProvider = baileys`
- API endpoints `/api/baileys/connect`, `/api/baileys/qr`, `/api/baileys/status` (all scoped to `session.adminId`)

### Changes
- [x] `app/(dashboard)/settings/page.tsx`:
  - `WaProvider` type + provider card + icon (`Smartphone`) for **Baileys (WhatsApp Web)**
  - Baileys panel: connection status (Connected / Reconnecting / Not connected), **Connect WhatsApp** button (`POST /api/baileys/connect`), QR image from `/api/baileys/status` with auto-poll every 4s, last-seen, per-admin session note, and ban-risk warning box (parity with Fonnte/OpenWA panels)
  - Health card provider label now handles `baileys`
  - Saving settings while Baileys selected auto-triggers connect
- [x] `app/api/baileys/connect/route.ts` — guard with `isAdminActive` (403 if inactive/expired), consistent with Phase 20
- [x] i18n keys `settings.providerBaileys*`, `settings.baileys*` (en/id)
- [x] Verified: login + `/api/baileys/status` + `/api/baileys/qr` return clean responses; `bunx tsc --noEmit` clean; JSON valid

### Resource note
1 Baileys session ≈ 20–50MB RAM + 1 persistent WebSocket. Fine for tens of admins on a standard VPS; the real limit is WhatsApp's per-IP connection/ban policy — one admin = one WhatsApp number. Hundreds of admins would need worker sharding.

### Files Created/Modified
```
app/(dashboard)/settings/page.tsx (provider + Baileys panel + polling)
app/api/baileys/connect/route.ts (isAdminActive guard)
lib/i18n/en.json (baileys keys)
lib/i18n/id.json (baileys keys)
PHASES.md (this update)
```

---

## Phase 22: Disconnect Baileys on Provider Switch ✅

### Scope
When an admin switches their WhatsApp provider away from Baileys, the worker must actually close the Baileys socket (the manager lives in the worker process, so a direct call from the web process would be a no-op).

### Changes
- [x] `lib/queue.ts` — `BaileysConnectData` → `BaileysJobData` with `type: "baileys-connect" | "baileys-disconnect"`; added `addBaileysDisconnectJob(adminId)`
- [x] `workers/notification-worker.ts` — `handleBaileysJob` handles both types: `baileys-disconnect` → `BaileysManager.disconnect(adminId)` (closes socket, removes instance, writes `baileys_connected=false`); `baileys-connect` keeps existing guard/flow
- [x] `lib/wa/baileys-manager.ts` — new static `BaileysManager.disconnect(adminId)` (close + remove from instance map)
- [x] `app/api/settings/route.ts` — on `PUT`, when `waProvider` changes from `baileys` to another value, queues a `baileys-disconnect` job (worker does the actual close); removed web-process direct call
- [x] Removed now-unused `disconnectBaileys` from `lib/wa/index.ts`
- [x] `bunx tsc --noEmit` clean

### Files Created/Modified
```
lib/queue.ts (BaileysJobData + disconnect job)
workers/notification-worker.ts (handleBaileysJob)
lib/wa/baileys-manager.ts (static disconnect)
app/api/settings/route.ts (queue disconnect on provider switch)
lib/wa/index.ts (removed dead helper)
PHASES.md (this update)
```

---

## Phase 23: Per-User Data Import → Metadata (generic "imports") ✅

### Scope (final)
Per-user data import (HTML + Excel) with a **generic SaaS-friendly name** — "Data Import" (`imports`) — stored as **user metadata** so it's available as template variables. No domain-specific naming, no reminder engine. Notifications reuse the existing Schedule feature.

### Naming (generic, no "renaksi" anywhere in source)
| Item | Value |
|------|-------|
| Page route | `app/(dashboard)/users/[id]/imports/page.tsx` (stacked: Import + Data) |
| API | `POST/GET/DELETE /api/users/[id]/imports` |
| Metadata | `users.metadata.imports` |
| Template vars | `{{imports.summary.itemCount}}`, `{{imports.summary.pendingPerTriwulan.3}}` |
| Canonical type | `ImportItem` |
| Parser source id | `ekinerja` (internal) |
| i18n | `imports.*` ("Data Import") |

### Changes
- **Halaman** `users/[id]/imports` — header (Kembali → /users, nama user), **Panel Import** (dropzone .html/.xlsx → client parse → preview + warnings → submit), **Panel Data** (fileName, itemCount, badge pending per TW1–4, tree intervensi → RHK → indikator → outputs + TW/realisasi badge, tombol Hapus; empty state). `loading.tsx`.
- **API** `app/api/users/[id]/imports/route.ts` — writes `users.metadata.imports` (merge, never clobbers other metadata): `{ fileName, period, importedAt, items[], summary {itemCount, pendingPerTriwulan} }`; guards session + admin scope + `isAdminActive`.
- **Users page** — per-row **Data Import** button navigates to `/users/{id}/imports` (dialog removed).
- **Parser** — `lib/imports/` generic: `ImportItem` type, `ekinerja` source, HTML parser (validated on real e-TPP file: 12 items, 0 errors) + XLSX (SheetJS, best-effort, lazy-loaded; needs a real sample to finalize columns).
- **Scheduler fix** — `processSchedule` uses `mergeVariables(user)` so scheduled templates can use `{{imports...}}`.
- Removed: `renaksi-dialog.tsx`, all "renaksi" naming (routes, types, i18n).

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: login → create user → parse (source `ekinerja`, 12 items/0 errors) → `POST /imports` → `metadata.imports` has items+summary → template renders `{{imports.summary.itemCount}}`=12, `{{imports.summary.pendingPerTriwulan.3}}`=3, `{{imports.fileName}}` → DELETE → cleanup.
- PDF intentionally skipped (scanned images → OCR unreliable).

### Files Created/Modified
```
app/(dashboard)/users/[id]/imports/page.tsx (new)
app/(dashboard)/users/[id]/imports/loading.tsx (new)
app/api/users/[id]/imports/route.ts (renamed from .../renaksi)
lib/imports/types.ts (ImportItem, source 'ekinerja')
lib/imports/registry.ts (source 'ekinerja')
lib/imports/parsers/ekinerja/html.ts (renamed from .../ekinerja-renaksi)
lib/imports/parsers/ekinerja/xlsx.ts (renamed)
lib/validations.ts (importItemSchema, createImportSchema)
lib/i18n/en.json (imports.*)
lib/i18n/id.json (imports.*)
app/(dashboard)/users/page.tsx (navigate to imports page)
components/users/renaksi-dialog.tsx (removed)
lib/scheduler.ts (mergeVariables)
PHASES.md (this update)
```

---

## Phase 24: Data Import View as e-TPP Pivot Table ✅

### Scope
Render the imported data as a table that mirrors the original e-TPP pivot layout (merged cells / rowSpan) instead of the grouped tree.

### Changes
- `buildPivot(items)` in `app/(dashboard)/users/[id]/imports/page.tsx`:
  - Groups by **full indicator context** (`intervensi + rencanaHasilKerja + indikator`) — critical because the same intervensi text can belong to different indicator groups (sample: 2× "Terselenggaranya Administrasi Keuangan Perangkat Daerah" with different RHK)
  - Outputs grouped per indicator; consecutive outputs sharing RA+KK merged via rowSpan
  - Each output = one row; the Target column renders a per-triwulan block (Triwulan N / Target / Realisasi / Validasi), emerald-tinted when realisasi filled
- Columns: `#` (per-indicator counter), Intervensi, RHK, Indikator (+ `IKU`/`Lainnya` badge from kodeSumber), Target, Rencana Aksi, Kriteria Keberhasilan, Output, Target (TW) — "Aksi" column intentionally skipped
- Table wrapped in `overflow-x-auto`; header row kept with file info + pending TW badges + delete
- i18n `imports.table.*` (en/id)

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- Real e-TPP file → **3 pivot blocks × 4 rows**, RA rowSpan 2/2, 2/2, 3/1 — identical to the source HTML.

### Files Modified
```
app/(dashboard)/users/[id]/imports/page.tsx (pivot table view)
lib/i18n/en.json (imports.table.*)
lib/i18n/id.json (imports.table.*)
PHASES.md (this update)
```

---

## Phase 25: Multi Data Import per User (Named, Stored in DB) ✅

### Scope
A user can now have **more than one** data import. Each import is **named**, stored in the `data_imports` DB table, and the imports page shows a **list** with per-import pivot view. (Template multi-reference & bulk schedule deferred to next phase.)

### Changes
- **Schema** — `data_imports` table: id, adminId, userId, `name` (required), `source` (default `ekinerja`), `key` (nullable, slug of name, unique per admin+user), fileName, period, `data` jsonb (items), `summary` jsonb, timestamps. **No** unique on (userId, source) → multiple allowed. Migration `0006_curved_senator_kelly.sql` pushed.
- **`lib/imports/utils.ts`** (new) — `buildSummary(items)` (itemCount + pendingPerTriwulan), `slugifyKey(name)`, `isEmptyRealisasi`.
- **Validations** — `createImportSchema` now requires `name`; added `updateImportSchema` (name/period).
- **APIs**
  - `GET /api/users/[id]/imports` — list all imports (name, key, fileName, period, data, summary, createdAt) ordered newest first
  - `POST /api/users/[id]/imports` — `{ name, fileName, period?, items[] }` → insert; `key` auto-slugged with dedup (`tw2_2026`, `tw1_2026_revisi` …)
  - `PATCH /api/users/[id]/imports/[importId]` — rename (key re-slugged)
  - `DELETE /api/users/[id]/imports/[importId]`
  - Guards: session + user ownership + `isAdminActive`
- **UI** (`app/(dashboard)/users/[id]/imports/page.tsx`)
  - Import panel: **Name** input (required) + file dropzone + preview → submit
  - Data panel: **list of imports** (name, key badge, fileName, itemCount, pending TW1–4 badges, rename/delete) → click one → **pivot table** below (reuses `buildPivot`; keyed by full indicator context)
- **Backfill** — existing `users.metadata.imports` migrated to a `data_imports` row (name = fileName), then `metadata.imports` cleared (1 row migrated).

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: create user → import "TW1-2026" (key `tw1_2026`, 12 items) + "TW2-2026" (key `tw2_2026`) → list shows 2 → summary correct → rename → key becomes `tw2_2026_revisi` → delete one → list shows 1 → cleanup.

### Files Created/Modified
```
lib/db/schema.ts (data_imports)
lib/db/migrations/0006_curved_senator_kelly.sql (new)
lib/imports/utils.ts (new)
lib/validations.ts (createImportSchema name + updateImportSchema)
app/api/users/[id]/imports/route.ts (DB list/create)
app/api/users/[id]/imports/[importId]/route.ts (new — rename/delete)
app/(dashboard)/users/[id]/imports/page.tsx (name input + list + per-import pivot)
lib/i18n/en.json (imports.name)
lib/i18n/id.json (imports.name)
PHASES.md (this update)
```

---

## Phase 26: Import Types per Tenant (SaaS configurable formats) ✅

### Scope
File formats are no longer hardcoded in code. Each tenant defines their own **Import Types** stored in DB — a generic table-mapping engine parses any tabular HTML using the type's column mapping. New formats = configure via UI, no deploy.

### Changes
- **Schema** — `import_types` table (adminId, key unique per admin, name, `engine` (`table`|`ekinerja-json`), `format`, `detectRules` jsonb, `columnMapping` jsonb, isActive) + `data_imports.engine` column (snapshot for view). Migration `0007_strange_slayback.sql` pushed.
- **Engines** (`lib/imports/engines/`)
  - `table.ts` — generic tabular HTML parser driven by `TableMapping` (header-row keywords, column rules `{field, match, mode}` with exact/contains/contains-exclude, triwulan regex; handles merged rowSpan via relative TW-cell detection).
  - ekinerja-json (existing e-TPP JSON-embedded parser, kept as special engine).
- **`lib/imports/engine.ts`** (pure, client-safe) — `parseWithType(type, content)`, `detectImportType(types, content)` (detectRules all-includes).
- **`lib/imports/seed.ts`** (server) — `monevTableMapping` config + `ensureSeedImportTypes(adminId)` seeds `ekinerja` + `monev` per tenant on first fetch. Per-tenant ownership → admin can edit/disable/add freely.
- **APIs** — `GET/POST /api/imports/types`, `PATCH/DELETE /api/imports/types/[id]`; import POST now takes `importTypeId` (stores `source`=type.key + `engine`).
- **UI**
  - New **Import Types** page (`/import-types`, sidebar nav) — CRUD + form: key/name/engine/format/isActive, detection keywords, and for `table` engine a **manual column mapping form** (field → header pattern, mode, exclude, header-row keywords, triwulan regex) with a "fill Monev template" helper.
  - Imports page: auto-detect type from file → badge type name → parse via engine → submit; view branches by engine (`table` → Monev-style columns incl. Capaian/Keterangan/Validasi; `ekinerja-json` → pivot).
- **Backfill** — existing `data_imports` engine corrected by source (ekinerja→ekinerja-json, monev→table).
- Removed dead code: `lib/imports/registry.ts`, `lib/imports/parsers/monev/`.

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: seeded types `ekinerja(ekinerja-json)`, `monev(table)` → auto-detect e-TPP/Monev files → parse via DB config (12 / 66 / 36 items, 0 errors) → import → engine+source stored → list correct → cleanup. Types CRUD (create/patch/duplicate-key-rejected/delete) pass.

### Files Created/Modified
```
lib/db/schema.ts (import_types, data_imports.engine)
lib/db/migrations/0007_strange_slayback.sql (new)
lib/imports/engines/table.ts (new)
lib/imports/engine.ts (new)
lib/imports/seed.ts (new)
lib/imports/registry.ts (removed)
lib/imports/parsers/monev/index.ts (removed)
lib/imports/utils.ts (cleanCellText, trimStr, nullableStr)
lib/validations.ts (createImportSchema importTypeId, import type schemas)
app/api/imports/types/route.ts (new)
app/api/imports/types/[id]/route.ts (new)
app/api/users/[id]/imports/route.ts (importTypeId + engine)
components/imports/import-types-manager.tsx (new)
app/(dashboard)/import-types/page.tsx (new) + loading.tsx (new)
app/(dashboard)/users/[id]/imports/page.tsx (detect via types + engine views)
components/layouts/sidebar.tsx (Import Types nav)
lib/i18n/en.json (importTypes.*, imports.*)
lib/i18n/id.json (importTypes.*, imports.*)
PHASES.md (this update)
```

---

## Phase 27: Imported Data as Template Variables ✅

### Scope
Templates can now reference a user's imported data via `{{imports.<key>.<field>}}`, resolved **at render time per user** with engine-aware formatting (e-TPP vs Monev).

### Changes
- **`lib/imports/variables.ts`** (new) — `resolveImportVars(user, custom?)` (async):
  - Base = `mergeVariables(user, custom)`
  - Loads the user's `data_imports` → `imports[<key>] = { name, key, fileName, period, summary, currentTw, pendingCount, pendingList, currentTwCount, currentTwList }`
  - `currentTw` from today's date; pending/current lists computed at render time (not snapshot)
  - **Engine-aware line format**:
    - `ekinerja-json` → `1. T/O2.1.1. Dokumen... (Dokumen: 1)`
    - `table` (Monev) → `1. Kegiatan - Indikator: Target 3 · Realisasi 3 · Capaian 100% · Validasi VALID` (only non-empty fields)
  - `pendingList` = unrealized items of current TW; `currentTwList` = all items of current TW (full monitoring report)
  - `items` array not exposed (template engine can't loop)
- **Render wiring** (3 call sites now use `await resolveImportVars`):
  - `lib/scheduler.ts` `processSchedule`
  - `POST /api/notifications/send`
  - `POST /api/notifications/batch` (restructured to async per-user render before insert)
- **Template form** — added `importHint` helper text listing available import variables (en/id).

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: user with `data_kinerja_saya_e_tpp` + `monev_2026_sub_kegiatan_renstra` imports → `resolveImportVars` returns per-key vars (currentTw=3); ekinerja `pendingList` = T/O style, monev `pendingList` = Target/Validasi style; `templateEngine.render("{{imports.<key>.pendingCount}} / {{imports.<key>.pendingList}}")` produces correct per-user output.

### Files Created/Modified
```
lib/imports/variables.ts (new)
lib/scheduler.ts (resolveImportVars)
app/api/notifications/send/route.ts (resolveImportVars)
app/api/notifications/batch/route.ts (async per-user render)
components/templates/template-form.tsx (importHint)
lib/i18n/en.json (templates.form.importHint)
lib/i18n/id.json (templates.form.importHint)
PHASES.md (this update)
```

---

## Phase 28: Easy Template Building from Imported Data ✅

### Scope
Make it easy for admins to write templates that use imported data — no need to hand-type `{{imports.<key>.<field>}}` or guess keys.

### Changes
- **`GET /api/imports/variable-keys`** (new) — distinct `{ key, name }` actually in use across the admin's users' `data_imports` (first-seen order by recency).
- **Template form** (`template-form.tsx`):
  - Variable detection regex upgraded to multi-segment `\{\{([\w.]+)\}\}` (consistent with `templateEngine.validateVariables`) → import paths show up in chips, sample data, and stored `template.variables`.
  - New **"Data Import variables"** panel: for each in-use key, click-to-insert chips for `pendingCount`, `pendingList`, `currentTw`, `currentTwList`, `currentTwCount`, `summary.itemCount`, `summary.pendingPerTriwulan.1..4`, `fileName`, `period` (reuses `insertVariable` at cursor); empty-state hint if no imports yet.
- **Preview with real user** (`template-preview.tsx` + preview API):
  - `templatePreviewSchema` now accepts optional `userId`.
  - Preview route: when `userId` given, loads the user (admin-scoped) and renders via `resolveImportVars(user, sampleData)` → real imported data in output.
  - Preview UI: user dropdown ("Sample data" / pick a user); selecting a user calls the API and shows the real rendered message; sample inputs still override where filled.
- i18n keys: `templates.form.importVars*`, `templates.form.importField.*`, `templates.form.pendingTw`, `templates.previewUser*`.

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: import Monev → `variable-keys` returns `monev_tw` → create template with `{{imports.<key>...}}` → preview without user (sample only) → preview with user renders real data (TW 3, pendingCount 18, full Monev pending list, total 66) → cleanup.

### Files Created/Modified
```
app/api/imports/variable-keys/route.ts (new)
lib/validations.ts (templatePreviewSchema + userId)
app/api/templates/[id]/preview/route.ts (resolveImportVars on userId)
components/templates/template-form.tsx (picker panel + multi-segment regex)
components/templates/template-preview.tsx (user dropdown + API preview)
lib/i18n/en.json (templates.* keys)
lib/i18n/id.json (templates.* keys)
PHASES.md (this update)
```

---

## Phase 29: Consistent Import Keys + Handle Users with Different Imports ✅

### Scope
1. Import keys become **explicit, reusable identifiers** (dropdown of existing keys per tenant) so templates stay consistent across users.
2. Templates that reference imports now **handle users who don't have the data** (filter recipients + coverage + conditional hint).

### Changes
**Part 1 — Explicit import keys**
- `createImportSchema`: `key` required (regex `^[a-z0-9_]+$`), `name` optional (display).
- `POST /api/users/[id]/imports`: uses the provided key; same user + same key → **replace** (transaction: delete old + insert). No more auto-slug-from-name.
- `PATCH /api/users/[id]/imports/[importId]`: `name` display-only — no longer re-slugs the key.
- Imports page: **Key** field = dropdown of existing keys (`/api/imports/variable-keys`) + "Create new key…" (key-safe input) + optional **Name**; hint to reuse the same key across users.
- i18n: `imports.key*`, `imports.nameOptional`.

**Part 2 — Templates when users have different imports**
- `extractImportKeys(text)` (utils) — parses `{{imports.<key>...}}` AND `{{#if imports.<key>...}}` paths → unique keys.
- **Batch send filter**: recipients kept only if they have **all** referenced import keys; others skipped; response includes `skippedCount` + clear message. (Single send unchanged — admin picked the user.)
- **Coverage**: preview API returns `coverage: [{ key, count, total }]` (users with the key vs total active users); preview UI shows a coverage panel.
- **Template form hint**: documents the `{{#if imports.<key>.pendingCount}}...{{/if}}` pattern so users without the import get a clean message.

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: import twice with same key → list stays 1 (replace); `variable-keys` includes `monev`; preview with real user renders (TW3, 18 pending, Monev list); coverage `monev: 2 of 11`; batch-filter logic keeps only the 2 users with key `monev` out of 3 targets; `extractImportKeys` unit cases (plain/conditional/multiple/none) pass.

### Files Created/Modified
```
lib/validations.ts (createImportSchema key/name, updateImportSchema)
app/api/users/[id]/imports/route.ts (provided key + replace)
app/api/users/[id]/imports/[importId]/route.ts (name-only)
app/(dashboard)/users/[id]/imports/page.tsx (key dropdown + name)
lib/imports/utils.ts (extractImportKeys)
app/api/notifications/batch/route.ts (filter + skipped)
app/api/templates/[id]/preview/route.ts (coverage)
components/templates/template-preview.tsx (coverage panel)
components/templates/template-form.tsx (hint text)
lib/i18n/en.json (imports.key*, templates.coverage*)
lib/i18n/id.json (imports.key*, templates.coverage*)
PHASES.md (this update)
```

---

## Phase 30: Import Categories (CRUD per tenant) ✅

### Scope
Import keys are now a **managed, CRUD-able list per tenant** ("Kategori Import") instead of only a derived list. The import dropdown sources from active categories (with fallback to keys already in use). Category key is **immutable** (templates & old data stay safe).

### Changes
- **Schema** — `import_categories` table: id, adminId (FK cascade), `key` (unique per admin, immutable), `name`, `description`, `isActive`, timestamps. Migration `0008_lush_madrox.sql` pushed.
- **APIs**
  - `GET /api/imports/categories` — list (admin-scoped)
  - `POST /api/imports/categories` — create (409 on duplicate key)
  - `PATCH /api/imports/categories/[id]` — name/description/isActive only (**key not editable**)
  - `DELETE /api/imports/categories/[id]`
  - Guards: session + `isAdminActive` on writes
- **UI**
  - New **Import Categories** page (`/import-categories`) + sidebar nav — CRUD manager (key/name/description/active), key disabled when editing
  - Data Import page: **Key dropdown** = active categories first, then fallback keys already in use (`variable-keys`), then "Create new key…"
- **Validations** — `createImportCategorySchema` (key regex), `updateImportCategorySchema` (no key)
- i18n keys `importCategories.*` + `nav.importCategories` (en/id)

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- E2E live: create category `monev` → duplicate key 409 → list contains it → PATCH renames name but key stays `monev` → import user with key `monev` → `variable-keys` includes `monev` → delete category → cleanup.

### Files Created/Modified
```
lib/db/schema.ts (import_categories)
lib/db/migrations/0008_lush_madrox.sql (new)
lib/validations.ts (category schemas)
app/api/imports/categories/route.ts (new)
app/api/imports/categories/[id]/route.ts (new)
components/imports/import-categories-manager.tsx (new)
app/(dashboard)/import-categories/page.tsx (new) + loading.tsx (new)
app/(dashboard)/users/[id]/imports/page.tsx (dropdown from categories)
components/layouts/sidebar.tsx (nav)
lib/i18n/en.json (importCategories.*, nav)
lib/i18n/id.json (importCategories.*, nav)
PHASES.md (this update)
```

---

## Phase 31: data_imports FK to Import Categories (drop key/name) ✅

### Scope
`data_imports.key` and `data_imports.name` are removed. Every import is now linked to an `import_categories` row via a required FK — the category `key` is the template reference (`{{imports.<categoryKey>...}}`), giving consistency by design.

### Changes
- **Schema** — `data_imports`: dropped `key` + `name`; added `import_category_id` uuid FK → `import_categories.id` (**NOT NULL, ON DELETE RESTRICT**); unique index changed to `(admin_id, user_id, import_category_id)` (1 import per category per user). Migration `0009_import_category_fk.sql` (custom — includes **backfill**: legacy `data_imports.key` values auto-create categories and link rows).
- **Validations** — `createImportSchema` = `{ importTypeId, categoryId (uuid, required), fileName, period?, items }`; `updateImportSchema` = `{ period? }` only.
- **Routes**
  - `POST /api/users/[id]/imports` — validates category (admin + active); replace by `(user + category)`.
  - `GET /api/users/[id]/imports` — `innerJoin` category → returns `categoryId`, `categoryName`, `categoryKey`.
  - `PATCH /api/users/[id]/imports/[importId]` — `period` only.
  - `variable-keys` — returns **active categories** (`key`, `name`).
- **`resolveImportVars`** — joins category → `imports[category.key] = { name: category.name, ... }` (templates unchanged).
- **Batch filter / preview coverage** — join categories, match on `importCategories.key`.
- **UI (Data Import page)** — dropdown = active categories (send `categoryId`), "Create new category" link → `/import-categories`; list shows category name + key badge; rename button removed (update = re-import).

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- Applied migration `0009` to local DB: 5 categories auto-created from legacy keys, imports linked, `key`/`name` dropped, unique replaced.
- E2E live: create category `monev` → import with `categoryId` (66 items) → GET row has `categoryName`/`categoryKey` and **no** `key`/`name` → preview renders via category join (TW3, 18 pending) → `variable-keys` from categories → **delete category with import blocked (RESTRICT)** → after deleting import, category deletable → cleanup.

### Files Created/Modified
```
lib/db/schema.ts (data_imports categoryId, drop key/name)
lib/db/migrations/0009_import_category_fk.sql (new, custom + backfill)
lib/validations.ts (create/update import schema)
app/api/users/[id]/imports/route.ts (categoryId + join)
app/api/users/[id]/imports/[importId]/route.ts (period only)
app/api/imports/variable-keys/route.ts (categories)
app/api/notifications/batch/route.ts (join categories)
app/api/templates/[id]/preview/route.ts (join categories)
lib/imports/variables.ts (join category)
app/(dashboard)/users/[id]/imports/page.tsx (category dropdown + list)
lib/i18n/en.json (imports.category*, createCategory)
lib/i18n/id.json (imports.category*, createCategory)
AGENTS.md (migration range 0001-0009)
PHASES.md (this update)
```

---

## Phase 32: Import Variables Picker in Template Detail Editor ✅

### Scope
The inline editor on the template **detail page** (`/templates/[id]`) was missing the "Data Import variables" picker (Phase 28 only added it to `template-form.tsx`), and its variable regex only matched single-segment `{{var}}` (so `{{imports.<key>.<field>}}` wasn't detected/stored).

### Changes
- **`components/imports/import-variables-picker.tsx`** (new, reusable) — fetches `/api/imports/variable-keys` and renders the click-to-insert panel (`onInsert(variable)` prop). Used by both editors.
- **`template-form.tsx`** — replaced inline panel + state with `<ImportVariablesPicker onInsert={insertVariable} />` (DRY).
- **`templates/[id]/page.tsx`** — added `<ImportVariablesPicker>` to the edit form, `insertVariable` (cursor-insert via `#editContent` textarea), `id="editContent"` on the Textarea, and upgraded both regexes (`saveEditing` + "Terdeteksi" display) to multi-segment `\{\{([\w.]+)\}\}`.
- Verified `bunx tsc --noEmit` clean.

### Files Created/Modified
```
components/imports/import-variables-picker.tsx (new)
components/templates/template-form.tsx (use picker)
app/(dashboard)/templates/[id]/page.tsx (picker + insert + regex)
PHASES.md (this update)
```

---

## Phase 33: Email From Name (sender display name) ✅

### Scope
Add a per-admin **From Name** for email sending (e.g. `"Notifin" <notifications@domain.com>`) so recipients see a proper sender, and the From header is more deliverable.

### Changes
- **Setting `emailFromName`**: `settingsSchema`, `SETTING_KEYS` + `STRING_SETTINGS`, GET response, Settings UI input ("From Name") + save body; `.env.example` `EMAIL_FROM_NAME`.
- **`lib/email.ts`**: `SmtpConfig.fromName`; `getSmtpConfig` reads DB `emailFromName` + env fallback; `getFromAddress` returns `"Name" <addr>` when a name is set (quotes stripped safely), otherwise plain address. Applies to all send paths (`sendEmail`, `sendBulkEmail`, welcome/notification email).
- i18n `settings.fromName` / `fromNamePlaceholder` (en/id).

### Verified
- `bunx tsc --noEmit` clean; JSON valid.
- API round-trip: PUT `emailFromName` → GET returns it → clear works.

### Files Created/Modified
```
lib/validations.ts (settingsSchema emailFromName)
app/api/settings/route.ts (key + GET)
lib/email.ts (fromName + getFromAddress)
app/(dashboard)/settings/page.tsx (input + state + save)
lib/i18n/en.json (settings.fromName)
lib/i18n/id.json (settings.fromName)
.env.example (EMAIL_FROM_NAME)
PHASES.md (this update)
```

---

## Phase 34: Email Provider — Resend (Notifin mail) ✅

### Scope
Per-admin email delivery can use **own SMTP** or **Notifin's Resend** (platform email). Tenants don't need their own Resend key — the platform sends via Resend API using env `RESEND_API_KEY` + `RESEND_FROM` (sender address platform-controlled; tenant can set From Name).

### Changes
- **Env/Docker**: `.env.example` + docker-compose (`web`, `worker`) add `RESEND_API_KEY`, `RESEND_FROM`.
- **Setting `emailProvider`** (`smtp` | `resend`, default `smtp`): `settingsSchema`, `SETTING_KEYS`/`STRING_SETTINGS`, GET response.
- **`lib/email.ts`**:
  - `getEmailProvider` (cached 60s); `resetEmailTransporter` clears it too.
  - `sendViaResend(adminId, params)` — `fetch` POST `https://api.resend.com/emails` with Bearer `RESEND_API_KEY`; `from` = `"<From Name>" <RESEND_FROM address>`; returns Resend message id; error passthrough.
  - `sendEmail` routes to Resend when provider = `resend`, else SMTP (unchanged).
  - `checkEmailHealth` — resend → `!!RESEND_API_KEY`.
- **Settings UI** — "Email Provider" dropdown (SMTP / Resend); Resend → info box + From Name only (SMTP form hidden); SMTP → existing form. i18n `settings.emailProvider*`, `settings.resendInfo`.
- Verified `bunx tsc --noEmit` clean; JSON valid; `docker compose config` valid; API round-trip `emailProvider` resend↔smtp + From Name works.

### Files Created/Modified
```
.env.example (RESEND_API_KEY, RESEND_FROM)
docker-compose.yml (web/worker env)
lib/validations.ts (settingsSchema emailProvider)
app/api/settings/route.ts (key + GET)
lib/email.ts (provider routing + sendViaResend + health)
app/(dashboard)/settings/page.tsx (provider dropdown + resend panel)
lib/i18n/en.json (settings.emailProvider*, resendInfo)
lib/i18n/id.json (settings.emailProvider*, resendInfo)
PHASES.md (this update)
```

---

## Phase 35: Instant Email Provider Switch (cache reset) ✅

### Scope
Switching `emailProvider` (or changing `emailFromName`) in Settings now takes effect immediately instead of waiting up to 60s (provider/config cache TTL).

### Changes
- `app/api/settings/route.ts` — `hasSmtpUpdate` now also matches `emailProvider` and `emailFromName`, so `resetEmailTransporter(adminId)` is called (clears `cachedProviders` + `cachedConfigs`) → health check & sending use the new provider right away.
- Verified `bunx tsc --noEmit` clean; API round-trip: PUT `emailProvider=resend` → GET reflects `resend` immediately (health per provider; false locally until `RESEND_API_KEY` set).

### Files Created/Modified
```
app/api/settings/route.ts (hasSmtpUpdate + emailProvider/emailFromName)
PHASES.md (this update)
```

---

## Phase 36: Dynamic Email Provider Labels in Settings ✅

### Scope
Settings no longer shows "Email (SMTP)" when the admin uses the Notifin Platform provider; the provider dropdown trigger displays the friendly label (never the internal `resend` value).

### Changes
- **i18n** — `settings.emailPlatform` = "Email (Notifin Platform)" (en/id).
- **Settings System Health** — email item label dynamic (`emailPlatform` when provider = `resend`, else `t.settings.email`), with sub-label "Notifin Platform" (mirrors WhatsApp provider sub-labels).
- **Email card title** — dynamic (`emailPlatform` vs `t.settings.email`).
- **Provider dropdown trigger** — renders the friendly label (`emailProviderResend` = "Notifin Platform") instead of base-UI `SelectValue` showing the raw `resend` value.
- Health note: `health.email` shows X until the provider is actually configured — for `resend` that means `RESEND_API_KEY` present in the environment; for `smtp` a working transport. This is correct behavior.
- Verified `bunx tsc --noEmit` clean; JSON valid.

### Files Created/Modified
```
app/(dashboard)/settings/page.tsx (health label + card title + dropdown trigger)
lib/i18n/en.json (settings.emailPlatform)
lib/i18n/id.json (settings.emailPlatform)
PHASES.md (this update)
```

---

## Phase 37: Per-Admin Timezone UX + Superadmin-Only System Health

### Scope
Settings page: server clock follows each admin's chosen timezone (realtime), general timezone becomes a dropdown, and infra health (Redis/Database) + per-admin WhatsApp session note are superadmin-only.

### Changes
- **Server clock realtime + per-admin timezone** — Settings System Health clock ticks every second (`serverNow` state + 1s interval + `serverOffset` captured from `serverTime`), rendered in `timeZone: settings.defaultTimezone`. Changing the dropdown instantly updates the displayed time. "Timezone Default" line removed; "Server Timezone" line replaced with the admin's timezone (neutral `settings.timezone` label). `safeTimezone()` guard prevents invalid stored values from crashing the page.
- **Redis & Database health superadmin-only** — Settings health items array only includes Redis/Database when `user.role === "superadmin"`; grid switches 2/4 cols accordingly. API `/api/settings` GET also gates `health.redis`/`health.database` behind `isSuperadmin(session)`.
- **WhatsApp session note superadmin-only** — `settings.baileysPerAdmin` text only rendered for superadmin.
- **Timezone dropdown (Pengaturan Umum)** — free-text `Input` replaced with a `Select` from shared `TIMEZONE_OPTIONS`; affects per-admin schedule delivery via `lib/scheduler.ts` `getAdminTimezone`.
- **`lib/timezones.ts` (new)** — shared `TIMEZONE_OPTIONS` (5 Indonesia zones with friendly labels); `components/users/user-form.tsx` refactored to use it (removed duplicated inline array).
- i18n: `settings.timezone` key added (en/id).
- Verified `bunx tsc --noEmit` clean.

### Files Created/Modified
```
lib/timezones.ts (new)
app/(dashboard)/settings/page.tsx (clock + health gating + timezone dropdown)
app/api/settings/route.ts (health.redis/database superadmin gate)
components/users/user-form.tsx (shared timezone options)
lib/i18n/en.json (settings.timezone)
lib/i18n/id.json (settings.timezone)
PHASES.md (this update)
```

---

## Phase 38: Schedule next-run fixes + schedule logging + no auto-seed import types

### Scope
Fix "next run" mismatch (calculation + display), log the body overflow in log detail, make schedule-fired notifications appear in Logs, and stop auto-seeding e-TPP/Monev import types for new users.

### Changes
- **`lib/scheduler.ts`** — `calculateNextRun` rewritten to use `cron.createTask(...).getNextRun()` (same library that actually fires jobs) → handles `*/n` steps, minute/hour lists, `7`=Sunday correctly; removed ~100 lines of custom parser/matcher. `processSchedule` now inserts a `notification_logs` row (status `pending`) per channel before enqueueing and uses the real log id (previously `logId` = schedule id → worker updated 0 rows → schedule sends never logged). `loadSchedules()` recomputes & persists `nextRunAt` on startup so stale/past dates (downtime, timezone change) are corrected.
- **`app/api/schedules/route.ts`** — GET left-joins `settings` (`defaultTimezone`) and returns `timezone` per schedule row.
- **`types/index.ts`** — `NotificationSchedule.timezone?: string | null`.
- **`app/(dashboard)/schedules/page.tsx`** — next-run rendered in each schedule's admin timezone (`toLocaleString(locale, { timeZone })`) instead of browser tz.
- **`app/(dashboard)/logs/page.tsx`** — log detail dialog: body + `break-words`, error + `break-words`, grid cells `min-w-0`, timestamp `break-all`, dialog `sm:max-w-lg` + `max-h-[85vh] overflow-y-auto` (long bodies scroll instead of overflowing).
- **`app/api/imports/types/route.ts`** — removed `ensureSeedImportTypes()` call on GET; new users no longer auto-receive e-TPP/Monev import types (they create their own; existing rows untouched; `lib/imports/seed.ts` kept for future manual seeding).
- Verified `bunx tsc --noEmit` clean; scheduler module imports; join query runs against local DB.

### Files Created/Modified
```
lib/scheduler.ts (getNextRun + schedule logging + nextRunAt recompute)
app/api/schedules/route.ts (per-schedule timezone)
types/index.ts (NotificationSchedule.timezone)
app/(dashboard)/schedules/page.tsx (tz-aware next-run display)
app/(dashboard)/logs/page.tsx (detail dialog overflow/scroll)
app/api/imports/types/route.ts (no auto-seed)
PHASES.md (this update)
```

---

## Phase 39: Baileys Disconnect Button + Connected Phone Number

### Scope
Settings (Baileys): explicit disconnect button while connected, and display the WhatsApp number of the active session. All per-admin (`adminId`-scoped), consistent with one-admin-one-number model.

### Changes
- **`lib/wa/baileys-manager.ts`** — on `connection open`: extract phone from `sock.user.id` JID (strip `:device`/`@s.whatsapp.net`), persist to per-admin setting `baileys_phone`, log `Connected successfully as +<phone>`. On `disconnect()`: also clear `baileys_qr` (stale QR) and `baileys_phone`.
- **`app/api/baileys/disconnect/route.ts` (new)** — POST mirror of connect route: session check + `isAdminActive` → `addBaileysDisconnectJob(adminId)` (queue + worker handler already existed for provider-switch flow).
- **`app/api/baileys/status/route.ts`** — also reads `baileys_phone`, returns `phone` in response.
- **`app/(dashboard)/settings/page.tsx`** — destructive "Putuskan/Disconnect" button (with confirm) shown while connected; "Terkoneksi sebagai +62..." line under status when connected & phone known; `baileysDisconnecting` state mirrors connect flow.
- **i18n** — new keys `settings.baileysDisconnect`, `baileysDisconnecting`, `baileysDisconnectConfirm`, `baileysDisconnectFailed`, `baileysConnectedAs` (en/id).
- Notes: manual disconnect does not wipe the auth session (`BAILEYS_AUTH_DIR/<adminId>` volume) — reconnecting usually skips QR. Worker auto-connect on restart still applies to admins with provider = baileys.
- Verified `bunx tsc --noEmit` clean; new files lint-clean; modified files introduce no new lint errors.

### Files Created/Modified
```
lib/wa/baileys-manager.ts (phone capture + cleanup on disconnect)
app/api/baileys/disconnect/route.ts (new)
app/api/baileys/status/route.ts (phone field)
app/(dashboard)/settings/page.tsx (disconnect button + connected-as line)
lib/i18n/en.json (5 settings keys)
lib/i18n/id.json (5 settings keys)
PHASES.md (this update)
```

---

## Phase 40: Fix Baileys Stuck-Connected on Manual Disconnect

### Scope
Manual disconnect (Settings → Putuskan) previously reconnected itself after ~5s and stayed "Tersambung"; reconnect attempts then competed with a ghost socket. Root cause: Baileys fires `connection.update close` for intentional closes too, and the handler auto-reconnected whenever the status code wasn't `loggedOut`.

### Changes
All in `lib/wa/baileys-manager.ts` (per-admin instance semantics unchanged):
- **`intentionalClose` flag** — set in `disconnect()` before `sock.close()`; the `connection.close` handler checks it first and skips reconnect entirely (resets flag). `connect()` resets the flag so genuine network drops still auto-reconnect.
- **Anti-ghost guard** — reconnect now also requires `BaileysManager.instances.get(this.adminId) === this`; instances removed from the map (disconnected) can never resurrect a socket.
- **Grace-period fix** — `disconnect()` writes `baileys_last_seen = ""` so `/api/baileys/status` immediately reports "Belum terhubung" instead of showing the 60s "Menghubungkan ulang..." grace window; the close handler no longer writes a fresh timestamp when the close was intentional (ordering avoids overwriting the cleared value).
- **`sock.close()` wrapped in try-catch** — safe if socket already dead.
- Verified `bunx tsc --noEmit` clean; lint unchanged (single pre-existing false-positive).

### Files Created/Modified
```
lib/wa/baileys-manager.ts (intentionalClose flag + anti-ghost + last_seen clear + guarded close)
PHASES.md (this update)
```

---

## Phase 41: Truthful Email Health (Resend Platform) + Baileys Connect Error Surfacing

### Scope
Two visibility fixes: (1) email health for the platform-provided "Resend (Notifin)" provider now performs a real API verification instead of just checking env presence, and Settings shows WHY a health item is red; (2) Baileys connect failures/skips are surfaced per-admin in Settings instead of failing silently.

### Changes
- **`lib/email.ts`** — new `checkEmailHealthDetailed(adminId): {ok, detail}`; `checkEmailHealth` kept as boolean wrapper. Resend branch: no key → explicit reason; key present → `GET https://api.resend.com/domains` with 5s timeout; `200`/`403` = healthy (403 = valid restricted/send-only key), `401` = invalid key, other/timeout = unhealthy with reason. Result cached 60s (platform-global key). SMTP branch reports verify error message.
- **`app/api/settings/route.ts`** — uses detailed check; response `health.emailDetail` added.
- **Settings UI** — red health items render `detail` text under the label (email for now).
- **`lib/wa/baileys-manager.ts`** — exported `setBaileysError(adminId, msg|null)` writing per-admin `baileys_error`; `connect()` clears stale `baileys_qr` and error at start; writes error on missing module / connect exception; clears on `connection open`.
- **`workers/notification-worker.ts`** — writes `baileys_error` when connect job is skipped (admin inactive/expired), auto-connect fails, or manual connect throws.
- **`app/api/baileys/status/route.ts`** — returns `error`; **Settings UI** shows it in red under Baileys status while not connected.
- Per-tenant model unchanged: `emailProvider` choice stays per-admin; Resend key remains platform-level env (`RESEND_API_KEY`). If health stays red in production, check `docker compose exec web printenv RESEND_API_KEY`.
- Verified `bunx tsc --noEmit` clean; lint unchanged (pre-existing only).

### Files Created/Modified
```
lib/email.ts (EmailHealthResult + real Resend verification + cache)
app/api/settings/route.ts (health.emailDetail)
app/(dashboard)/settings/page.tsx (health detail + baileys error display)
lib/wa/baileys-manager.ts (setBaileysError + QR/error hygiene)
workers/notification-worker.ts (error surfacing on skip/fail)
app/api/baileys/status/route.ts (error field)
PHASES.md (this update)
```

---

## Phase 42: Baileys QR Tenant Diagnostics — Specific Errors + Stale Flag Cleanup

### Scope
Follow-up on "QR muncul di superadmin tapi tidak di admin biasa". Code paths verified identical for both roles; the three candidate causes are now all surfaced or self-healing instead of silent.

### Changes
- **`lib/admin-status.ts`** — new `getAdminStatus(adminId): {active, reason}` distinguishing `not_found` / `inactive` / `expired`; `isAdminActive` now wraps it.
- **`app/api/baileys/connect/route.ts`** — inactive/expired admins get a specific 403 message ("Akun admin tidak aktif, hubungi superadmin untuk aktivasi" / "...kedaluwarsa...") instead of the misleading generic "Forbidden: superadmin only"; message shows in Settings UI toast.
- **`lib/wa/baileys-manager.ts`** — exported `clearBaileysSessionFlags(adminId)` clearing `baileys_connected`, `baileys_qr`, `baileys_last_seen`.
- **`workers/notification-worker.ts`** — `autoConnectBaileys` now: checks provider first, clears stale session flags at startup (worker restart = old sockets dead, so "Tersambung" ghost status and stale QR are wiped), writes `baileys_error` for inactive/expired baileys-admins, then connects active ones.
- Remaining non-code causes covered by ops: tenant must set WhatsApp Provider = Baileys + Save before the section appears (default is fonnte); superadmin must activate/extend tenant.
- Verified `bunx tsc --noEmit` clean; lint unchanged (pre-existing useMultiFileAuthState false positive only).

### Files Created/Modified
```
lib/admin-status.ts (getAdminStatus with reason)
app/api/baileys/connect/route.ts (specific 403 messages)
lib/wa/baileys-manager.ts (clearBaileysSessionFlags export)
workers/notification-worker.ts (startup cleanup + inactive error surfacing)
PHASES.md (this update)
```

---

## Phase 43: Baileys Ghost Instance — Disconnect No-Op Fix

### Scope
Tenant (and any admin) could get stuck at "Tersambung" with the Putuskan button doing nothing. Root cause: a pending auto-reconnect timer scheduled before an intentional disconnect fires on the now-unregistered instance, resurrects the connection and rewrites `baileys_connected=true`; subsequent disconnect calls find no instance in the map and silently no-op.

### Changes (`lib/wa/baileys-manager.ts`)
- **Anti-resurrection:** `connect()` refuses to run when the instance is no longer registered in `instances` map (orphaned).
- **Reconnect timer tracked:** new `reconnectTimer` field; cleared in `disconnect()` and before scheduling a new one; timer callback nulls it before calling `connect()`.
- **Open-handler guard:** on `connection === "open"`, unregistered (orphan) sockets are closed immediately instead of writing connected/phone state.
- **Static disconnect never a silent no-op:** when no live instance exists (e.g., ghost after worker restart or resurrection race), it still resets all per-admin flags via new exported `resetBaileysState(adminId)` (connected/qr/phone/last_seen/error). Instance `disconnect()` uses the same helper.
- Result: Putuskan always flips status back to "Belum tersambung" within one UI poll (~4s); sessions cannot self-resurrect after intentional disconnect.
- Verified `bunx tsc --noEmit` clean; lint unchanged (pre-existing useMultiFileAuthState false positive only).

### Files Created/Modified
```
lib/wa/baileys-manager.ts (orphan guards + reconnectTimer + resetBaileysState)
PHASES.md (this update)
```

---

## Phase 44: Auto-Connect Baileys on Provider Switch + QR Pending Hint

### Scope
Tenant set waProvider=baileys but no QR and no error appeared (settings row state: qr="", error="", connected=false) — meaning no connect attempt was ever initiated: worker autoConnect had already run at startup before the provider switch, and nothing re-triggered connection after Save.

### Changes
- **`app/api/settings/route.ts` (PUT)** — symmetric to the existing disconnect-on-switch-away logic: when `waProvider` changes TO `baileys`, a connect job is queued immediately (`addBaileysConnectJob`). QR now appears automatically a few seconds after Save without any extra click. UI-side `handleSave` already called connect as well; duplicate jobs are harmless (connect guard no-ops).
- **Settings UI** — new pending hint in the Baileys section when not connected, no QR, and no error: "QR akan muncul otomatis di sini beberapa detik setelah pengaturan disimpan..." (i18n key `settings.baileysQrPendingHint`, id+en).
- Diagnostic note: empty qr+error with provider=baileys means no connect job reached the worker; if clicking Hubungkan shows a specific 403 message (inactive/expired admin), that leaves no settings trace by design — check `admins.is_active`/`expires_at`.
- Verified `bunx tsc --noEmit` clean; lint unchanged (pre-existing only).

### Files Created/Modified
```
app/api/settings/route.ts (auto-connect on switch to baileys)
app/(dashboard)/settings/page.tsx (QR pending hint)
lib/i18n/id.json, lib/i18n/en.json (baileysQrPendingHint)
PHASES.md (this update)
```

---

## Phase 45: Baileys loggedOut Self-Heal — Auto Fresh QR After Session Killed From Phone

### Scope
Confirmed root cause of tenant QR never appearing: iga's auth dir held `registered` credentials whose session had been killed from the phone side (device unlinked). Every connect attempt: Baileys skipped QR generation (registered=true), tried resume, WhatsApp rejected with `loggedOut`, old handler silently stopped — no reconnect, no QR, no error, no log. Worker logs showed `connect completed, connected: false` with nothing after. Manual fix was deleting the auth dir; this phase makes it automatic.

### Changes
- **`lib/wa/baileys-manager.ts`** — close handler now handles `DisconnectReason.loggedOut` explicitly: logs `"Session logged out by WhatsApp, resetting credentials..."`, wipes the admin's auth dir (`fs.promises.rm` recursive), `resetBaileysState`, then schedules one fresh `connect()` via the tracked `reconnectTimer` → new QR auto-emits within seconds. `baileys_last_seen` is NOT written for loggedOut (no fake "Menghubungkan ulang..." grace period for a permanently dead session).
- **`app/api/baileys/connect/route.ts`** — 403 rejections (inactive/expired/not-found admin) now also write `baileys_error`, so the reason appears in red inside the Baileys section via status polling instead of only at the bottom of the page.
- Normal operation unchanged: network-drop auto-reconnect (5s), worker-startup auto-connect, and ghost-instance guards from Phases 42-43 remain.
- Verified `bunx tsc --noEmit` clean; lint unchanged (pre-existing useMultiFileAuthState false positive only).

### Files Created/Modified
```
lib/wa/baileys-manager.ts (loggedOut self-heal)
app/api/baileys/connect/route.ts (rejection visibility)
PHASES.md (this update)
```

---

## Phase 46: Remove Landing Page — Root Redirects to Login

### Scope
The app no longer has a public landing page. Any visitor hitting `/` goes straight to `/login`, and authenticated users hitting `/` go straight to `/dashboard`. Full dead-code cleanup of the landing page.

### Changes
- **`app/page.tsx`** — deleted (569-line landing page).
- **`middleware.ts`** — `publicPaths` reduced to `["/login"]`. New root handler placed *after* the `/api/auth/me` and auth-API early returns but *before* the protected-path check, so `/` never reaches the `?redirect=` branch:
  - `/` + no session → redirect `/login`
  - `/` + valid session → redirect `/dashboard`

  Handling this in middleware (not a page-level `redirect()`) is deliberate: dropping `"/"` from `publicPaths` and relying on a page redirect would send the user to `/login?redirect=/`, which bounces back to `/` after login.
  The old `session && (pathname === "/login" || pathname === "/")` clause narrowed to `/login` only.
- **`components/landing/`** — deleted all 5 components (`countup`, `cursor-glow`, `mobile-nav`, `reveal`, `tilt`); only `app/page.tsx` imported them.
- **`lib/i18n/en.json` / `id.json`** — removed the whole `landing.*` block (lines 543-602 of each; the preceding `},` became `}`). Both files still parse.
- **`app/globals.css`** — removed landing-only classes `.gradient-text`, `@keyframes gradient-shift` (only consumer was `.gradient-text`), `.nav-glass` + `.dark`, `.reveal`/`.reveal.active`, `.stat-card` + `.dark`. **Kept** everything the login/auth surfaces depend on: `brand-gradient`, `btn-shine`, `glass-panel`, `ambient-orb`/`orb-1`/`orb-2` (used by `(auth)/layout.tsx`), `hero-title-text`, `form-input`, `login-reveal`, `nf-logo`. Section comment renamed `/* ===== Landing page ===== */` → `/* ===== Brand & auth surfaces ===== */`.
- **`next.config.ts`** — removed the `images` block. The `lh3.googleusercontent.com` remote pattern was used only by the landing page's bento/dashboard screenshots; `NotifinLogo` renders a plain `<img>`, so `dangerouslyAllowSVG` and the CSP header were unused too.
- **`app/layout.tsx`** — metadata de-landed: title `NOTIFIN | Notification Management`, description rewritten to app-facing copy.
- Untouched: `theme/landingpage.html` (design reference, not built), the empty `app/(auth)/register` dir, all `(dashboard)` and `api/` routes.

### Files Created/Modified
```
app/page.tsx (deleted)
components/landing/*.tsx (deleted — 5 files)
middleware.ts (root → login/dashboard)
app/globals.css (landing-only CSS removed)
app/layout.tsx (metadata)
lib/i18n/en.json, lib/i18n/id.json (landing.* removed)
next.config.ts (images block removed)
PHASES.md (this update)
```

### Verification
- `bunx tsc --noEmit` — clean (a stale `.next` route validator initially referenced the deleted `app/page.js`; resolved by clearing the gitignored `.next` cache)
- `bun run lint` — 80 problems / 27 errors, byte-identical to the `master` baseline measured via `git stash`. None of the changed files appear in the report.
- `bun run build` — succeeds; `/` absent from the route manifest, `/login` still prerendered, middleware registered

---

## Phase 47: SI-MPOK NORI Rebrand (M3 Theme, New Logo, Plus Jakarta Sans)

### Scope
Full visual rebrand of the app from "Notifin" to **SI-MPOK NORI**, following the `ui-mpoknori/` design reference. Colours, typography and logo only — no layout restructuring, no changes to the dashboard information architecture, and operational values (sender addresses, seeded admin identity) deliberately left untouched.

### Design decisions
- **Theme**: Material 3 palette taken from `ui-mpoknori/dashboard_utama_si_mpok_nori.html` — light `background #f8f9ff`, `primary #00173b`, `primary-container #0f2c59`, `secondary #a73a00`, `secondary-container #fd651e`. The dark theme is a *derived* palette (`background #0d1c2e`, `primary #d8e2ff`, `secondary #ffb599`) rather than an independent design, so dark mode keeps brand identity.
- **Light stays the default.** Dark mode is retained, not removed.
- **Typography**: every role (`sans`, `serif`, `mono`) resolves to Plus Jakarta Sans, since the design uses a single family. Loaded via `next/font/google` in `app/layout.tsx`.
- **Radius / spacing / component structure**: unchanged, per the "colours + logo only" scope.

### Changes
- **`app/layout.tsx`** — `Plus_Jakarta_Sans` (weights 400/500/600/700/800, `latin`) wired to `--font-jakarta-sans` and aliased into all three font roles. Metadata retitled to SI-MPOK NORI, favicon switched to the new PNG icon, `html lang="id"`. The anti-FOUC inline script now seeds `light` (instead of following the OS preference) and writes the new `theme-color`.
- **`app/globals.css`** — added the `:root` M3 light block and the `.dark` derived block, plus the auth/dashboard surface helpers (`auth-bg`, `auth-orb-*`, `auth-panel`, `auth-title`, `auth-highlight`, `dashboard-card`, `stat-icon-*`) and the new `--sidebar-active` / `--sidebar-hover` tokens. Replaced the font-role mapping to point at Jakarta. Existing auth classes (`brand-gradient`, `btn-shine`, `glass-panel`, `ambient-orb`, `nf-logo`, …) were kept — Phase 46 removed only the landing-only CSS, and the login screen still depends on them.
- **`lib/theme/provider.tsx`** — default resolved theme changed from `"system"` to `"light"`, theme-color metadata updated.
- **`components/dashboard/notification-chart.tsx`** — the four hardcoded dark-mode hex colours (`#1e293b`, `#0f172a`, …) were unreadable on the new light background. Replaced with `var(--chart-*)` tokens plus a `muted` foreground token, driven off the new palette.
- **`components/ui/sidebar.tsx`** — the active-item style was hardcoded to the old neutral palette; now driven by `--sidebar-active`, which is a navy tint in light and a bright navy in dark.
- **`components/layouts/brand-logo.tsx`** — new. Replaces `components/layouts/notifin-logo.tsx`. Renders a single transparent PNG sized by a `variant` prop (`mark` / `sm` / `md` / `lg`) so the same asset serves the login page, the sidebar and the favicon. No light/dark variants — the logo already has enough contrast to sit on both.
- **`components/layouts/sidebar.tsx`** — brand block re-rendered with `<BrandLogo variant="md" />`, name "SI-MPOK NORI", Indonesian tagline, and the footer version string re-branded. The inline `<img src="/icon.svg">` was removed in favour of the new component.
- **`app/(auth)/login/page.tsx`** — brand block now shows the SI-MPOK NORI seal, the new wordmark, and the Indonesian tagline; form styling retargeted to the new auth surface tokens.
- **`scripts/make-brand-assets.ts`** — new. Reproducible asset pipeline built on Jimp: reads the source JPEG, strips the external white background with a two-pass flood fill (tight tolerance pass to seed the border, then a looser pass constrained to the seeded region so the *interior* white of the seal is preserved), trims to the content bounding box, and writes:
  - `public/brand/si-mpok-nori-logo.png` — 512×512, transparent
  - `public/brand/icon.png` — 192×192, transparent
  It also prints an ASCII preview and asserts that the four corners are transparent while the centre is opaque, so a bad strip fails loudly instead of shipping an invisible logo.
- **`public/notifin-logo.svg`, `public/notifin-logo-dark.svg`, `public/icon.svg`** — deleted. `public/brand/` added.
- **`lib/i18n/en.json` / `id.json`** — visible Notifin strings re-branded: `templates.variables.company`, `settings.emailPlatform`, `settings.emailProviderResend`, `settings.resendInfo`, `settings.fromNamePlaceholder`.
- **`app/(dashboard)/settings/page.tsx`** — OpenWA "Session Name" placeholder `notifin-session` → `si-mpok-nori-session` (cosmetic example text only; the stored value is unaffected).
- **Deliberately NOT changed**: `lib/email.ts` sender fallbacks (`notifications@notifin.app`, `Notifin <…>`) and `lib/db/seed.ts` (`admin@notifin.com`, `Admin Notifin`). These are operational values, not visual branding — editing the seed would not rewrite rows already in the database, and changing a sender address is a config decision rather than a rebrand.

### Files Created/Modified
```
components/layouts/brand-logo.tsx (new)
scripts/make-brand-assets.ts (new)
public/brand/si-mpok-nori-logo.png (new, 512x512)
public/brand/icon.png (new, 192x192)
public/notifin-logo.svg (deleted)
public/notifin-logo-dark.svg (deleted)
public/icon.svg (deleted)
components/layouts/notifin-logo.tsx (deleted)
app/layout.tsx
app/globals.css
lib/theme/provider.tsx
components/dashboard/notification-chart.tsx
components/ui/sidebar.tsx
components/layouts/sidebar.tsx
app/(auth)/login/page.tsx
app/(dashboard)/settings/page.tsx
lib/i18n/en.json, lib/i18n/id.json
PHASES.md (this update)
```

### Verification
- `bunx tsc --noEmit` — clean.
- `bun run lint` — 79 problems (27 errors / 52 warnings) vs a `master` baseline of 81 (27 errors / 54 warnings) measured via `git stash`. The delta is exactly −2 `no-img-element` warnings: `components/layouts/notifin-logo.tsx` (deleted) and `components/layouts/sidebar.tsx` (`<img>` replaced by `<BrandLogo>`). No new problems introduced. The 27 errors are pre-existing and unrelated.
- `bun run build` — succeeds; `/login` prerendered, middleware registered.
- Runtime smoke test against `bun run start`: `/` → `307` → `/login`; `/login` → `200`; `/brand/icon.png` and `/brand/si-mpok-nori-logo.png` both → `200 image/png`.
- Logo assets validated programmatically: all four corners transparent, centre opaque, correct dimensions.

### Note on untracked references
`ui-mpoknori/` (the user-supplied design HTML and the source logo JPEG) and `docs/` are not committed — they are input material, not app code. `scripts/make-brand-assets.ts` reads from `ui-mpoknori/`, so the generated PNGs are the committed artefact; re-running the script locally requires that folder to be present.

---

## Phase 48: Jabatan & Unit Kerja on Users — e-TPP Auto-Fill + CSV/XLSX Bulk Upsert

### Scope
Users had only `name` / `phone` / `email` / `timezone`, so an employee's position and unit had nowhere to live and every notification template had to hardcode them. This phase adds `jabatan` and `unit_kerja` as real columns, populates them automatically from the e-TPP file each user already uploads, and replaces the blind-insert CSV importer with an idempotent upsert that also accepts Excel.

### Design decisions
- **Dedicated nullable columns**, not a `metadata` blob. They are queried, filtered and rendered in tables, and two of them need per-tenant uniqueness-free matching.
- **Auto-fill is fill-if-empty by default.** A per-user import overwrites `jabatan` / `unit_kerja` only where the stored value is empty, so re-uploading an e-TPP file never clobbers a value someone corrected by hand. An explicit `overwriteProfile` flag (a toggle on the import screen) is the only way to force it. The global import has no target user and therefore does not write profile data at all.
- **e-TPP `unit_kerja` comes from `perangkat_daerah.nalok`, not the label reading "Unit Kerja".** In the real document the "Unit Kerja" label sits above a field that holds the *subordinate* device name (e.g. `KECAMATAN PALMERAH KOTA ADM. JAKARTA BARAT`) while `perangkat_daerah_induk.nalok` holds the parent (`KOTA ADMINISTRASI JAKARTA BARAT`). The HTML labels are used as the primary source and the embedded JSON payload as a fallback; the mapping is recorded in `ProfileSource` so it can be corrected without touching the parser.
- **Bulk import upserts, and partial failure is not an error.** The old importer was one `INSERT … VALUES` for the whole file, so a single duplicate phone rolled back every row and the API answered 500 with no indication of which line was at fault. Rows are now matched to existing users (email first, then phone) within the admin's tenant, and unresolvable rows are reported individually with their 1-based file line number while the rest of the batch still commits. The response is 200 with a per-row breakdown — a 500 would tell the user nothing.
- **Blank cells never blank a stored value.** Updates only write fields the file actually carried, so re-importing a partial spreadsheet cannot erase a hand-entered or e-TPP-derived value.
- **Excel is a first-class upload format, not just a download.** A template the app cannot read back would add a manual "Save As CSV" step to every import.

### Design decisions — Excel phone-number safety
Excel corrupts phone numbers in two ways, and both are addressed:
1. A numeric cell loses its leading zero (`0812…` → `812…`) and Excel renders a 13-digit number in General format as `6.28123E+12`.
2. Reading with SheetJS's `raw: false` returns that **display** string, so the value is already reduced to six significant digits before the app sees it — and the reconstructed number *looks* plausible, so it would import as silent data corruption.

The fix is threefold: read with `raw: true` (the stored value, which is exact for any phone number inside `Number.MAX_SAFE_INTEGER`); pre-format the template's `phone` column as Text by writing blank `z: "@"` cells down rows 3–200, so Excel applies the format to whatever the user types; and run `analyzePhone` client-side, where the original cell value still exists, to flag any cell that was stored as a number. Flagged rows are still imported — rejecting them would be worse than importing them with a visible warning.

### Changes
- **`lib/db/schema.ts`** — `users.jabatan` and `users.unit_kerja`, both `text`, nullable.
- **`lib/db/migrations/0011_user_jabatan_unit_kerja.sql`** (new) — two `ALTER TABLE … ADD COLUMN` statements, nothing else.
- **`lib/db/migrations/meta/0010_snapshot.json`** — **repaired.** The committed 0010 snapshot did not reflect migrations 0009/0010, so generating 0011 from it produced a migration that tried to re-add `data_imports.import_category_id`, re-create the category foreign key, and re-create `data_imports_global_unique` without its partial-index predicate. All three were injected into the snapshot so the generated 0011 is clean. The 0009/0010 `.sql` files themselves are untouched and still apply in order; only the metadata that drizzle diffs against was wrong.
- **`lib/db/migrations/meta/0011_snapshot.json`, `meta/_journal.json`** (new/modified) — snapshot and journal entry for the new migration.
- **`types/index.ts`** — `User.jabatan`, `User.unitKerja`.
- **`lib/validations.ts`** — shared `jabatanField` / `unitKerjaField` on `createUserSchema` (and therefore `updateUserSchema`); new `sourceProfileSchema`; `createImportSchema` gains optional `profile` and `overwriteProfile`. `bulkImportSchema` was split into an envelope (`z.array(z.unknown()).max(5000)`) plus a new `bulkUserRowSchema` applied **per row**, so one malformed email is reported against that row instead of rejecting the whole upload.
- **`lib/imports/types.ts`** — `SourceProfile` and `ParseResult.profile`.
- **`lib/imports/parsers/ekinerja/html.ts`** — `extractProfile()`: visible-label scraping with a brace-aware JSON payload fallback. The naive regex was fragile because the e-TPP page embeds several `…_nalok` keys and the "Unit Kerja" label maps to a different device level than its name suggests.
- **`app/api/users/[id]/imports/route.ts`** — after a successful import, writes the extracted profile to the user. Fill-if-empty unless `overwriteProfile`; scoped to the session's admin; returns `profileApplied`.
- **`app/(dashboard)/users/[id]/imports/page.tsx`** — sends `profile` + `overwriteProfile`, shows the detected jabatan/unit kerja above the upload, and exposes the overwrite toggle only when a value was actually detected.
- **`lib/users/bulk-import.ts`** (new) — `bulkUpsertUsers()`. Tenant-scoped matching (email first, then phone), chunked inserts, per-row sequential updates inside one transaction, and two conflict classes that would otherwise surface as a raw unique-violation rollback:
  - *cross-key* — a row whose email resolves to one user while its phone resolves to a different one. Matching on email alone would write that phone onto the wrong account; the row is rejected naming both users.
  - *duplicate squatting* — duplicate detection now checks both keys before reserving either, so a row that is itself rejected cannot reserve a phone number and block a later valid row from using it.
- **`lib/users/import-columns.ts`** (new) — the column contract shared by the CSV and Excel paths: canonical columns, header aliases, `mapRawRow`, `normalizePhone`, `looksLikeMangledPhone`, `analyzePhone`, `readUserRecords`, and the two template builders. Client-safe, with `xlsx` and `papaparse` loaded lazily.
- **`components/users/csv-import.tsx`** — rewritten. Accepts `.csv`, `.xlsx`, `.xls`; two download buttons; preview; success/failure summary; per-row error table; per-row warning table. `readUserRecords` uses `file.text()` for CSV rather than handing PapaParse the `File`, which routes through `FileReader` and is unavailable outside the browser.
- **`components/users/user-form.tsx`** — two new inputs.
- **`app/(dashboard)/users/page.tsx`** — Jabatan / Unit Kerja columns; user search now covers both.
- **`lib/variables.ts`** — `{{jabatan}}` and `{{unitKerja}}` available to template rendering, exposed alongside the existing `{{name}}` / `{{email}}` / `{{phone}}` user variables.
- **`lib/i18n/id.json`, `lib/i18n/en.json`** — new keys. `csv.downloadTemplate` was renamed to `csv.downloadTemplateCsv` for symmetry with the new `csv.downloadTemplateExcel`; both dictionaries were diffed key-by-key to confirm they stay identical.

### Files Created/Modified
```
lib/users/bulk-import.ts (new)
lib/users/import-columns.ts (new)
lib/db/migrations/0011_user_jabatan_unit_kerja.sql (new)
lib/db/migrations/meta/0011_snapshot.json (new)
lib/db/migrations/meta/0010_snapshot.json (repaired)
lib/db/migrations/meta/_journal.json
lib/db/schema.ts
lib/validations.ts
lib/imports/types.ts
lib/imports/parsers/ekinerja/html.ts
app/api/users/route.ts
app/api/users/[id]/imports/route.ts
app/(dashboard)/users/page.tsx
app/(dashboard)/users/[id]/imports/page.tsx
components/users/csv-import.tsx
components/users/user-form.tsx
lib/variables.ts
lib/i18n/id.json, lib/i18n/en.json
types/index.ts
PHASES.md (this update)
```

### Verification
- `bunx tsc --noEmit` — clean.
- `bun run lint` — 78 problems (27 errors / 51 warnings), unchanged from the pre-phase baseline; ESLint scoped to the touched files reports only two pre-existing unused-variable warnings in `app/api/users/route.ts`.
- `bun run build` — succeeds.
- **Import contract (66 assertions, all passing):** header aliases resolve regardless of case/punctuation/spacing; `normalizePhone` handles plain text, leading zeros, numeric cells, scientific notation, thousands separators, whitespace and `NaN`; `analyzePhone` stays silent on clean text and flags numeric cells, scientific notation, short and non-digit values; whitespace-only cells are dropped; the generated workbook is a real xlsx (PK zip magic, 20,877 bytes) with `z: "@"` on header, sample and pre-filled blank phone cells and a "Petunjuk" sheet; a generate → serialise → re-read round trip returns exactly one data row with phone, jabatan, unit_kerja, email and timezone intact; the 198 blank pre-filled rows are dropped rather than imported as phantom users; a hostile workbook with a genuinely numeric phone yields the **exact** digits; the CSV path still parses, including a leading-zero phone; header-only and garbage-byte uploads return no rows instead of throwing.
- **Bulk upsert against the live database (39 assertions, all passing):** explicit `null` phone/email accepted (this was a live 400 — `optional()` does not accept `null`); first run creates, second run updates the same rows with no duplication; a partial re-import does not null out hand-entered values; a four-row file with a bad email, a missing key and a duplicate applies only the one good row and reports rows 3, 4 and 5; the cross-key row is rejected naming both users and writes nothing; a rejected duplicate does not squat on a phone number; no match leaks across tenants; a short phone is imported **and** warned; empty and whitespace-name inputs behave. Test rows were scoped by a run-unique suffix and removed afterwards — the 8 seeded users were verified intact afterwards.
- e-TPP parser verified against `docs/Data Kinerja Saya _ e-TPP.html`: 12 items, 0 errors, all 8 profile fields extracted, and three consecutive parses produce byte-identical output.
- Local database pushed and confirmed to carry both columns and the correct `data_imports_user_unique` / `data_imports_global_unique` indexes.

### Notes
- `docs/` and `ui-mpoknori/` remain untracked input material, as in Phase 47.
- `xlsx@0.18.5` is the last release on npm under SheetJS's Community licence (the project subsequently moved to its own licence and stopped publishing there). It was already the parser of record for e-TPP and PDUKPD, so this phase stays consistent rather than introducing a second Excel library; migrating later would mean `@e965/xlsx` or `exceljs` across all call sites at once.
- The bulk importer is validated by ad-hoc scripts rather than a committed test suite, since the repo has no test runner. Those scripts were removed after use; the assertions are recorded above so they can be restored.

---

## Phase 50 - Template e-TPP: RHK IKU vs RHK Lainnya, kirim tanggal 5 & 25

### Problem
Phase 49 shipped a working cron, but every part of it that the user actually notices was wrong:

- The lists were populated from `intervensi`, which is the *program* name. In the real export it is byte-identical for the IKU and Lainnya rows, so the split carried no information at all. The field that differs is `rencanaHasilKerja`.
- `rencanaAksi` — the "Rencana Aksi" section the message asks for — was never extracted.
- The cron was `0 8 * * *`: every day, not the 5th and 25th.
- The message body was a hardcoded `DEFAULT_TEMPLATE`, so a template edited in the admin panel was silently ignored.
- WhatsApp only, though the requirement is both channels.
- `metadata.rkh_lainnya` was a typo, so `rhk_lainnya` always rendered as an empty list.
- The send loop queried every admin's users in one pass with no tenant scoping.

Separately, the template editor made these templates painful to build: chips were one flat list, and the live preview used a naive `replaceAll`, so a message containing `{{#each}}` previewed as literal `{{this}}`.

### What changed
- **`lib/users/etpp-extract.ts`** — rewritten.
  - `rhk_iku` and `rhk_lainnya` now come from `rencanaHasilKerja`, split on `kode_sumber`.
  - `ra` is a new list built from `rencanaAksi` across every row, so the message can number them continuously under one heading instead of restarting at each subset.
  - `kode_sumber` is matched exactly against the two tokens e-TPP actually emits (`"iku"`, `"other"`). The previous `""` → IKU guess is gone; a missing code now falls to Lainnya.
  - Whitespace is collapsed. These cells are multi-line in the export, and left alone they render as ragged gaps inside a numbered WhatsApp list.
- **`lib/templates/etpp-preset.ts`** (new) — the message text and the four insertable blocks, in one place shared by the editor and the verification script. Two rules are encoded here:
  - The section heading lives *inside* the `{{#if}}`. Outside it, a user with an empty list still gets a bare "1. Target Rencana Hasil Kerja (RHK) Lainnya:" and nothing under it.
  - The guard is `.length`, never the variable. `isTruthy` in `lib/template-engine.ts` returns true for an empty array, so `{{#if ra}}` would always render.
- **`components/templates/template-form.tsx`** — chips grouped (Data Pegawai / e-TPP / Umum), a "Pakai Template e-TPP" preset button, per-section block-insert buttons, and a live preview that runs through `templateEngine.preview` so `#each`, `#if` and `@number` render exactly as the worker will render them. Variable detection now parses block tags, so variables inside `{{#each ra}}` are found and the sample editor can populate them; list-valued variables are edited one item per line.
- **`app/api/users/[id]/imports/route.ts`** — the e-TPP metadata is returned as `metadata`; the jabatan/unit-keras payload moved to `profile` (it was overwriting the metadata slot).
- **`workers/etpp-notification.ts`** (renamed from `etpp-daily.ts`, which no longer described it) — cron is `0 8 5,25 * *`; the template is read from `settings` key `etpp.templateId` per admin instead of a hardcoded string; each admin is handled under its own tenant with `isAdminActive` checked; variables come from `resolveImportVars`; channels follow `template.channel` the way `lib/scheduler.ts` already does; the send marker is a full `YYYY-MM-DD` rather than a day-of-month, which previously skipped the 5th of the following month; users missing a phone or email are skipped rather than queued into a guaranteed failure.
- **`app/api/settings/etpp-template/route.ts`** (new) — get/set the configured template, rejecting ids owned by another tenant.
- **`app/(dashboard)/settings/page.tsx`** — a card to pick the e-TPP template.
- **`app/(dashboard)/schedules/page.tsx`** — a "Tanggal 5 & 25" cron preset. `describeCron` already renders it as "Setiap tanggal 5, 25 pukul 08:00".
- **`app/(dashboard)/templates/[id]/page.tsx`** — the edit page had its own copy of the editor, so everything above applied to *creating* a template only. Its variable detection was the same blind `/\{\{([\w.]+)\}\}/g`, and it saved that same blind list to `variables`, so editing a template stripped `rhk_iku` / `rhk_lainnya` / `ra` out of the record — the list rendered on the detail page and the sample data both silently emptied. The inline editor is deleted; the page now renders the shared `TemplateForm` in edit mode (it already POSTs vs PUTs off the `template` prop), which is where the grouped chips, preset, block insert and live preview live. Editing and creating are now the same code path and cannot drift apart again. Net −90 lines.

### What the e-TPP export does not contain
Verified by searching `docs/Data Kinerja Saya _ e-TPP.html`: Dialog Kinerja (6 hits) and Penilaian Perilaku (30 hits) appear only as navigation markup and preloaded JS, and e-Monev does not appear at all. Those are separate pages in the e-TPP application. The message template therefore covers only the target table, and the reminder was reduced to the two sections the data can actually fill.

### Files Created/Modified
```
lib/users/etpp-extract.ts (rewritten)
lib/templates/etpp-preset.ts (new)
workers/etpp-notification.ts (renamed from workers/etpp-daily.ts, rewritten)
workers/scheduler-worker.ts
components/templates/template-form.tsx
app/(dashboard)/templates/[id]/page.tsx
app/api/users/[id]/imports/route.ts
app/api/settings/etpp-template/route.ts (new)
app/(dashboard)/settings/page.tsx
app/(dashboard)/schedules/page.tsx
lib/i18n/id.json, lib/i18n/en.json
```

### Verification
- `bunx tsc --noEmit` — clean.
- `bun run lint` — 78 problems (27 errors / 51 warnings), identical to the pre-phase baseline; the two new-file warnings found on the first pass were removed.
- `bun run build` — succeeds.
- **Edit page (checked by reading the diff):** no second editor remains, so the e-TPP preset and block insert are reachable from *Edit* as well as *New*, and `variables` written by a PUT now comes from the block-aware detector instead of the regex.
- **Extractor and render (22 assertions, all passing)** against `docs/Data Kinerja Saya _ e-TPP.html`: 12 items, 0 errors, 1 IKU and 2 Lainnya RHK entries, 6 action plans; every list value traces back to its source field; the IKU list contains only `iku` rows and the Lainnya list only `other` rows; no embedded newlines survive; a row with no `kode_sumber` lands in Lainnya; the preset renders with no unreplaced tags, each heading exactly once, and action plans numbered 1–6 continuously; empty lists collapse both headings while keeping the warning; all four insertable blocks render standalone and collapse when empty.
- The rendered message was compared against the requested wording field by field.
- Existing users who imported e-TPP before this change hold `intervensi`-based metadata and need to re-import once; no backfill script was written for that.

---

## Phase 50b - e-TPP: live month, strict `kode_sumber`, nested RA

Corrects three defects found while reviewing the Phase 50 output against the real
export, and settles the Rencana Aksi layout as option Y.

### 1. `bulan_ini` is computed live, not stored

The e-TPP export carries no document period. "Tahun Kinerja" is a datepicker
input, so its value never reaches the saved HTML, and the notification says
"Memasuki bulan ...". A month captured at import time goes stale immediately: a
user who imports once in September and never again would still be told
"September 2026" in December.

`formatBulanIni(now)` is exported from `lib/imports/variables.ts` and applied
inside `resolveImportVars`, which is the single funnel for all five render
paths (cron worker, test send, batch send, per-user preview, generic
scheduler). It is spread *after* `mergeVariables` on purpose, because
`mergeVariables` lets `users.metadata` override the user defaults, so a stored
value would otherwise win and defeat the point.

`resolveImportVars` takes an optional third `now: Date` argument, and
`buildImportVars` takes the same clock for `currentTw`, so a test can pin the
date instead of asserting against `new Date()`.

`bulan_ini` and `triwulan_ini` are both scrubbed from `users.metadata` on write.
Neither can be read from the file any more, so a leftover key could only ever
hold a stale value; `bulan_ini` is recomputed at send time and `triwulan_ini` is
gone from the notification layer entirely. `JSON.stringify` drops the
`undefined`, so the key is removed rather than stored as `null`.

### 2. `kode_sumber` is read strictly; unclassifiable rows are dropped

`rencana_hasil_kerja` cannot classify anything on its own. One RHK can sit under
either kind of indikator, so the IKU / Lainnya split has to come from the
`kode_sumber` attached to the **indikator** object, which e-TPP emits as `iku`
and `other` (rendered in the HTML as the `iku` / `lainnya` badges).

Only those two tokens are accepted, case-insensitively and trimmed. Anything
else -- including an empty cell -- drops the row, and its Rencana Aksi with it,
because without a classifiable RHK the action has no parent. The older code
defaulted an empty value to IKU, and the version before that defaulted it to
Lainnya; both silently mislabelled a whole notification and reported nothing.

The count lands on `data_imports.summary.etppSkippedNoKode` and **not** on
`users.metadata`: it is an audit trail for one file, not a variable any template
renders, so keeping it out of the template namespace leaves `metadata` holding
only what templates actually consume. Per-user audit is a query over
`data_imports.summary`. The route also logs
`[etpp] N baris tanpa kode_sumber dilewati` with `adminId` / `userId` /
`fileName`, and echoes the count in the response message so the admin sees the
drop instead of a quietly short notification.

### 3. `ra` is nested (option Y)

`ra` is now `Array<{ rhk: string; aksi: string[] }>`: one group per RHK with its
actions beneath it. The flat variant repeats the RHK once per action, which is
exactly the layout this change was meant to remove. Groups keep first-seen order
for both the RHKs and the actions inside them, so the message reads top to
bottom the way the export does, and groups with no actions are filtered out.

The template engine needed no change: `renderNodes` already pushes the item
scope ahead of the parent, so `{{#each ra}}` → `{{rhk}}` and a nested
`{{#each aksi}}` resolve correctly. Guards still test `.length`, never the
variable, because `isTruthy` returns true for an empty array.

`TemplateForm` gained a dedicated sample editor for `ra`: one row per group
with an `Input` for the RHK, a `Textarea` of one action per line, and
add/remove controls. `normalizeRaSample` coerces a legacy flat entry (a bare
string, or a `{rhk, aksi}` pair with a single action) into the nested shape so
a cached i18n bundle or a saved editor session cannot teach the wrong shape.

### Verification
- 64 assertions across 14 groups, all passing, against
  `docs/Data Kinerja Saya _ e-TPP.html` (12 items, 0 parse errors):
  `bulan_ini` with an injected clock across three months; `iku` and `other`
  routed correctly; missing, blank and unknown `kode_sumber` dropped and
  counted, with their actions dropped too; `case`/trim handling; nested RA
  shape, grouping and order; dedupe across four quarters; no empty RA groups;
  two users parsed back to back unable to see each other's data;
  `etppSkippedNoKode` present in `summary` and absent from `users.metadata`;
  the preset rendering with each RHK printed once and actions indented; empty
  lists collapsing both headings; all four insertable blocks rendering
  standalone; the merge layer overwriting a stale `bulan_ini` and dropping both
  period keys after a `JSON.stringify` round-trip. No unreplaced tags and no
  `undefined` in any rendered output.
- `bunx tsc --noEmit` — clean.
- `bun run lint` — 77 problems (27 errors / 50 warnings), one fewer than the
  pre-phase baseline of 78: removing the dead `tw` local in
  `resolveImportVars` cleared a warning. The remaining error in
  `template-form.tsx` (`react-hooks/set-state-in-effect`) and the warning in
  `imports/route.ts` (`catch (error)` unused) are both pre-existing, verified by
  linting the `HEAD` version of each file.
- `bun run build` — succeeds.
- **Not covered:** no browser run of import → metadata → preview → Settings →
  send, and no test-runner file was committed; the assertions above ran from a
  temporary script that was deleted afterwards.

### Notes for whoever picks this up
- Users who imported before this change need to re-import: their stored `ra` is
  a flat `string[]` and would render `{{rhk}}` as empty against the new preset.
  There is no backfill.
- Still open from the Phase 50 review, untouched here: `settings.value` is
  `.notNull()` while the route can write `null`; `workers/etpp-notification.ts`
  defines `DEFAULT_TIMEZONE` but `cron.schedule` never receives it; a missing
  `jabatan` / `unitKerja` leaves a blank line in the preset; and
  `perangkatDaerah` is extracted by the parser but never persisted or exposed.

---

## Phase 50c - e-TPP: Rencana Aksi with label, version 3, output/target, and fallback

### Why (updated)
- Empty Rencana Aksi sections shipped because metadata predated nested `ra`.
- Per-user exports also differ in which triwulan's target is relevant; showing all 4 TWs
  in every reminder is noise.

### 1. `ra` groups carry the indicator label, output/target, and the `RA<n>.` prefix
`lib/users/etpp-extract.ts`
- `EtppRencanaAksi` is now `{ rhk, kode_sumber, aksi, output }`, where:
  - `kode_sumber` is the message-facing label: `iku` → `IKU`, `other` → `Lainnya`.
  - `output` is an array of `{ nama, tw, satuan, target }` per triwulan, parsed from
    row-6 (output name) and row-7 (target per TW).
- `stripToCode` removes the T/O prefix (`T/O1.1.1.`, `T/O1.1.`, `T/O1.`, or `T/O1.`)
  from the output name. Handles trailing dot optional.
- `stripRaPrefix` removes the `RA1.` / `RA2.` numbering from each action.
- `ETPP_META_VERSION = 3` marks the new shape.

### 2. Version marker and stale-metadata warning
- `isEtppMetadataStale(metadata)` returns true if `etpp_imported && (etpp_meta_version ?? 0) < 3`.
- The user import page renders a warning banner, turning a silent data problem into
  an actionable task.
- `{{#else}}` fallback in the preset instructs users with no `ra` to re-import.

### 3. Template block
The RA block renders:
```
• [IKU] RHK Name
   - Aksi 1
   - Aksi 2
   → Output TW 3: Nama Output
   → Target: 1 Dokumen
```
Only triwulan matching `currentTw` (computed at send time from `bulan_ini`) is shown,
via the `filterRaForCurrentTw` helper invoked by the notification worker.

### 4. Sample editor gets an output textarea per group
Pipe-separated: `TW | nama | target | satuan`. The editor's Select for `kode_sumber`
and the new textarea let admins preview accurate sample data.

### Verified
- Fixture `docs/Data Kinerja Saya _ e-TPP.html`: 12 items → 3 RA groups x 2 actions,
  3 output entries (TW 3), no RA prefix in actions, stripped T/O in output names,
  `etpp_meta_version: 3` stamped.
- `docs/copy_table.html` (second user): same structure, per-user isolation confirmed.
- 90+ assertions passed (temporary script deleted).
- `tsc` clean, `lint` at 77 (baseline), `build` succeeds.

### Notes for whoever picks this up
- Users who imported under Phase 50 or 50b need to re-import. Until then they get
  the warning banner, and a Phase 50b user whose `ra` exists but predates the
  label briefly renders `• [] <RHK>`. The `{{#else}}` fallback deliberately does
  not cover that case: `ra` is non-empty, and suppressing a real list because one
  field is missing would hide data instead of a gap. There is no backfill -- the
  source HTML for the affected users is not in the repo.
- Still open, untouched here: the XLSX e-TPP parser never populates
  `kodeSumber`, so an `ekinerja-json` import type configured with `format: xlsx`
  drops every row (the seeded type is `html`); the "1." / "2." section numbers
  can skip 1 when `rhk_lainnya` is empty; and from the Phase 50 review,
  `settings.value` is `.notNull()` while the route can write `null`,
  `workers/etpp-notification.ts` defines `DEFAULT_TIMEZONE` but never passes it
  to `cron.schedule`, and `perangkatDaerah` is extracted but never persisted.

---

## Phase 51 - e-TPP: nested from `data_imports` at send time, no re-import

### Why
Phase 50c fixed the shape but kept writing it onto `users.metadata` at import time. Three
problems followed:
- Every user needed their own copy of the template, because the data was snapshotted per user
  rather than read from their file when the message goes out.
- Anyone who imported under Phase 50/50b had to re-import to get the new shape. The
  `isEtppMetadataStale` banner existed only to tell them that.
- The recipient gate read that same metadata flag, so the gate and the data could disagree:
  a user could hold a valid import and still be skipped, or flagged without a usable file.

The template that sent the 25 September message predated the fix (created 26 September) and
iterated `ra` for per-output rows, which no longer matched the nested shape.

### 1. `lib/users/etpp-extract.ts` rewritten
`extractEtppVariables(items, now)` rebuilds the variables from parsed items and returns
`{ variables, skippedNoKode }`. No metadata, no version marker.

- `EtppRhk` = `{ id_indikator, intervensi, rhk, indikator, kode_sumber, target, aksi[], output[] }`
- `EtppAksi` = `{ teks, kode, kriteria_keberhasilan }` — the `RA1.` / `KK1.1.` prefixes are
  split off into `kode`, never prepended to the text.
- `EtppOutput` = `{ nama, kode, triwulan: EtppTriwulan[] }`, where `EtppTriwulan` is
  `{ tw, target, satuan, realisasi, validasi }`. `nama` strips the `T/O1.1.1.` prefix.
- `kode_sumber` is the message label: `iku` → `IKU`, `other` → `Lainnya`. Rows with neither are
  skipped and counted rather than guessed at.
- `ra` is the nested `EtppRhk[]` (what the delivered message used);
  `ra_output` is a flat `[{ rhk, kode_sumber, output_ra, target }]` for templates that want one
  row per output. `ra_output.target` carries the triwulan-in-progress target only, so rows for
  other triwulan print `-`.

### 2. Grouping works on rows imported before this change
e-TPP's own `id_indikator` is the reliable key, but it only reaches us on imports made after
the parser started keeping it. The grouping key is `id_indikator` when present and
`intervensi | rencanaHasilKerja | indikator | kode_sumber` otherwise. Verified: rows with the
field stripped produce byte-identical structure to rows with it.

### 3. Parser keeps the fields a future grouping would want
`lib/imports/parsers/ekinerja/html.ts` now also reads `id_indikator` (row-0/row-1), `id_output`
and `status` (row-8), `slug_path`/`status` (row-7), the pivot `value`, and the whole cell under
`raw`. Added `CELL_REGEX.lastIndex = 0` before scanning: the regex is module-level and global,
so a throw part-way through would otherwise leave `lastIndex` mid-string and truncate every
later parse in the same process.

### 4. Variables resolved per send, not per import
`lib/imports/variables.ts` picks the newest `data_imports` row for the user with
`engine = 'ekinerja-json'`, falling back to the admin's `scope = 'global'` row, and assigns
the e-TPP variables alongside `bulan_ini`. Added scalars: `triwulan_ini` and
`dialog_periode` (`triwulan_ini <= 2 ? 1 : 2`).

The `imports.<key>.*` path is untouched — e-TPP does not depend on an import category, so which
category an admin filed the file under cannot break a template.

### 5. Recipients gated on the import, not a flag
`workers/etpp-notification.ts` resolves recipients from the presence of an e-TPP import:
every active user when a global one exists, otherwise the users who have their own.

### 6. Metadata write and staleness warning removed
`app/api/users/[id]/imports/route.ts` no longer writes e-TPP to `users.metadata`; it still
counts `skippedNoKode` for the response notice. `isEtppMetadataStale`, `ETPP_META_VERSION`, and
the banner in `users/[id]/imports/page.tsx` are gone.

### 7. Editor
- Nested list variables (`ra`, `ra_output`, `rhk`, `rhk_iku`, `rhk_lainnya`) are edited as JSON.
  A typed editor would only mirror the schema; the JSON is checked for parse failure and falls
  back to the last good value so a half-typed edit cannot blank the preview.
- New dropdown previews the unsaved content against a real user's data (600 ms debounce),
  through the new `POST /api/templates/preview`, which takes the body instead of a template id —
  the saved-template endpoint reads `content` from the database and cannot show what is about
  to be saved.
- `ETPP_PRESET` / `ETPP_BLOCKS` use the nested shape, and gained a rekap block over `ra_output`.

### 8. `{{else}}` was silently ignored
The engine only recognised `{{#else}}`. The preset shipped `{{else}}`, which fell through as
literal text, so **every** `#if` printed its warning text even when the condition held. The
engine now accepts `else` as an alias; the preset uses the canonical `#else`.

### Verified
`bun scripts/verify-etpp.ts` (kept in the repo — it is the only executable proof of the
no-re-import guarantee, and there is no test runner):
- `docs/copy_table.html`: 12 rows, no errors, 3 RHK groups (1 IKU / 2 Lainnya), 2 actions and
  4 outputs each, 12 `ra_output` rows.
- Rows with `idIndikator`/`raw` stripped group identically to rows with them.
- Empty import renders all 3 re-import notices; rows without `kode_sumber` are all skipped and
  counted; bare `{{else}}` resolves both ways.
- Both `data_imports` rows in the local DB (imported 2026-08-10, before the parser kept
  `idIndikator`) render through the shipped preset with no leftover tags.
- `tsc` clean; `lint` on the changed files adds nothing beyond the two pre-existing findings.

### Manual steps after deploy — no re-import needed
1. Settings → Notifikasi e-TPP Otomatis → `Template Tanggal 5`.
2. Save the template again.
3. `{{#each ra}}` → `{{#each ra_output}}` where per-output rows are wanted.
4. `{{imports.etpp.currentTw}}` → `{{triwulan_ini}}`; `Periode 1` → `Periode {{dialog_periode}}`.

### Notes for whoever picks this up
- `ra_output.target` is `-` for every output outside the triwulan in progress, so a rekap over
  all 12 outputs is mostly dashes. That is the intended contract; a rekap meant to be read needs
  the per-triwulan `output[].triwulan[]` from nested `ra` instead.
- `ra_output` carries no `triwulan_ini` snapshot, so switching to `ra_output_tw` is what scopes a
  rekap to the running quarter. See Phase 52.
- `id_indikator` is `null` on every stored import. Grouping currently leans on the context key
  for all real data; the id path only activates on imports made from here on.
- The XLSX e-TPP parser still never populates `kodeSumber`, so an `ekinerja-json` import type
  configured with `format: xlsx` drops every row (the seeded type is `html`). Untouched.
- `import_types` having 5 rows is correct — 2 admins x their own set. Not a bug.

---

## Phase 52 — `ra_output` per triwulan + `ra_output_tw`

### Problem
Phase 51's `ra_output` emitted one row per **Output** with the target filled in only for the
quarter in progress, `-` everywhere else. A rekap over it was 12 rows of which 9 were dashes —
exactly the placeholder noise the notification is supposed to avoid. There was also no way to
reach `realisasi`/`validasi` from a flat variable, and `target` came pre-joined with `satuan`
(`"1 Dokumen"`), so a template could not control its own spacing.

### Shape change
`EtppFlatRa` is now one row per **(Output, triwulan)** pair, and `target`/`satuan` are separate:

```ts
{ rhk, kode_sumber, output_ra, tw, target, satuan, realisasi, validasi }
```

- `ra_output` — every pair, all four quarters. Rows the e-TPP export left blank on all four
  fields (`target === "-"`, empty `satuan`, null `realisasi`/`validasi`) are skipped, so a
  template never has to filter dashes out.
- `ra_output_tw` — new; `ra_output` filtered to `tw === triwulan_ini`.

Both are derived at send time in `extractEtppVariables`, so this again needs no re-import.

### Template
```handlebars
{{#if ra_output_tw.length}}{{#each ra_output_tw}}• _[{{kode_sumber}}] Output RA:_ {{output_ra}}
   _Target TW{{tw}}:_ {{target}} {{satuan}}{{#if realisasi}} | _Realisasi:_ {{realisasi}}{{/if}}{{#if validasi}} | _Validasi:_ {{validasi}}{{/if}}
{{/each}}{{#else}}⚠️ Belum ada output di triwulan ini.{{/if}}
```

The `[{{kode_sumber}}]` label sits on the `{{output_ra}}` line, not merged into the `_Target_`
line, because the engine resolves a single path per tag and has no concatenation operator.
`•` rather than `*` because a repeated `*` pairs into WhatsApp bold; `_` is the italic marker.

### Verification (`bun scripts/verify-etpp.ts`)
Checked against both stored imports (2026-08-10, pre-change):
- `ra_output` = 12 rows; `ra_output_tw` per quarter = TW1:2, TW2:3, TW3:3, TW4:4.
- Every `ra_output_tw` row has `tw === currentTw` and is a member of `ra_output`.
- No `-`/empty `target`, no empty `satuan`.
- Every quarter contributes rows, so the filter is not hardcoded to one date.
- The TW4 block renders 4 rows, 605 chars, no leftover tags.

### Also changed
- `ETPP_PRESET` section 3 and the `rekap` block use `ra_output_tw` and print
  `{{target}} {{satuan}}`; their empty branch now says the quarter has no output instead of
  telling the user to re-import (re-importing cannot fix a genuinely empty quarter).
- `VARIABLE_GROUPS` for `etpp` gained `triwulan_ini`, `dialog_periode`, `ra_output` and
  `ra_output_tw` — `ra_output` had never been listed as a chip.
- i18n samples and `etppHint` (id + en) describe both flat lists.
- `tsc` clean; `verify-etpp` all green; lint on changed files adds nothing beyond the
  pre-existing `set-state-in-effect` error at `template-form.tsx:204`.

### Manual steps after deploy — still no re-import
1. Settings → Notifikasi e-TPP Otomatis → `Template Tanggal 5`.
2. Replace `{{#each ra_output}}` with `{{#each ra_output_tw}}` if the rekap should follow the
   running quarter; keep `ra_output` for an all-quarters view.
3. Drop any `{{target}}`-only formatting that assumed `satuan` was already joined in.

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/notifin

# Redis
REDIS_URL=redis://localhost:6379

# Fonnte WhatsApp Gateway
FONNTE_TOKEN=your_fonnte_token_here
FONNTE_RATE_LIMIT=100

# Email (SMTP/Nodemailer)
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_password
EMAIL_FROM=notifications@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_TIMEZONE=Asia/Jakarta
```
