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
  emailFrom: z.string().email().optional(),
  defaultTimezone: z.string().optional(),
  waConcurrency: z.number().int().positive().optional(),
  emailConcurrency: z.number().int().positive().optional(),
});

export const bulkImportSchema = z.array(
  z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    timezone: z.string().optional(),
  })
);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
export type BatchSendInput = z.infer<typeof batchSendSchema>;
export type LogFilterInput = z.infer<typeof logFilterSchema>;
