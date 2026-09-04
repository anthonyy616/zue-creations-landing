import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminUsers } from "@/db/schema";

/** Fixed dummy hash so unknown emails cost the same as a real bcrypt compare (timing hardening). */
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function findAdminByEmail(email: string) {
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.trim().toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Verifies credentials and returns the admin user on success, or null on
 * failure. Always performs a bcrypt comparison (against a dummy hash when
 * the email is unknown) so response timing does not reveal which emails exist.
 */
export async function verifyCredentials(email: string, password: string) {
  const user = await findAdminByEmail(email);
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, hash);
  return user && valid ? user : null;
}
