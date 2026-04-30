import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { database } from "@/configs/connection.config";
import { brandQueries } from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import type { CreateBrandQueryBody } from "@/validations/brandQuery.validation";
import { toFrontendBrandQuery, userCanAccessBrand } from "./_helpers";

// POST /api/queries
export const createBrandQuery = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = req.body as CreateBrandQueryBody;

  try {
    // Verify the user actually owns (or admins) this brand before attaching
    // a query to it. Otherwise anyone could spam queries onto someone else's
    // brand by guessing brandIds.
    const allowed = await userCanAccessBrand(req, body.brandId);
    if (!allowed) {
      res.status(403).json({ error: "You don't have access to that brand" });
      return;
    }

    const queryId = createId();

    await database.insert(brandQueries).values({
      id: queryId,
      brandId: body.brandId,
      prompt: body.prompt,
      context: body.context ?? null,
      frequency: body.frequency,
      targetModels: body.targetModels,
      isActive: body.isActive,
    });

    const [created] = await database
      .select()
      .from(brandQueries)
      .where(eq(brandQueries.id, queryId))
      .limit(1);

    logger.info(
      `Brand query created by ${req.user.id}: ${queryId} on brand ${body.brandId}`
    );
    res.status(201).json({ query: toFrontendBrandQuery(created) });
  } catch (err) {
    logger.error("createBrandQuery failed:", err);
    res.status(500).json({ error: "Failed to create query" });
  }
};
