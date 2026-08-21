import { db } from "./db";
import { admins } from "./db/schema";
import { eq } from "drizzle-orm";

export interface AdminStatus {
  active: boolean;
  reason: "not_found" | "inactive" | "expired" | null;
}

export async function getAdminStatus(adminId: string): Promise<AdminStatus> {
  try {
    const [admin] = await db
      .select({ isActive: admins.isActive, expiresAt: admins.expiresAt })
      .from(admins)
      .where(eq(admins.id, adminId))
      .limit(1);

    if (!admin) return { active: false, reason: "not_found" };
    if (!admin.isActive) return { active: false, reason: "inactive" };
    if (admin.expiresAt && new Date(admin.expiresAt).getTime() < Date.now()) {
      return { active: false, reason: "expired" };
    }
    return { active: true, reason: null };
  } catch {
    return { active: false, reason: "not_found" };
  }
}

export async function isAdminActive(adminId: string): Promise<boolean> {
  return (await getAdminStatus(adminId)).active;
}
