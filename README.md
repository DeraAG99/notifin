# Notifin

Smart notification system for WhatsApp & Email with scheduling, templates, and queue management.

## Tech Stack

- **Runtime:** Bun
- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** PostgreSQL + Drizzle ORM
- **UI:** shadcn/ui + Tailwind CSS v4
- **Queue:** BullMQ + Redis
- **WhatsApp:** Fonnte Gateway API
- **Email:** Nodemailer (SMTP) + React Email templates
- **Validation:** Zod v4
- **Charts:** Recharts
- **Scheduler:** node-cron
- **CSV:** PapaParse

## Prerequisites

- Node.js 18+ (or Bun)
- PostgreSQL
- Redis
- Fonnte WhatsApp Gateway account (for WhatsApp)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/DeraAG99/notifin.git
cd notifin
```

2. Install dependencies:
```bash
bun install
```

3. Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

4. Set up your database:
```bash
bun run db:push      # Push schema to database
bun run db:seed      # Seed with sample data
```

5. Start the development server:
```bash
bun run dev          # Next.js only
bun run dev:all      # All services (Next.js + worker + scheduler)
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Next.js dev server |
| `bun run build` | Build for production |
| `bun run worker` | Start notification worker |
| `bun run scheduler` | Start scheduler worker |
| `bun run dev:all` | Start all services concurrently |
| `bun run db:push` | Push schema changes |
| `bun run db:seed` | Seed database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run lint` | Run ESLint |

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `FONNTE_TOKEN` - Fonnte WhatsApp Gateway API token
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `EMAIL_FROM` - Sender email address

## Features

- **Templates:** Create reusable message templates with variables
- **Users:** Manage recipients with search, pagination, and CSV import
- **Schedules:** Set up automated notifications with cron expressions
- **Logs:** Track delivery status with filters and export
- **Queue:** Background job processing with BullMQ + Redis
- **Real-time:** Webhook support for delivery status updates

## Project Structure

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
emails/             # React Email templates
components/         # UI components
```

## License

MIT
