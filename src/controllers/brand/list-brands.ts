import { Request, Response } from "express";
import { and, asc, desc, eq, ilike, or, sql, SQL } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brands } from "@/schema/schema";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import type { ListBrandsQuery } from "@/validations/brand.validation";
import { toFrontendBrand } from "./_helpers";

// GET /api/brands
export const listBrands = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const q = req.query as unknown as ListBrandsQuery;

  // Only admins/super-admins may use scope=all (cross-user visibility).
  // Regular users are silently downgraded to scope=mine.
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";
  const scope = q.scope === "all" && isAdmin ? "all" : "mine";

  try {
    const filters: SQL[] = [];

    if (scope === "mine") {
      filters.push(eq(brands.userId, req.user.id));
    }
    if (q.search) {
      filters.push(
        or(
          ilike(brands.name, `%${q.search}%`),
          ilike(brands.slug, `%${q.search}%`),
          ilike(brands.website, `%${q.search}%`)
        )!
      );
    }
    if (q.status !== "all") {
      filters.push(eq(brands.isActive, q.status === "active"));
    }

    const where = filters.length ? and(...filters) : undefined;

    const sortCol =
      q.sort === "name"
        ? brands.name
        : q.sort === "latestScore"
          ? brands.latestScore
          : brands.createdAt;
    const orderBy = q.order === "asc" ? asc(sortCol) : desc(sortCol);
    const offset = (q.page - 1) * q.limit;

    if (scope === "all") {
      // Admin view — JOIN users for owner column. Counted with subquery.
      const [rows, [{ count }]] = await Promise.all([
        database
          .select({
            brand: brands,
            owner: {
              id: users.id,
              name: users.name,
              email: users.email,
              planSlug: users.planSlug,
            },
          })
          .from(brands)
          .leftJoin(users, eq(brands.userId, users.id))
          .where(where)
          .orderBy(orderBy)
          .limit(q.limit)
          .offset(offset),
        database
          .select({ count: sql<number>`count(*)::int` })
          .from(brands)
          .where(where),
      ]);

      res.json({
        data: rows.map((r) => toFrontendBrand(r.brand, r.owner)),
        pagination: {
          page: q.page,
          limit: q.limit,
          total: count,
          totalPages: Math.max(1, Math.ceil(count / q.limit)),
        },
      });
      return;
    }

    // Regular user — own brands only, no JOIN
    const [rows, [{ count }]] = await Promise.all([
      database
        .select()
        .from(brands)
        .where(where)
        .orderBy(orderBy)
        .limit(q.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(brands)
        .where(where),
    ]);

    res.json({
      data: rows.map((b) => toFrontendBrand(b)),
      pagination: {
        page: q.page,
        limit: q.limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / q.limit)),
      },
    });
  } catch (err) {
    logger.error("listBrands failed:", err);
    res.status(500).json({ error: "Failed to list brands" });
  }
};
