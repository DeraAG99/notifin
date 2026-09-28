import { z } from "zod";
import { validateCron } from "@/lib/cron-utils";

export const channelSchema = z.enum(["wa", "email", "both"]);
export const statusSchema = z.enum([
  "pending",
  "sent",
  "failed",
  "delivered",
  "read",
]);
export const prioritySchema = z.enum(["urgent", "normal", "low"]);

/**
 * Jabatan / unit kerja are shared between the single-user form and the CSV bulk
 * import. They must be declared in *both* schemas: Zod strips unknown keys by
 * default, so a field added to only one of them is silently dropped on the other
 * path (e.g. a CSV column that parses fine but never reaches the insert).
 */
const jabatanField = z
  .string()
  .max(200, "Jabatan maksimal 200 karakter")
  .optional()
  .nullable();
const unitKerjaField = z
  .string()
  .max(200, "Unit kerja maksimal 200 karakter")
  .optional()
  .nullable();

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  jabatan: jabatanField,
  unitKerja: unitKerjaField,
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
    .refine((val) => validateCron(val).valid, {
      message: "Invalid cron expression",
    }),
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

/**
 * Shape of a single row in a bulk user upload.
 *
 * Validated per row rather than as one array so that one malformed email
 * reports a problem with that row instead of rejecting the entire upload with a
 * 400 and no indication of which line was at fault.
 */
export const bulkUserRowSchema = z.object({
  name: z.string().min(1),
  jabatan: jabatanField,
  unitKerja: unitKerjaField,
  // Deliberately looser than createUserSchema: uploaded spreadsheets are not
  // guaranteed to carry a well-formed 10-15 digit phone or a valid email, and
  // rejecting the whole batch for that would be a regression. Note that
  // `optional()` alone would NOT accept the explicit `null` the client sends for
  // a blank cell, so `.nullable()` is required here.
  phone: z.string().optional().nullable(),
  email: z.string().email("Email tidak valid").optional().nullable(),
  timezone: z.string().optional().nullable(),
});

export const bulkImportSchema = z.array(z.unknown()).max(5000, "Maksimal 5000 baris per import");

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

/**
 * Identity block scraped from a source file's header (e-TPP "Data Kinerja Saya").
 * Mirrors `SourceProfile` in `lib/imports/types.ts`, but declared here so the
 * server re-validates rather than trusting whatever the client POSTs.
 */
export const sourceProfileSchema = z.object({
  name: z.string().max(200).nullish(),
  jabatan: z.string().max(200).nullish(),
  unitKerja: z.string().max(200).nullish(),
  perangkatDaerah: z.string().max(200).nullish(),
  email: z.string().max(200).nullish(),
  userId: z.string().max(100).nullish(),
  eselon: z.string().max(20).nullish(),
});

export const createImportSchema = z.object({
  importTypeId: z.string().uuid("Tipe import tidak valid"),
  categoryId: z.string().uuid("Kategori import tidak valid"),
  fileName: z.string().min(1, "Nama file wajib diisi"),
  period: z.string().nullable().optional(),
  items: z.array(importItemSchema).min(1, "Tidak ada data untuk diimpor"),
  profile: sourceProfileSchema.nullish(),
  /**
   * Force-write jabatan / unit kerja onto the user even if a value is already
   * stored. Without it the fill-if-empty rule applies, so manual edits are
   * never clobbered by a re-import.
   */
  overwriteProfile: z.boolean().optional(),
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
