import { migrate } from "drizzle-orm/node-postgres/migrator";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/schema/schema";
import { env } from "@/utils/env.util";
import { Pool } from "pg";
import { logger } from "@/utils/logger.util";

const poolConfig = env.skipDatabase
  ? {
      connectionString: env.CONNECTION_URL,
      max: 1,
      min: 0,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      allowExitOnIdle: true,
    }
  : {
      connectionString: env.CONNECTION_URL,
      max: 20,
      min: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      allowExitOnIdle: true,
    };

export const connection = new Pool(poolConfig);

// Log pool events for monitoring
connection.on("connect", () => {
  logger.debug("New database client connected");
});

connection.on("error", (err) => {
  logger.error({ err }, "Database pool error");
});

connection.on("remove", () => {
  logger.debug("Database client removed from pool");
});

export const database = drizzle(connection, {
  casing: "snake_case",
  schema,
});

export const migrateSchema = async (
  db: NodePgDatabase<Record<string, unknown>>
) => await migrate(db, { migrationsFolder: "drizzle" });
