import { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import type { UpdateBrandBody } from "@/validations/brand.validation";
import { toFrontendBrand } from "./_helpers";

// PATCH /api/brands/:id
export const updateBrand = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const body = req.body as UpdateBrandBody;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    // Admins can update any brand; regular users only their own.
    const ownerWhere = isAdmin
      ? eq(brands.id, id)
      : and(eq(brands.id, id), eq(brands.userId, req.user.id));

    const [existing] = await database
      .select({ id: brands.id, userId: brands.userId, currentSlug: brands.slug })
      .from(brands)
      .where(ownerWhere)
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    // If slug is changing, ensure no collision within the owner's namespace
    if (body.slug && body.slug !== existing.currentSlug) {
      const clash = await database.query.brands.findFirst({
        where: and(
          eq(brands.userId, existing.userId),
          eq(brands.slug, body.slug),
          sql`${brands.id} <> ${id}`
        ),
        columns: { id: true },
      });
      if (clash) {
        res.status(409).json({ error: "Slug already in use for this user" });
        return;
      }
    }

    const patch: Partial<typeof brands.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.slug !== undefined) patch.slug = body.slug;
    if (body.website !== undefined) patch.website = body.website;
    if (body.description !== undefined) patch.description = body.description;
    if (body.industry !== undefined) patch.industry = body.industry;
    if (body.country !== undefined) patch.country = body.country;
    if (body.logoUrl !== undefined) patch.logoUrl = body.logoUrl;
    if (body.keywords !== undefined) patch.keywords = body.keywords;
    if (body.competitors !== undefined) patch.competitors = body.competitors;
    if (body.targetModels !== undefined) patch.targetModels = body.targetModels;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    patch.updatedAt = new Date();

    const [updated] = await database
      .update(brands)
      .set(patch)
      .where(eq(brands.id, id))
      .returning();

    logger.info(`Brand updated by ${req.user.id}: ${id}`);
    res.json({ brand: toFrontendBrand(updated) });
  } catch (err) {
    logger.error("updateBrand failed:", err);
    res.status(500).json({ error: "Failed to update brand" });
  }
};
