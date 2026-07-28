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
- `channel`: `wa`, `email`
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

## Phase 8: Polish & Finishing

### To Do
- [ ] `loading.tsx` for all routes
- [ ] `error.tsx` for all routes
- [ ] Toast notifications for all user actions
- [ ] Mobile responsive pass
- [ ] README.md with setup instructions
- [ ] Final TypeScript check
- [ ] Lint pass

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
