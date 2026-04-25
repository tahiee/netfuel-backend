/**
 * Self-healing migration baseline.
 *
 * Only does something when the DB is in this specific broken state:
 *   - `users` table EXISTS (schema was created earlier — typically via dbpush)
 *   - `drizzle.__drizzle_migrations` is EMPTY (tracking was never populated)
 *
 * In any other state — fresh DB OR already-tracked DB — this is a no-op,
 * so it's safe to run on every deploy before `dbmigrate`.
 *
 * This avoids the "type already exists" loop without forcing manual SSH/UI
 * steps after the first prod push.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { sql } from "drizzle-orm";
import { database, connection } from "@/configs/connection.config";
import { logger } from "@/utils/logger.util";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints?: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const MIGRATIONS_FOLDER = "./drizzle";

async function trackingTableHasRows(): Promise<boolean> {
  // Drizzle's tracking table may not exist yet on a brand-new DB
  await database.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  const result = await database.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text AS count FROM "drizzle"."__drizzle_migrations"`
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

async function appSchemaExists(): Promise<boolean> {
  // `users` is the canonical app table — if it exists, the schema was applied.
  const result = await database.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS exists
  `);
  return Boolean(result.rows[0]?.exists);
}

async function run() {
  const tracked = await trackingTableHasRows();
  if (tracked) {
    logger.info("Tracking table already populated — baseline skipped.");
    return;
  }

  const schemaExists = await appSchemaExists();
  if (!schemaExists) {
    logger.info(
      "Fresh DB (no `users` table) — letting `dbmigrate` apply migrations normally."
    );
    return;
  }

  logger.warn(
    "Schema exists but tracking is empty — running baseline to mark all current migrations as already applied."
  );

  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    logger.error(`Journal not found at ${journalPath}`);
    process.exitCode = 1;
    return;
  }

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  for (const entry of journal.entries) {
    const sqlPath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      logger.warn(`Skipping ${entry.tag} — SQL file not found at ${sqlPath}`);
      continue;
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

    await database.execute(
      sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
          VALUES (${hash}, ${entry.when})`
    );
    logger.info(`Marked as applied: ${entry.tag} (${hash.slice(0, 12)}…)`);
  }

  logger.info("Baseline complete.");
}

run()
  .catch((err) => {
    logger.error({ err }, "Baseline failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
  });
