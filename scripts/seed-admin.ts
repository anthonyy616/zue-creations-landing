import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { adminUsers } from "../db/schema";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    throw new Error("Usage: seed-admin <email> <password>");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(adminUsers)
      .set({ passwordHash })
      .where(eq(adminUsers.id, existing[0].id));
    console.log(`Admin password updated: ${email}`);
  } else {
    await db.insert(adminUsers).values({ email, passwordHash });
    console.log(`Admin user created: ${email}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});