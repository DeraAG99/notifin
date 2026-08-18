import { z } from "zod";

export const channelSchema = z.enum(["wa", "email", "both"]);
export const statusSchema = z.enum([
  "pending",
  "sent",
  "failed",
  "delivered",
  "read",
]);
export const prioritySchema = z.enum(["urgent", "normal", "low"]);

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z
    .string()
    .regex(/^\d+$/, "Phone must contain only digits")
    .min(10, "Phone must be at least 10 digits")
    .max(15, "Phone must be at most 15 digits")
    .optional()
    .nullable(),
  email: z.string().email("Invalid email address").optional().nullable(),
  timezone: z.string().default("Asia/Jakarta"),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const updateUserSchema = createUserSchema.partial();

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  channel: channelSchema,
  subject: z.string().max(200).optional().nullable(),
  content: z.object({
    text: z.string().min(1, "Content text is required"),
    html: z.string().optional(),
  }),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createScheduleSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  userId: z.string().uuid("Invalid user ID"),
  cronExpression: z
    .string()
    .min(1, "Cron expression is required")
    .refine(
      (val) => {
        const parts = val.split(" ");
        return parts.length === 5;
      },
      { message: "Invalid cron expression format (need 5 parts)" }
    ),
  isActive: z.boolean().default(true),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export const sendNotificationSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  userId: z.string().uuid("Invalid user ID"),
  channel: channelSchema,
  priority: prioritySchema.default("normal"),
  scheduledAt: z.string().datetime().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export const batchSendSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  userIds: z.array(z.string().uuid()).min(1, "At least one user is required"),
  channel: channelSchema,
  priority: prioritySchema.default("normal"),
  variables: z.record(z.string(), z.unknown()).optional(),
});

export const templatePreviewSchema = z.object({
  sampleData: z.record(z.string(), z.unknown()).default({}),
  userId: z.string().uuid("User tidak valid").optional(),
});

export const logFilterSchema = z.object({
  channel: channelSchema.optional(),
  status: statusSchema.optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const fonnteWebhookSchema = z.object({
  event: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const waProviderEnum = z.enum(["fonnte", "evolution", "baileys", "openwa"]);

export const settingsSchema = z.object({
  waProvider: waProviderEnum.optional(),
  fonnteToken: z.string().optional(),
  fonnteRateLimit: z.number().int().positive().optional(),
  evolutionBaseUrl: z.string().optional(),
  evolutionApiKey: z.string().optional(),
  evolutionInstance: z.string().optional(),
  openwaBaseUrl: z.string().optional(),
  openwaApiKey: z.string().optional(),
  openwaSession: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().positive().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpSecure: z.enum(["ssl", "starttls", "none"]).optional(),
  emailProvider: z.enum(["smtp", "resend"]).optional(),
  emailFrom: z.string().email().optional(),
  emailFromName: z.string().max(100).optional(),
  defaultTimezone: z.string().optional(),
  waConcurrency: z.number().int().positive().optional(),
  emailConcurrency: z.number().int().positive().optional(),
});

export const createAdminSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const updateAdminSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini harus diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
});

export const bulkImportSchema = z.array(
  z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    timezone: z.string().optional(),
  })
);

export const importItemSchema = z.object({
  intervensi: z.string(),
  rencanaHasilKerja: z.string(),
  indikator: z.string(),
  kodeSumber: z.string().nullable(),
  target: z.string().nullable(),
  rencanaAksi: z.string(),
  kriteriaKeberhasilan: z.string(),
  output: z.string(),
  triwulan: z.number().int().min(1).max(4),
  satuan: z.string(),
  targetValue: z.string(),
  realisasi: z.string().nullable(),
  validasi: z.string().nullable(),
  konsolidasi: z.string().nullable().optional(),
  polarisasi: z.string().nullable().optional(),
  capaian: z.string().nullable().optional(),
  keterangan: z.string().nullable().optional(),
  keteranganValidasi: z.string().nullable().optional(),
  raw: z.record(z.string(), z.string().nullable()).optional(),
});

export const createImportSchema = z.object({
  importTypeId: z.string().uuid("Tipe import tidak valid"),
  categoryId: z.string().uuid("Kategori import tidak valid"),
  fileName: z.string().min(1, "Nama file wajib diisi"),
  period: z.string().nullable().optional(),
  items: z.array(importItemSchema).min(1, "Tidak ada data untuk diimpor"),
});

export const updateImportSchema = z.object({
  period: z.string().nullable().optional(),
});

export const columnRuleSchema = z.object({
  field: z.enum([
    "kegiatan",
    "indikator",
    "satuan",
    "konsolidasi",
    "polarisasi",
    "targetTahunan",
    "triwulan",
    "target",
    "realisasi",
    "capaian",
    "keterangan",
    "validasi",
    "keteranganValidasi",
  ]),
  match: z.string().min(1, "Pola header wajib diisi"),
  mode: z.enum(["exact", "contains", "contains-exclude"]),
  exclude: z.string().optional(),
});

export const tableMappingSchema = z.object({
  headerRow: z.array(z.string().min(1)).min(1, "Minimal 1 kata kunci baris header"),
  columns: z.array(columnRuleSchema).min(1, "Minimal 1 mapping kolom"),
  triwulanRegex: z.string().min(1, "Regex triwulan wajib diisi"),
});

export const createImportTypeSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_]+$/, "Key hanya huruf kecil, angka, dan underscore")
    .min(1)
    .max(40),
  name: z.string().min(1, "Nama wajib diisi").max(100),
  engine: z.enum(["table", "ekinerja-json"]).default("table"),
  format: z.enum(["html", "xlsx"]).default("html"),
  detectRules: z.array(z.string().min(1)).default([]),
  columnMapping: tableMappingSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateImportTypeSchema = createImportTypeSchema.partial();

export const createImportCategorySchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9_]+$/, "Key hanya huruf kecil, angka, dan underscore")
    .min(1)
    .max(40),
  name: z.string().min(1, "Nama wajib diisi").max(100),
  description: z.string().max(255).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateImportCategorySchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100).optional(),
  description: z.string().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>;
export type CreateImportInput = z.infer<typeof createImportSchema>;
export type UpdateImportInput = z.infer<typeof updateImportSchema>;
export type CreateImportTypeInput = z.infer<typeof createImportTypeSchema>;
export type UpdateImportTypeInput = z.infer<typeof updateImportTypeSchema>;
export type CreateImportCategoryInput = z.infer<typeof createImportCategorySchema>;
export type UpdateImportCategoryInput = z.infer<typeof updateImportCategorySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
export type BatchSendInput = z.infer<typeof batchSendSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type LogFilterInput = z.infer<typeof logFilterSchema>;
