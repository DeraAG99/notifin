import "dotenv/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { db } from "./index";

loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });
import {
  admins,
  users,
  notificationTemplates,
  notificationSchedules,
  notificationLogs,
} from "./schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth/session";

async function seed() {
  console.log("Seeding database...");

  const [existingAdmin] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(sql`${admins.email} = 'admin@notifin.com'`)
    .limit(1);

  if (!existingAdmin) {
    const passwordHash = await hashPassword("admin123");
    const [created] = await db.insert(admins).values({
      email: "admin@notifin.com",
      passwordHash,
      name: "Admin Notifin",
      role: "superadmin",
    }).returning();
    console.log("Default admin created: admin@notifin.com / admin123");
    var adminId = created.id;
  } else {
    console.log("Admin already exists, skipping...");
    var adminId = existingAdmin.id;
  }

  const insertedUsers = await db
    .insert(users)
    .values([
      {
        name: "Ahmad Rizki",
        phone: "6281234567890",
        email: "ahmad@example.com",
        timezone: "Asia/Jakarta",
        adminId,
      },
      {
        name: "Sari Dewi",
        phone: "6281234567891",
        email: "sari@example.com",
        timezone: "Asia/Jakarta",
        adminId,
      },
      {
        name: "Budi Santoso",
        phone: "6281234567892",
        email: "budi@example.com",
        timezone: "Asia/Makassar",
        adminId,
      },
      {
        name: "Maya Putri",
        phone: "6281234567893",
        email: "maya@example.com",
        timezone: "Asia/Jayapura",
        adminId,
      },
      {
        name: "Andi Pratama",
        phone: null,
        email: "andi@example.com",
        timezone: "Asia/Jakarta",
        adminId,
      },
    ])
    .returning();

  console.log(`Inserted ${insertedUsers.length} users`);

  const insertedTemplates = await db
    .insert(notificationTemplates)
    .values([
      {
        name: "Welcome Message",
        channel: "wa",
        adminId,
        content: {
          text: "Selamat datang {{name}}! Akun Anda telah aktif. Hubungi kami jika butuh bantuan.",
        },
        variables: ["name"],
      },
      {
        name: "Invoice Reminder",
        channel: "email",
        subject: "Tagihan Anda - {{amount}}",
        adminId,
        content: {
          text: "Halo {{name}}, tagihan sebesar {{amount}} akan jatuh tempo pada {{date}}. Silakan lakukan pembayaran.",
          html: "<h2>Halo {{name}}</h2><p>Tagihan sebesar <strong>{{amount}}</strong> akan jatuh tempo pada {{date}}.</p><p>Silakan lakukan pembayaran.</p>",
        },
        variables: ["name", "amount", "date"],
      },
      {
        name: "Urgent Alert",
        channel: "wa",
        adminId,
        content: {
          text: "⚠️ URGENT: {{message}} - Segera ditindak!",
        },
        variables: ["message"],
      },
    ])
    .returning();

  console.log(`Inserted ${insertedTemplates.length} templates`);

  const insertedSchedules = await db
    .insert(notificationSchedules)
    .values([
      {
        templateId: insertedTemplates[0].id,
        userId: insertedUsers[0].id,
        cronExpression: "0 9 * * *",
        adminId,
      },
      {
        templateId: insertedTemplates[1].id,
        userId: insertedUsers[1].id,
        cronExpression: "0 10 1 * *",
        adminId,
      },
    ])
    .returning();

  console.log(`Inserted ${insertedSchedules.length} schedules`);

  const statuses = ["pending", "sent", "failed", "delivered", "read"] as const;
  const logEntries = Array.from({ length: 10 }, (_, i) => ({
    adminId,
    templateId: insertedTemplates[i % insertedTemplates.length].id,
    userId: insertedUsers[i % insertedUsers.length].id,
    channel: (i % 2 === 0 ? "wa" : "email") as "wa" | "email",
    status: statuses[i % statuses.length],
    priority: (["urgent", "normal", "low"] as const)[i % 3],
    content: { text: `Test notification ${i + 1}` },
    error: i % 4 === 0 ? "Connection timeout" : null,
    sentAt: i > 0 ? new Date() : null,
  }));

  const insertedLogs = await db
    .insert(notificationLogs)
    .values(logEntries)
    .returning();

  console.log(`Inserted ${insertedLogs.length} logs`);
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
