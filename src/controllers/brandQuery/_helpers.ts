import { and, eq } from "drizzle-orm";
import type { Request } from "express";

import { database } from "@/configs/connection.config";
import { brandQueries, brands } from "@/schema/schema";

type BrandQueryRow = typeof brandQueries.$inferSelect;
type BrandRow = typeof brands.$inferSelect;

/**
 * Frontend-friendly shape — keeps in sync with `dev/src/types/brandQuery.types.ts`.
 * `brand` field is optional (only included on aggregate `?brandId omitted` lists
 * where we join the brand for context).
 */
export const toFrontendBrandQuery = (
  q: BrandQueryRow,
  brand?: Pick<BrandRow, "id" | "name" | "slug"> | null
) => ({
  id: q.id,
  brandId: q.brandId,
  prompt: q.prompt,
  context: q.context,
  frequency: q.frequency,
  targetModels: q.targetModels ?? [],
  isActive: q.isActive,
  status: q.isActive ? "active" : "paused",
  lastRunAt: q.lastRunAt,
  nextRunAt: q.nextRunAt,
  totalRuns: q.totalRuns,
  createdAt: q.createdAt,
  updatedAt: q.updatedAt,
  brand: brand
    ? { id: brand.id, name: brand.name, slug: brand.slug }
    : undefined,
});

/**
 * Returns true if `req.user` is allowed to operate on the given brand.
 * Admins can act on any brand; regular users only on brands they own.
 */
export async function userCanAccessBrand(
  req: Request,
  brandId: string
): Promise<boolean> {
  if (!req.user) return false;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  const where = isAdmin
    ? eq(brands.id, brandId)
    : and(eq(brands.id, brandId), eq(brands.userId, req.user.id));

  const [row] = await database
    .select({ id: brands.id })
    .from(brands)
    .where(where)
    .limit(1);

  return Boolean(row);
}
