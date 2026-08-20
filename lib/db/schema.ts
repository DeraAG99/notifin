import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  uuid,
  pgEnum,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const channelEnum = pgEnum("channel", ["wa", "email", "both"]);
export const statusEnum = pgEnum("status", [
  "pending",
  "sent",
  "failed",
  "delivered",
  "read",
]);
export const priorityEnum = pgEnum("priority", ["urgent", "normal", "low"]);
export const adminRoleEnum = pgEnum("admin_role", ["superadmin", "admin"]);

export const admins = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: adminRoleEnum("role").default("admin"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    timezone: text("timezone").default("Asia/Jakarta"),
    isActive: boolean("is_active").default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("users_admin_phone_unique").on(table.adminId, table.phone),
    uniqueIndex("users_admin_email_unique").on(table.adminId, table.email),
  ]
);

export const notificationTemplates = pgTable("notification_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .references(() => admins.id, { onDelete: "cascade" })
    .notNull(),
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
  adminId: uuid("admin_id")
    .references(() => admins.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id")
    .references(() => notificationTemplates.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  cronExpression: text("cron_expression").notNull(),
  isActive: boolean("is_active").default(true),
  lastSentAt: timestamp("last_sent_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable(
  "settings",
  {
    adminId: uuid("admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: jsonb("value").$type<string | number | boolean | null>().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.adminId, table.key] })]
);

export const notificationLogs = pgTable("notification_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .references(() => admins.id, { onDelete: "cascade" })
    .notNull(),
  templateId: uuid("template_id").references(() => notificationTemplates.id),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
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

export const dataImports = pgTable(
  "data_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope").default("user").notNull(),
    categoryId: uuid("import_category_id")
      .references(() => importCategories.id, { onDelete: "restrict" })
      .notNull(),
    source: text("source").default("ekinerja").notNull(),
    engine: text("engine").default("table").notNull(),
    fileName: text("file_name").notNull(),
    period: text("period"),
    data: jsonb("data").$type<Record<string, unknown>[]>().notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("data_imports_user_unique").on(
      table.adminId,
      table.userId,
      table.categoryId
    ),
    uniqueIndex("data_imports_global_unique")
      .on(table.adminId, table.categoryId)
      .where(sql`${table.scope} = 'global'`),
  ]
);

export const importTypes = pgTable(
  "import_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    engine: text("engine").default("table").notNull(),
    format: text("format").default("html").notNull(),
    detectRules: jsonb("detect_rules").$type<string[]>().default([]).notNull(),
    columnMapping: jsonb("column_mapping").$type<Record<string, unknown>>(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("import_types_admin_key_unique").on(table.adminId, table.key),
  ]
);

export const importCategories = pgTable(
  "import_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id")
      .references(() => admins.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("import_categories_admin_key_unique").on(table.adminId, table.key),
  ]
);
