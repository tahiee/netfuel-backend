import { z } from "zod";

// ── Constants ────────────────────────────────────────────────────────────────

export const ALLOWED_TARGET_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-pro",
  "gemini-flash",
  "claude-3-5-sonnet",
  "claude-3-haiku",
  "perplexity-sonar",
  "perplexity-sonar-pro",
  "grok-2",
  "llama-3",
] as const;

export type TargetModel = (typeof ALLOWED_TARGET_MODELS)[number];

// `slug` rule: lowercase, digits, hyphens only — collisions are scoped per-user
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/i, {
    message: "Slug may only contain letters, numbers, and hyphens",
  })
  .transform((v) => v.toLowerCase());

/**
 * Lenient website URL: accepts both full URLs ("https://x.com") and bare
 * domains ("x.com"). Strict `z.string().url()` rejects bare domains and is
 * a frequent source of "Validation failed" surprises when an admin types a
 * domain without protocol.
 */
const urlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) => {
      if (!v) return true;
      try {
        new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Must be a valid URL or domain (e.g. example.com)" }
  )
  .transform((v) => {
    if (!v) return v;
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  });

// ── Request schemas ──────────────────────────────────────────────────────────

export const createBrandBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: slugSchema.optional(), // auto-generated from name if omitted
  website: urlSchema.optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  industry: z.string().trim().max(80).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  logoUrl: urlSchema.optional().nullable(),
  keywords: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  competitors: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  targetModels: z.array(z.enum(ALLOWED_TARGET_MODELS)).max(20).default([]),
  isActive: z.boolean().default(true),
});

export const updateBrandBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema,
    website: urlSchema.nullable(),
    description: z.string().trim().max(2000).nullable(),
    industry: z.string().trim().max(80).nullable(),
    country: z.string().trim().max(80).nullable(),
    logoUrl: urlSchema.nullable(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(50),
    competitors: z.array(z.string().trim().min(1).max(120)).max(50),
    targetModels: z.array(z.enum(ALLOWED_TARGET_MODELS)).max(20),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const listBrandsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().optional(),
  status: z.enum(["active", "paused", "all"]).default("all"),
  /**
   * scope=mine  → only the caller's own brands (default for regular users)
   * scope=all   → every brand in the system + owner info (admins only;
   *               middleware enforces the role check)
   */
  scope: z.enum(["mine", "all"]).default("mine"),
  sort: z.enum(["createdAt", "name", "latestScore"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// ── Inferred types ───────────────────────────────────────────────────────────

export type CreateBrandBody = z.infer<typeof createBrandBodySchema>;
export type UpdateBrandBody = z.infer<typeof updateBrandBodySchema>;
export type ListBrandsQuery = z.infer<typeof listBrandsQuerySchema>;
