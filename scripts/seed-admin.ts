import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { adminUsers } from "../db/schema";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    throw new Error("Usage: seed-admin <email> <password>");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(adminUsers).values({ email, passwordHash });
  console.log(`Admin user created: ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
