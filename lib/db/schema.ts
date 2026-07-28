import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";

export const channelEnum = pgEnum("channel", ["wa", "email"]);
export const statusEnum = pgEnum("status", [
  "pending",
  "sent",
  "failed",
  "delivered",
  "read",
]);
export const priorityEnum = pgEnum("priority", ["urgent", "normal", "low"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").unique(),
  email: text("email").unique(),
  timezone: text("timezone").default("Asia/Jakarta"),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  channel: channelEnum("channel").notNull(),
  subject: text("subject"),
  content: jsonb("content")
    .$type<{ text: string; html?: string }>()
    .notNull(),
  variables: text("variables").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notificationSchedules = pgTable("notification_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .references(() => notificationTemplates.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  cronExpression: text("cron_expression").notNull(),
  isActive: boolean("is_active").default(true),
  lastSentAt: timestamp("last_sent_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").references(() => notificationTemplates.id),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  channel: channelEnum("channel").notNull(),
  status: statusEnum("status").default("pending"),
  priority: priorityEnum("priority").default("normal"),
  content: jsonb("content").$type<{ text: string; html?: string }>(),
  error: text("error"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
