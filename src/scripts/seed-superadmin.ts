/**
 * Seed script — creates the first superadmin user if one doesn't exist yet.
 *
 * Run with:
 *   npm run seed
 *
 * Credentials come from env (or fall back to dev defaults):
 *   SEED_ADMIN_EMAIL      (default: admin@netfuel.ai)
 *   SEED_ADMIN_PASSWORD   (default: admin123456)
 *   SEED_ADMIN_NAME       (default: Super Admin)
 *
 * Idempotent: if a superadmin already exists, the script exits without doing
 * anything. Safe to re-run.
 */

import "dotenv/config";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import { database, connection } from "@/configs/connection.config";
import { users, account } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import { hashPassword } from "@/utils/password.util";

async function run() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@netfuel.ai";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123456";
  const name = process.env.SEED_ADMIN_NAME || "Super Admin";

  // 1. Bail out if a superadmin already exists
  const existingSuperAdmin = await database.query.users.findFirst({
    where: eq(users.isSuperAdmin, true),
    columns: { id: true, email: true },
  });

  if (existingSuperAdmin) {
    logger.info(
      `Superadmin already exists: ${existingSuperAdmin.email} — nothing to do.`
    );
    return;
  }

  // 2. Also bail if the target email is taken (by a non-superadmin) to avoid collisions
  const clash = await database.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });

  if (clash) {
    logger.error(
      `Email ${email} is already registered to a non-superadmin user. ` +
        `Pick a different SEED_ADMIN_EMAIL or delete the existing user first.`
    );
    process.exitCode = 1;
    return;
  }

  // 3. Create the superadmin + its credential account in one transaction.
  //    NOTE: use better-auth's hasher (scrypt) — bcrypt hashes fail at sign-in
  //    with "Invalid password hash" because better-auth only understands its
  //    own format.
  const userId = createId();
  const accountId = createId();
  const hashed = await hashPassword(password);

  await database.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      userRoles: "admin",
      role: "admin",
      isSuperAdmin: true,
      planSlug: "custom", // superadmin isn't on a regular plan
      brandCount: 0,
      banned: false,
    });

    await tx.insert(account).values({
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    });
  });

  logger.info("───────────────────────────────────────────────");
  logger.info("  Superadmin created successfully");
  logger.info(`  Email:    ${email}`);
  logger.info(`  Password: ${password}`);
  logger.info("  Login at the frontend admin UI, then change this password.");
  logger.info("───────────────────────────────────────────────");
}

run()
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
  });
