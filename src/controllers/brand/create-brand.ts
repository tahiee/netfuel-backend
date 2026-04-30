import { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { database } from "@/configs/connection.config";
import { brands } from "@/schema/schema";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import type { CreateBrandBody } from "@/validations/brand.validation";
import { slugify, toFrontendBrand } from "./_helpers";

// POST /api/brands
export const createBrand = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as CreateBrandBody;

  try {
    // Auto-derive slug from name if caller didn't supply one. Resolve any
    // collision per-user by appending a numeric suffix (`-2`, `-3`, …).
    const baseSlug = body.slug ?? slugify(body.name);
    let slug = baseSlug;
    let suffix = 2;
    while (
      await database.query.brands.findFirst({
        where: and(eq(brands.userId, req.user.id), eq(brands.slug, slug)),
        columns: { id: true },
      })
    ) {
      slug = `${baseSlug}-${suffix++}`;
      if (suffix > 50) break; // safety cap
    }

    const brandId = createId();

    await database.transaction(async (tx) => {
      await tx.insert(brands).values({
        id: brandId,
        userId: req.user!.id,
        name: body.name,
        slug,
        website: body.website ?? null,
        description: body.description ?? null,
        industry: body.industry ?? null,
        country: body.country ?? null,
        logoUrl: body.logoUrl ?? null,
        keywords: body.keywords,
        competitors: body.competitors,
        targetModels: body.targetModels,
        isActive: body.isActive,
      });

      // Bump the cached `brandCount` on the user record. SQL-side increment
      // (not JS-side `(cached ?? 0) + 1`) avoids race conditions when the
      // same user creates multiple brands in parallel.
      await tx
        .update(users)
        .set({ brandCount: sql`${users.brandCount} + 1` })
        .where(eq(users.id, req.user!.id));
    });

    const [created] = await database
      .select()
      .from(brands)
      .where(eq(brands.id, brandId))
      .limit(1);

    logger.info(
      `Brand created by ${req.user.id}: ${brandId} (${body.name})`
    );
    res.status(201).json({ brand: toFrontendBrand(created) });
  } catch (err) {
    logger.error("createBrand failed:", err);
    res.status(500).json({ error: "Failed to create brand" });
  }
};
