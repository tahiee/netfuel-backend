import { logger } from "./logger.util";
import { config } from "dotenv";
import { z } from "zod";

config();

const schemaObject = z.object({
  PORT: z.string().optional(),
  SKIP_DATABASE: z.string().optional(),
  FRONTEND_DOMAIN: z.string().default("http://localhost:3000"),
  BACKEND_DOMAIN: z.string().default("http://localhost:4000"),
  CONNECTION_URL: z.string().optional(),
  DATABASE_NAME: z.string().optional(),
  COOKIE_SECRET: z
    .string()
    .min(32)
    .default("change-me-in-production-use-at-least-32-random-chars"),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_SENDER: z.string().email().default("noreply@netfuel.ai"),

  // AI provider API keys — server-side credentials used by the query executor.
  // Each is optional: if missing, the relevant provider is skipped at runtime
  // with a "provider not configured" status instead of crashing the request.
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),     // Grok
  GROQ_API_KEY: z.string().optional(),    // Llama via Groq
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
