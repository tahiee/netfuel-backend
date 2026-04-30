import { Request, Response } from "express";
import { and, asc, desc, eq, ilike, sql, SQL } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import type { ListBrandQueriesQuery } from "@/validations/brandQuery.validation";
import { toFrontendBrandQuery } from "./_helpers";

// GET /api/queries
export const listBrandQueries = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const q = req.query as unknown as ListBrandQueriesQuery;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    const filters: SQL[] = [];

    if (q.brandId) {
      filters.push(eq(brandQueries.brandId, q.brandId));
    }
    if (q.search) {
      filters.push(ilike(brandQueries.prompt, `%${q.search}%`));
    }
    if (q.status !== "all") {
      filters.push(eq(brandQueries.isActive, q.status === "active"));
    }
    if (q.frequency !== "all") {
      filters.push(eq(brandQueries.frequency, q.frequency));
    }

    // Non-admins can only see queries on brands they own. Enforced via
    // sub-query so a single SQL trip stays efficient.
    if (!isAdmin) {
      filters.push(eq(brands.userId, req.user.id));
    }

    const where = filters.length ? and(...filters) : undefined;

    const sortCol =
      q.sort === "lastRunAt"
        ? brandQueries.lastRunAt
        : q.sort === "totalRuns"
          ? brandQueries.totalRuns
          : brandQueries.createdAt;
    const orderBy = q.order === "asc" ? asc(sortCol) : desc(sortCol);
    const offset = (q.page - 1) * q.limit;

    const [rows, [{ count }]] = await Promise.all([
      database
        .select({
          query: brandQueries,
          brand: { id: brands.id, name: brands.name, slug: brands.slug },
        })
        .from(brandQueries)
        .innerJoin(brands, eq(brandQueries.brandId, brands.id))
        .where(where)
        .orderBy(orderBy)
        .limit(q.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(brandQueries)
        .innerJoin(brands, eq(brandQueries.brandId, brands.id))
        .where(where),
    ]);

    res.json({
      data: rows.map((r) => toFrontendBrandQuery(r.query, r.brand)),
      pagination: {
        page: q.page,
        limit: q.limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / q.limit)),
      },
    });
  } catch (err) {
    logger.error("listBrandQueries failed:", err);
    res.status(500).json({ error: "Failed to list queries" });
  }
};
