import { Request, Response } from "express";
import { and, asc, desc, eq, sql, SQL } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { aiQueryRuns, brandQueries, brands } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import type { ListAIRunsQuery } from "@/validations/aiRun.validation";
import { toFrontendRun } from "./_helpers";

// GET /api/runs
export const listAIRuns = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const q = req.query as unknown as ListAIRunsQuery;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    const filters: SQL[] = [];

    // Owner scope — non-admins only see their own runs
    if (!isAdmin) {
      filters.push(eq(aiQueryRuns.userId, req.user.id));
    }
    if (q.brandId) filters.push(eq(aiQueryRuns.brandId, q.brandId));
    if (q.queryId) filters.push(eq(aiQueryRuns.queryId, q.queryId));
    if (q.model) filters.push(eq(aiQueryRuns.model, q.model));
    if (q.status !== "all") filters.push(eq(aiQueryRuns.status, q.status));
    if (q.mentioned !== "all") {
      filters.push(eq(aiQueryRuns.mentioned, q.mentioned === "true"));
    }
    if (q.sentiment !== "all") {
      filters.push(eq(aiQueryRuns.sentiment, q.sentiment));
    }

    const where = filters.length ? and(...filters) : undefined;

    const sortCol =
      q.sort === "visibilityScore"
        ? aiQueryRuns.visibilityScore
        : q.sort === "durationMs"
          ? aiQueryRuns.durationMs
          : aiQueryRuns.createdAt;
    const orderBy = q.order === "asc" ? asc(sortCol) : desc(sortCol);

    const offset = (q.page - 1) * q.limit;

    // JOIN with query + brand so the row is self-describing on the frontend
    // (no need for a second fetch to show "which prompt was this?")
    const [rows, [{ count }]] = await Promise.all([
      database
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
        .orderBy(orderBy)
        .limit(q.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(aiQueryRuns)
        .where(where),
    ]);

    res.json({
      data: rows.map((r) => toFrontendRun(r.run, r.query, r.brand)),
      pagination: {
        page: q.page,
        limit: q.limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / q.limit)),
      },
    });
  } catch (err) {
    logger.error("listAIRuns failed:", err);
    res.status(500).json({ error: "Failed to list runs" });
  }
};
