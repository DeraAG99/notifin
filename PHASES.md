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
