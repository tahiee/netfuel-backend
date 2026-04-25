/**
 * Production-safe migration runner.
 *
 * Reads committed SQL files from `./drizzle/` and applies any that haven't
 * been run yet (drizzle tracks applied versions in `__drizzle_migrations`).
 * Re-running is safe — already-applied migrations are skipped.
 *
 * Used by the GitHub Actions deploy workflow:
 *   npm install
 *   npm run build
 *   npm run db:migrate   ← here
 *   pm2 restart netfuel-backend
 *
 * Differs from `drizzle-kit push`:
 *   - `push` syncs schema directly (no migration files, dev only)
 *   - `migrate` applies committed migrations in order (production-safe, reviewable)
 */

import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { database, connection } from "@/configs/connection.config";
import { logger } from "@/utils/logger.util";

async function run() {
  logger.info("Running migrations from ./drizzle …");
  await migrate(database, { migrationsFolder: "./drizzle" });
  logger.info("Migrations complete.");
}

run()
  .catch((err) => {
    logger.error({ err }, "Migration failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
  });
