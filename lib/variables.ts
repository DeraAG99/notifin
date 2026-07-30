import type { User } from "@/types";

/**
 * Merge variables with priority: custom request > user metadata > user defaults
 * 
 * - Default: name, email, phone (from user record)
 * - Metadata: custom fields stored in user.metadata JSONB (e.g. amount, company, address)
 * - Custom: per-request variables passed in the API call (highest priority)
 */
export function mergeVariables(
  user: User,
  customVariables?: Record<string, unknown>
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    name: user.name,
    email: user.email,
    phone: user.phone,
  };

  const metadata = (user.metadata as Record<string, unknown>) || {};

  return {
    ...defaults,
    ...metadata,
    ...(customVariables || {}),
  };
}
