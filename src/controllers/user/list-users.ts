import { Request, Response } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import type { ListUsersQuery } from "@/validations/user.validation";
import { toFrontendUser } from "./_helpers";

// GET /api/users
export const listUsers = async (req: Request, res: Response) => {
  const q = req.query as unknown as ListUsersQuery;

  try {
    const filters = [];

    if (q.search) {
      filters.push(
        or(
          ilike(users.name, `%${q.search}%`),
          ilike(users.email, `%${q.search}%`)
        )
      );
    }
    if (q.plan !== "all") filters.push(eq(users.planSlug, q.plan));
    if (q.role !== "all") filters.push(eq(users.userRoles, q.role));
    if (q.status !== "all") {
      filters.push(eq(users.banned, q.status === "suspended"));
    }

    const where = filters.length ? and(...filters) : undefined;

    const sortCol =
      q.sort === "name"
        ? users.name
        : q.sort === "email"
          ? users.email
          : users.createdAt;
    const orderBy = q.order === "asc" ? asc(sortCol) : desc(sortCol);

    const offset = (q.page - 1) * q.limit;

    const [rows, [{ count }]] = await Promise.all([
      database
        .select()
        .from(users)
        .where(where)
        .orderBy(orderBy)
        .limit(q.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(where),
    ]);

    res.json({
      data: rows.map(toFrontendUser),
      pagination: {
        page: q.page,
        limit: q.limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / q.limit)),
      },
    });
  } catch (err) {
    logger.error("listUsers failed:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
};
