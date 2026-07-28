# Notifin - Implementation Phases

## Tech Stack
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **UI:** shadcn/ui + Tailwind CSS v4
- **Queue:** BullMQ + Redis
- **WhatsApp:** Fonnte Gateway API
- **Email:** Resend + React Email
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
  - Resend integration
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

## Phase 3: API Routes

### To Do
- [ ] CRUD `/api/templates`
  - GET /api/templates (list, filter by channel)
  - POST /api/templates (create)
  - PUT /api/templates/[id] (update)
  - DELETE /api/templates/[id] (delete)
  - POST /api/templates/[id]/preview (preview with sample data)
- [ ] CRUD `/api/users`
  - GET /api/users (list with pagination, search)
  - POST /api/users (create single/bulk)
  - PUT /api/users/[id]
  - DELETE /api/users/[id]
- [ ] Notifications `/api/notifications`
  - POST /api/notifications/send
  - POST /api/notifications/batch
- [ ] CRUD `/api/schedules`
  - GET /api/schedules (list all)
  - POST /api/schedules (create)
  - PUT /api/schedules/[id] (update/toggle)
  - DELETE /api/schedules/[id]
- [ ] Webhooks
  - POST /api/webhooks/fonnte (delivery status, incoming messages)
- [ ] Logs & Monitoring
  - GET /api/logs (list with filters)
  - GET /api/logs/stats (statistics)
  - GET /api/queue/stats (BullMQ metrics)
- [ ] Settings
  - GET/PUT /api/settings (config management)

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

## Phase 4: Workers

### To Do
- [ ] Notification worker (`workers/notification-worker.ts`)
  - Process WA and email jobs
  - Handle job failures + retries
  - Dead letter queue
  - Update notification logs
- [ ] Scheduler worker (`workers/scheduler-worker.ts`)
  - Cron tick loop
  - Load and process active schedules
  - Timezone conversion
  - Mark as sent + update next run

### Files to Create
```
workers/notification-worker.ts
workers/scheduler-worker.ts
```

---

## Phase 5: Frontend - Layout & Dashboard

### To Do
- [ ] Root layout update (`app/layout.tsx`)
  - Metadata (title, description)
  - Font configuration
  - Toaster provider
- [ ] Dashboard layout (`app/(dashboard)/layout.tsx`)
  - Sidebar navigation
  - Header with user info
  - Mobile responsive sheet menu
- [ ] Dashboard page (`app/(dashboard)/dashboard/page.tsx`)
  - Stat cards: Total sent, Delivered, Failed, Pending
  - Chart: Notifications per day (recharts)
  - Recent logs table
  - Queue health indicator
- [ ] Shared components
  - Loading skeletons
  - Empty states
  - Error boundaries

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

## Phase 6: Frontend - Feature Pages

### To Do
- [ ] Templates page (`app/(dashboard)/templates/page.tsx`)
  - Table list with channel badge
  - Create/Edit dialog with form
  - Content editor with variable picker
  - Live preview panel
  - Delete confirmation
- [ ] Template detail (`app/(dashboard)/templates/[id]/page.tsx`)
  - Detail view
  - Test send functionality
  - Schedule list using template
  - Recent logs
- [ ] Users page (`app/(dashboard)/users/page.tsx`)
  - Table with pagination, search
  - Import CSV dialog
  - Create/Edit user form
  - User detail: history, schedules
- [ ] Schedules page (`app/(dashboard)/schedules/page.tsx`)
  - Calendar/list view toggle
  - Cron builder (preset + custom)
  - Timezone selection
  - Manual trigger button
- [ ] Logs page (`app/(dashboard)/logs/page.tsx`)
  - Filterable table (date, channel, status, user)
  - Status badges (color coded)
  - Detail modal
  - Export to CSV
  - Retry failed
- [ ] Settings page (`app/(dashboard)/settings/page.tsx`)
  - Fonnte config form
  - Email config form
  - Default timezone
  - Queue concurrency settings
  - System health check

### Files to Create
```
app/(dashboard)/templates/page.tsx
app/(dashboard)/templates/[id]/page.tsx
app/(dashboard)/users/page.tsx
app/(dashboard)/schedules/page.tsx
app/(dashboard)/logs/page.tsx
app/(dashboard)/settings/page.tsx
components/templates/template-form.tsx
components/templates/template-preview.tsx
components/notifications/send-dialog.tsx
components/dashboard/* (as listed above)
```

---

## Phase 7: React Email Templates

### To Do
- [ ] Welcome email (`emails/welcome.tsx`)
- [ ] Notification email (`emails/notification.tsx`)

### Files to Create
```
emails/welcome.tsx
emails/notification.tsx
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
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run worker` | Start notification worker |
| `npm run scheduler` | Start scheduler worker |
| `npm run dev:all` | Start all services concurrently |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed database with sample data |
| `npm run lint` | Run ESLint |

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

# Email (Resend)
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=notifications@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEFAULT_TIMEZONE=Asia/Jakarta
```
