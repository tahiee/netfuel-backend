import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import { executeQuery } from "@/services/ai/query-executor";

// POST /api/queries/:id/run
export const runBrandQuery = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    // Authorize via JOIN with brand — same pattern as the other controllers.
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

    // Synchronous execution for v1 — calls each AI provider in parallel,
    // saves runs to ai_query_runs, updates aggregate scores, then returns.
    // For larger batches we'll move this to a background queue later.
    const result = await executeQuery(id);

    logger.info(
      `Query run by ${req.user.id}: ${id} → ${result.runs.length} model runs`
    );

    res.json(result);
  } catch (err) {
    logger.error("runBrandQuery failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to run query";
    res.status(500).json({ error: message });
  }
};
