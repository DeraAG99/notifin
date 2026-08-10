import { getSession, type SessionPayload } from "./session";
import { NextResponse } from "next/server";

export type TenantScope =
  | { superadmin: true; adminId: string }
  | { superadmin: false; adminId: string };

export function isSuperadmin(session: SessionPayload): boolean {
  return session.role === "superadmin";
}

export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

export { getSession };
export type { SessionPayload };

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Forbidden: superadmin only" },
    { status: 403 }
  );
}
