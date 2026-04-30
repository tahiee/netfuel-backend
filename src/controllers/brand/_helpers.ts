import { brands } from "@/schema/schema";
import { users } from "@/schema/auth-schema";

type BrandRow = typeof brands.$inferSelect;
type UserRow = typeof users.$inferSelect;

/**
 * Frontend-friendly brand shape — flattens decimal scores to numbers,
 * merges optional owner info (admin "all brands" view), formats dates.
 *
 * Keep in sync with the AdminBrand / DashboardBrand types on the frontend.
 */
export const toFrontendBrand = (b: BrandRow, owner?: Pick<UserRow, "id" | "name" | "email" | "planSlug"> | null) => ({
  id: b.id,
  name: b.name,
  slug: b.slug,
  website: b.website,
  description: b.description,
  industry: b.industry,
  country: b.country,
  logoUrl: b.logoUrl,
  keywords: b.keywords ?? [],
  competitors: b.competitors ?? [],
  targetModels: b.targetModels ?? [],
  isActive: b.isActive,
  status: b.isActive ? "active" : "paused",
  // `latestScore` is decimal in DB → number for the UI; null when no runs yet
  avgScore: b.latestScore != null ? Number(b.latestScore) : null,
  totalQueriesRun: b.totalQueriesRun,
  userId: b.userId,
  // Owner info only included on admin "scope=all" views
  owner: owner
    ? {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        plan: owner.planSlug,
      }
    : undefined,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  lastScan: b.updatedAt.toISOString(),
});

/**
 * Slugify a brand name. Used when the caller doesn't provide an explicit slug.
 * Strips diacritics, lowercases, replaces non-alphanum with hyphens, trims hyphens.
 */
export const slugify = (input: string): string =>
  input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "brand";
