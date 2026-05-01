import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { aiQueryRuns, brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import { toFrontendRun } from "./_helpers";

// GET /api/runs/:id
export const getAIRunById = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    const where = isAdmin
      ? eq(aiQueryRuns.id, id)
      : and(eq(aiQueryRuns.id, id), eq(aiQueryRuns.userId, req.user.id));

    const [row] = await database
      .select({
        run: aiQueryRuns,
        query: {
          id: brandQueries.id,
          prompt: brandQueries.prompt,
          frequency: brandQueries.frequency,
        },
        brand: {
          id: brands.id,
          name: brands.name,
          slug: brands.slug,
        },
      })
      .from(aiQueryRuns)
      .innerJoin(brandQueries, eq(aiQueryRuns.queryId, brandQueries.id))
      .innerJoin(brands, eq(aiQueryRuns.brandId, brands.id))
      .where(where)
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.json({ run: toFrontendRun(row.run, row.query, row.brand) });
  } catch (err) {
    logger.error("getAIRunById failed:", err);
    res.status(500).json({ error: "Failed to fetch run" });
  }
};
