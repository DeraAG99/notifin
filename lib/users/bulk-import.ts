import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { bulkImportSchema, bulkUserRowSchema } from "@/lib/validations";
import { looksLikeMangledPhone } from "./import-columns";
import type { User } from "@/types";

/** Rows per INSERT/UPDATE statement. Keeps the generated SQL well under limits. */
const CHUNK_SIZE = 500;

export interface BulkImportRowIssue {
  /** 1-based row number as it appears in the uploaded file. */
  row: number;
  name: string;
  error: string;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  /** Rows that could not be applied at all. */
  errors: BulkImportRowIssue[];
  /**
   * Rows that were applied but look suspicious. Non-fatal on purpose: rejecting
   * a row over a suspicious phone would be worse than importing it and saying so.
   */
  warnings: BulkImportRowIssue[];
  data: User[];
}

type NormalizedRow = {
  row: number;
  name: string;
  jabatan: string | null;
  unitKerja: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  /** Populated when the row collides with a row that appeared earlier in the file. */
  duplicateOf?: number;
};

function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Bulk-upsert users from a parsed CSV.
 *
 * The previous implementation was a single blind `INSERT ... VALUES (...)`, which
 * had two failure modes:
 *
 * 1. Re-importing the same file threw a unique violation on
 *    `(admin_id, phone)` or `(admin_id, email)`. Because the whole batch was one
 *    statement, a single duplicate rolled back *every* row and the API answered
 *    500 with "Failed to create user" -- the user had no way to tell which row
 *    was the problem.
 * 2. There was no per-row feedback at all, valid or otherwise.
 *
 * Now rows are matched to existing users within the admin's tenant (email first,
 * since it is the stricter of the two), updated or inserted accordingly, and any
 * row that cannot be resolved is reported individually while the rest of the
 * batch still goes through.
 */
