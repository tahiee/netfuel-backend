import { z } from "zod";

// ── Constants (reusable by frontend types too) ───────────────────────────────

export const ALLOWED_PLANS = ["free", "pro", "agency", "custom"] as const;
export const ALLOWED_ROLES = ["user", "admin"] as const;

export type PlanSlug = (typeof ALLOWED_PLANS)[number];
export type UserRole = (typeof ALLOWED_ROLES)[number];

// ── Request schemas ──────────────────────────────────────────────────────────

export const createUserBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  plan: z.enum(ALLOWED_PLANS).default("free"),
  role: z.enum(ALLOWED_ROLES).default("user"),
  phone: z.string().trim().max(32).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(12).optional(),
  password: z.string().min(8).max(72).optional(), // auto-generated if omitted
  sendInvitation: z.boolean().default(true),
});

export const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email(),
    plan: z.enum(ALLOWED_PLANS),
    role: z.enum(ALLOWED_ROLES),
    phone: z.string().trim().max(32).nullable(),
    company: z.string().trim().max(160).nullable(),
    jobTitle: z.string().trim().max(120).nullable(),
    timezone: z.string().trim().max(64),
    locale: z.string().trim().max(12),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().optional(),
  plan: z.enum([...ALLOWED_PLANS, "all"]).default("all"),
  role: z.enum([...ALLOWED_ROLES, "all"]).default("all"),
  status: z.enum(["active", "suspended", "all"]).default("all"),
  sort: z.enum(["createdAt", "name", "email"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const banUserBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// ── Inferred types ───────────────────────────────────────────────────────────

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type BanUserBody = z.infer<typeof banUserBodySchema>;
