import { logger } from "./logger.util";
import { config } from "dotenv";
import { z } from "zod";

config();

const schemaObject = z.object({
  PORT: z.string().optional(),
  SKIP_DATABASE: z.string().optional(),
  FRONTEND_DOMAIN: z.string().default("http://localhost:3000"),
  CONNECTION_URL: z.string().optional(),
  DATABASE_NAME: z.string().optional(),
});

const envSchema = schemaObject.safeParse(process.env);

if (!envSchema.success) {
  const message = `Invalid environment variables: ${JSON.stringify(
    envSchema.error.format(),
    null,
    2,
  )}`;
  logger.error(message);
  throw new Error(message);
}

const data = envSchema.data;
const skipDatabase = data.SKIP_DATABASE === "true";

if (!skipDatabase) {
  if (!data.CONNECTION_URL?.trim() || !data.DATABASE_NAME?.trim()) {
    const msg =
      "CONNECTION_URL and DATABASE_NAME are required unless SKIP_DATABASE=true";
    logger.error(msg);
    throw new Error(msg);
  }
}

export const env = {
  ...data,
  CONNECTION_URL: skipDatabase
    ? "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
    : data.CONNECTION_URL!.trim(),
  DATABASE_NAME: skipDatabase ? "postgres" : data.DATABASE_NAME!.trim(),
  skipDatabase,
};
