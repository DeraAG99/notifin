export type Channel = "wa" | "email" | "both";
export type NotificationStatus =
  | "pending"
  | "sent"
  | "failed"
  | "delivered"
  | "read";
export type Priority = "urgent" | "normal" | "low";
export type AdminRole = "superadmin" | "admin";

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole | null;
  isActive: boolean | null;
  expiresAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AdminSummary extends Admin {
  userCount: number;
}

export interface AdminFormInput {
  name: string;
  email: string;
  password?: string;
  isActive?: boolean;
  expiresAt?: string | null;
}

export interface User {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  timezone: string | null;
  isActive: boolean | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  content: { text: string; html?: string };
  variables: string[] | null;
  isActive: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface NotificationSchedule {
  id: string;
  templateId: string;
  userId: string;
  cronExpression: string;
  isActive: boolean | null;
  lastSentAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date | null;
}

export interface NotificationLog {
  id: string;
  templateId: string | null;
  userId: string;
  channel: Channel;
  status: NotificationStatus | null;
  priority: Priority | null;
  content: { text: string; html?: string } | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date | null;
}

export interface Setting {
  key: string;
  value: string | number | boolean | null;
  updatedAt: Date | null;
}

export interface FonnteResponse {
  status: boolean;
  message: string;
  data?: {
    id: string;
  };
}

export interface DeviceStatus {
  status: boolean;
  data?: {
    device: string;
    battery: string;
    platform: string;
    connected: boolean;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  sentToday: number;
  charts: { date: string; wa: number; email: number }[];
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