export async function bulkUpsertUsers(
  rawRows: unknown,
  adminId: string
): Promise<BulkImportResult> {
  // Only the envelope is validated here; each row is checked individually below
  // so one bad email cannot reject an otherwise valid upload.
  const envelope = bulkImportSchema.parse(rawRows);

  const errors: BulkImportRowIssue[] = [];
  const warnings: BulkImportRowIssue[] = [];
  const rows: NormalizedRow[] = [];

  envelope.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for zero-based, +1 for the header line

    const checked = bulkUserRowSchema.safeParse(raw);
    if (!checked.success) {
      const detail = checked.error.issues
        .map((issue) => `${issue.path.join(".") || "baris"}: ${issue.message}`)
        .join("; ");
      errors.push({
        row: rowNumber,
        name: typeof (raw as { name?: unknown })?.name === "string"
          ? String((raw as { name?: unknown }).name)
          : "",
        error: detail || "Baris tidak valid",
      });
      return;
    }

    const row = checked.data;
    const name = clean(row.name);
    if (!name) {
      errors.push({ row: rowNumber, name: String(row.name ?? ""), error: "Nama kosong" });
      return;
    }

    const phone = clean(row.phone);
    const email = clean(row.email)?.toLowerCase() ?? null;

    // Without either key we cannot match against existing users, so an upsert
    // would silently create a duplicate on every re-import.
    if (!phone && !email) {
      errors.push({
        row: rowNumber,
        name,
        error: "Wajib mengisi minimal salah satu: phone atau email",
      });
      return;
    }

    if (looksLikeMangledPhone(phone)) {
      warnings.push({
        row: rowNumber,
        name,
        error: `Nomor telepon "${phone}" mencurigakan — pastikan kolom phone di Excel diformat sebagai Teks agar nol di depan tidak hilang`,
      });
    }

    rows.push({
      row: rowNumber,
      name,
      jabatan: clean(row.jabatan),
      unitKerja: clean(row.unitKerja),
      phone,
      email,
      timezone: clean(row.timezone) || "Asia/Jakarta",
    });
  });

  // Intra-file duplicates. The database unique indexes would reject the second
  // occurrence, but failing the whole statement for a spreadsheet mistake is
  // unhelpful -- surface it as a row error instead.
  const seenPhone = new Map<string, number>();
  const seenEmail = new Map<string, number>();
  const resolvable: NormalizedRow[] = [];

  for (const row of rows) {
    // Check both keys before reserving either one. Reserving eagerly would let a
    // row that is itself rejected (e.g. duplicate email) squat on a phone number
    // and then block a later, perfectly valid row from using it.
    const phoneClash = row.phone ? seenPhone.get(row.phone) : undefined;
    const emailClash = row.email ? seenEmail.get(row.email) : undefined;

    if (phoneClash !== undefined || emailClash !== undefined) {
      const conflict = phoneClash ?? emailClash!;
      row.duplicateOf = conflict;
      errors.push({
        row: row.row,
        name: row.name,
        error: `Duplikat di baris ${conflict} pada file yang sama (phone/email sama)`,
      });
      continue;
    }

    if (row.phone) seenPhone.set(row.phone, row.row);
    if (row.email) seenEmail.set(row.email, row.row);
    resolvable.push(row);
  }

  if (resolvable.length === 0) {
    return { created: 0, updated: 0, errors, warnings, data: [] };
  }

  // Load the existing users this batch could match.
  const phones = resolvable.map((r) => r.phone).filter((p): p is string => p !== null);
  const emails = resolvable.map((r) => r.email).filter((e): e is string => e !== null);

  const conditions = [];
  if (phones.length) conditions.push(inArray(users.phone, phones));
  if (emails.length) conditions.push(inArray(users.email, emails));

  const existing = await db
    .select({
      id: users.id,
      name: users.name,
      jabatan: users.jabatan,
      unitKerja: users.unitKerja,
      phone: users.phone,
      email: users.email,
      timezone: users.timezone,
      isActive: users.isActive,
      metadata: users.metadata,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(
      conditions.length === 1
        ? and(eq(users.adminId, adminId), conditions[0])
        : and(eq(users.adminId, adminId), or(...conditions))
    );

  const byEmail = new Map<string, (typeof existing)[number]>();
  const byPhone = new Map<string, (typeof existing)[number]>();
  for (const u of existing) {
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
    if (u.phone) byPhone.set(u.phone, u);
  }

  const toInsert: NormalizedRow[] = [];
  const toUpdate: { row: NormalizedRow; id: string }[] = [];
  /** Guards against two rows in one file updating the same database row. */
  const claimed = new Map<string, number>();

  for (const row of resolvable) {
    const byEmailMatch = row.email ? byEmail.get(row.email) : undefined;
    const byPhoneMatch = row.phone ? byPhone.get(row.phone) : undefined;
    const match = byEmailMatch ?? byPhoneMatch;

    if (!match) {
      toInsert.push(row);
      continue;
    }

    const priorRow = claimed.get(match.id);
    if (priorRow !== undefined) {
      errors.push({
        row: row.row,
        name: row.name,
        error: `Menyunjuk user yang sama dengan baris ${priorRow} (${match.name})`,
      });
      continue;
    }

    // The two keys can resolve to *different* users. That happens when someone
    // changes the phone of an existing user in a spreadsheet while typing another
    // user's email in the same row: matching on email alone would then write that
    // phone onto the wrong account, and either silently merge two people or trip
    // the unique index and roll back the whole transaction.
    if (byEmailMatch && byPhoneMatch && byEmailMatch.id !== byPhoneMatch.id) {
      errors.push({
        row: row.row,
        name: row.name,
        error: `Email milik "${byEmailMatch.name}" tapi nomor telepon milik "${byPhoneMatch.name}". Satu baris tidak boleh menggabungkan identitas dua user.`,
      });
      continue;
    }

    claimed.set(match.id, row.row);
    toUpdate.push({ row, id: match.id });
  }

  let created: User[] = [];
  const updated: User[] = [];

  await db.transaction(async (tx) => {
    for (const group of chunk(toInsert, CHUNK_SIZE)) {
      const inserted = await tx
        .insert(users)
        .values(
          group.map((r) => ({
            adminId,
            name: r.name,
            jabatan: r.jabatan,
            unitKerja: r.unitKerja,
            phone: r.phone,
            email: r.email,
            timezone: r.timezone,
          }))
        )
        .returning();
      created = created.concat(inserted as User[]);
    }

    for (const group of chunk(toUpdate, CHUNK_SIZE)) {
      for (const { row, id } of group) {
        // Only overwrite a field when the CSV actually carried a value, so a
        // re-import of a partial spreadsheet cannot blank out fields that were
        // filled in by hand (or by the e-TPP auto-fill).
        const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
        if (row.name) patch.name = row.name;
        if (row.jabatan) patch.jabatan = row.jabatan;
        if (row.unitKerja) patch.unitKerja = row.unitKerja;
        if (row.phone) patch.phone = row.phone;
        if (row.email) patch.email = row.email;
        if (row.timezone) patch.timezone = row.timezone;

        const [result] = await tx
          .update(users)
          .set(patch)
          .where(and(eq(users.id, id), eq(users.adminId, adminId)))
          .returning();
        if (result) updated.push(result as User);
      }
    }
  });

  errors.sort((a, b) => a.row - b.row);
  warnings.sort((a, b) => a.row - b.row);

  return {
    created: created.length,
    updated: updated.length,
    errors,
    warnings,
    data: created.concat(updated),
  };
}
