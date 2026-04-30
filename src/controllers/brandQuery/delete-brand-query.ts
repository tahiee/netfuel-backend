import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";

// DELETE /api/queries/:id
export const deleteBrandQuery = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    const where = isAdmin
      ? eq(brandQueries.id, id)
      : and(eq(brandQueries.id, id), eq(brands.userId, req.user.id));

    const [existing] = await database
      .select({ id: brandQueries.id })
      .from(brandQueries)
      .innerJoin(brands, eq(brandQueries.brandId, brands.id))
      .where(where)
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Query not found" });
      return;
    }

    await database.delete(brandQueries).where(eq(brandQueries.id, id));
    // Cascade deletes (aiQueryRuns) handled by FK constraint in schema.

    logger.info(`Brand query deleted by ${req.user.id}: ${id}`);
    res.status(204).send();
  } catch (err) {
    logger.error("deleteBrandQuery failed:", err);
    res.status(500).json({ error: "Failed to delete query" });
  }
};
