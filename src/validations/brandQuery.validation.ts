import { z } from "zod";
import { ALLOWED_TARGET_MODELS } from "./brand.validation";

export const ALLOWED_FREQUENCIES = ["manual", "daily", "weekly"] as const;
export type QueryFrequency = (typeof ALLOWED_FREQUENCIES)[number];

// ── Request schemas ──────────────────────────────────────────────────────────

export const createBrandQueryBodySchema = z.object({
  brandId: z.string().min(1, "brandId is required"),
  prompt: z
    .string()
    .trim()
    .min(5, "Prompt must be at least 5 characters")
    .max(2000, "Prompt is too long (max 2000 characters)"),
  context: z.string().trim().max(2000).optional().nullable(),
  frequency: z.enum(ALLOWED_FREQUENCIES).default("manual"),
  targetModels: z
    .array(z.enum(ALLOWED_TARGET_MODELS))
    .min(1, "Select at least one AI model to target")
    .max(20),
  isActive: z.boolean().default(true),
});

export const updateBrandQueryBodySchema = z
  .object({
    prompt: z.string().trim().min(5).max(2000),
    context: z.string().trim().max(2000).nullable(),
    frequency: z.enum(ALLOWED_FREQUENCIES),
    targetModels: z.array(z.enum(ALLOWED_TARGET_MODELS)).min(1).max(20),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const listBrandQueriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  /** Filter by a specific brand. If omitted, returns queries across all brands the user has access to. */
  brandId: z.string().optional(),
  search: z.string().trim().optional(),
  status: z.enum(["active", "paused", "all"]).default("all"),
  frequency: z.enum([...ALLOWED_FREQUENCIES, "all"]).default("all"),
  sort: z.enum(["createdAt", "lastRunAt", "totalRuns"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// ── Inferred types ───────────────────────────────────────────────────────────

export type CreateBrandQueryBody = z.infer<typeof createBrandQueryBodySchema>;
export type UpdateBrandQueryBody = z.infer<typeof updateBrandQueryBodySchema>;
export type ListBrandQueriesQuery = z.infer<typeof listBrandQueriesQuerySchema>;
