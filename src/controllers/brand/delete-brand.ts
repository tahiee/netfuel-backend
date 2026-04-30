import { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brands } from "@/schema/schema";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";

// DELETE /api/brands/:id
export const deleteBrand = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    const ownerWhere = isAdmin
      ? eq(brands.id, id)
      : and(eq(brands.id, id), eq(brands.userId, req.user.id));

    const [existing] = await database
      .select({ id: brands.id, userId: brands.userId, name: brands.name })
      .from(brands)
      .where(ownerWhere)
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    await database.transaction(async (tx) => {
      await tx.delete(brands).where(eq(brands.id, id));
      // Decrement the cached brandCount on the owning user — clamped at 0
      // so the counter never goes negative if rows are out of sync.
      await tx
        .update(users)
        .set({
          brandCount: sql`GREATEST(${users.brandCount} - 1, 0)`,
        })
        .where(eq(users.id, existing.userId));
    });

    // Cascade deletes (brandQueries → aiQueryRuns, redditMonitors, etc.)
    // are handled by FK `onDelete: cascade` constraints in the schema.

    logger.info(
      `Brand deleted by ${req.user.id}: ${id} (${existing.name})`
    );
    res.status(204).send();
  } catch (err) {
    logger.error("deleteBrand failed:", err);
    res.status(500).json({ error: "Failed to delete brand" });
  }
};
