import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import { toFrontendBrandQuery } from "./_helpers";

// GET /api/queries/:id
export const getBrandQueryById = async (req: Request, res: Response) => {
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

    const [row] = await database
      .select({
        query: brandQueries,
        brand: { id: brands.id, name: brands.name, slug: brands.slug },
      })
      .from(brandQueries)
      .innerJoin(brands, eq(brandQueries.brandId, brands.id))
      .where(where)
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Query not found" });
      return;
    }

    res.json({ query: toFrontendBrandQuery(row.query, row.brand) });
  } catch (err) {
    logger.error("getBrandQueryById failed:", err);
    res.status(500).json({ error: "Failed to fetch query" });
  }
};
