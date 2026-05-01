import { z } from "zod";
import { ALLOWED_TARGET_MODELS } from "./brand.validation";

export const ALLOWED_RUN_STATUSES = [
  "success",
  "cached",
  "error",
  "timeout",
] as const;

export const ALLOWED_SENTIMENTS = [
  "positive",
  "neutral",
  "negative",
] as const;

export const listAIRunsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  /** Filter to runs for a single brand. */
  brandId: z.string().optional(),
  /** Filter to runs for a single query (prompt). */
  queryId: z.string().optional(),
  /** Filter to a specific AI model. */
  model: z.enum(ALLOWED_TARGET_MODELS).optional(),
  /** Filter by run status. */
  status: z.enum([...ALLOWED_RUN_STATUSES, "all"]).default("all"),
  /** Filter to mentioned-only runs. */
  mentioned: z.enum(["true", "false", "all"]).default("all"),
  /** Filter by sentiment label. */
  sentiment: z.enum([...ALLOWED_SENTIMENTS, "all"]).default("all"),
  sort: z.enum(["createdAt", "visibilityScore", "durationMs"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export type ListAIRunsQuery = z.infer<typeof listAIRunsQuerySchema>;
