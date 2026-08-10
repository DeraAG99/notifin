import { db } from "./db";
import { admins } from "./db/schema";
import { eq } from "drizzle-orm";

export async function isAdminActive(adminId: string): Promise<boolean> {
  try {
    const [admin] = await db
      .select({ isActive: admins.isActive, expiresAt: admins.expiresAt })
      .from(admins)
      .where(eq(admins.id, adminId))
      .limit(1);

    if (!admin || !admin.isActive) return false;
    if (admin.expiresAt && new Date(admin.expiresAt).getTime() < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
