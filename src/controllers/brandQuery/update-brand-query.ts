import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import type { UpdateBrandQueryBody } from "@/validations/brandQuery.validation";
import { toFrontendBrandQuery } from "./_helpers";

// PATCH /api/queries/:id
export const updateBrandQuery = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const body = req.body as UpdateBrandQueryBody;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    // Authorize via JOIN with brand so we don't trust the client to send brandId.
    const where = isAdmin
      ? eq(brandQueries.id, id)
      : and(eq(brandQueries.id, id), eq(brands.userId, req.user.id));

    const [existing] = await database
      .select({ query: brandQueries })
      .from(brandQueries)
      .innerJoin(brands, eq(brandQueries.brandId, brands.id))
      .where(where)
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Query not found" });
      return;
    }

    const patch: Partial<typeof brandQueries.$inferInsert> = {};
    if (body.prompt !== undefined) patch.prompt = body.prompt;
    if (body.context !== undefined) patch.context = body.context;
    if (body.frequency !== undefined) patch.frequency = body.frequency;
    if (body.targetModels !== undefined) patch.targetModels = body.targetModels;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    patch.updatedAt = new Date();

    const [updated] = await database
      .update(brandQueries)
      .set(patch)
      .where(eq(brandQueries.id, id))
      .returning();

    logger.info(`Brand query updated by ${req.user.id}: ${id}`);
    res.json({ query: toFrontendBrandQuery(updated) });
  } catch (err) {
    logger.error("updateBrandQuery failed:", err);
    res.status(500).json({ error: "Failed to update query" });
  }
};
