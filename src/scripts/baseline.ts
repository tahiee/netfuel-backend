/**
 * One-time baseline script for an existing production DB.
 *
 * The DB already has the schema (e.g., from an earlier `npm run dbpush`),
 * but `drizzle.__drizzle_migrations` is empty — so `npm run dbmigrate` thinks
 * no migrations have been applied and tries to re-run them, hitting
 * "type already exists" errors.
 *
 * This script reads `./drizzle/meta/_journal.json` and inserts a tracking row
 * for every migration listed there, marking them as already applied without
 * actually executing any SQL. Run ONCE on the droplet:
 *
 *   npm run dbbaseline
 *
 * After that, normal `npm run dbmigrate` will only run NEW migrations going
 * forward. Safe to run multiple times — checks for existing rows before
 * inserting.
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

async function run() {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    logger.error(`Journal not found at ${journalPath}`);
    process.exitCode = 1;
    return;
  }

  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  // 1. Make sure the tracking schema/table exists (mirrors what drizzle creates)
  await database.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  // 2. Read what's already tracked
  const existingResult = await database.execute<{ hash: string }>(
    sql`SELECT hash FROM "drizzle"."__drizzle_migrations"`
  );
  const alreadyTracked = new Set(existingResult.rows.map((r) => r.hash));

  let inserted = 0;
  for (const entry of journal.entries) {
    const sqlPath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      logger.warn(`Skipping ${entry.tag} — SQL file not found at ${sqlPath}`);
      continue;
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    // Drizzle hashes the migration SQL with sha256 to identify applied versions
    const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

    if (alreadyTracked.has(hash)) {
      logger.info(`Already tracked: ${entry.tag}`);
      continue;
    }

    await database.execute(
      sql`INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
          VALUES (${hash}, ${entry.when})`
    );
    logger.info(`Marked as applied: ${entry.tag} (${hash.slice(0, 12)}…)`);
    inserted += 1;
  }

  if (inserted === 0) {
    logger.info("Baseline already complete — no rows inserted.");
  } else {
    logger.info(`Baseline complete — ${inserted} migration(s) marked applied.`);
  }
}

run()
  .catch((err) => {
    logger.error({ err }, "Baseline failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await connection.end();
  });
