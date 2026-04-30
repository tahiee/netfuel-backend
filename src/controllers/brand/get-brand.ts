import { Request, Response } from "express";
import { and, eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { brands } from "@/schema/schema";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import { toFrontendBrand } from "./_helpers";

// GET /api/brands/:id
export const getBrandById = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.params.id;
  const isAdmin =
    req.user.isSuperAdmin === true || req.user.userRoles === "admin";

  try {
    // Admins can read any brand; regular users only their own.
    const where = isAdmin
      ? eq(brands.id, id)
      : and(eq(brands.id, id), eq(brands.userId, req.user.id));

    const [row] = await database
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
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Brand not found" });
      return;
    }

    res.json({
      brand: toFrontendBrand(row.brand, isAdmin ? row.owner : null),
    });
  } catch (err) {
    logger.error("getBrandById failed:", err);
    res.status(500).json({ error: "Failed to fetch brand" });
  }
};
