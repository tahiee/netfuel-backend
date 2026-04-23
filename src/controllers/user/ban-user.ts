import { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import type { BanUserBody } from "@/validations/user.validation";
import { toFrontendUser } from "./_helpers";

// POST /api/users/:id/ban
export const banUser = async (req: Request, res: Response) => {
  const id = req.params.id;
  const { reason } = (req.body ?? {}) as BanUserBody;

  try {
    if (req.user?.id === id) {
      res.status(400).json({ error: "You cannot ban your own account" });
      return;
    }

    const [existing] = await database
      .select({ id: users.id, isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (existing.isSuperAdmin) {
      res.status(403).json({ error: "Super admin cannot be banned" });
      return;
    }

    const [updated] = await database
      .update(users)
      .set({ banned: true, banReason: reason ?? null })
      .where(eq(users.id, id))
      .returning();

    logger.info(
      `User banned by admin ${req.user?.id}: ${id} (${reason ?? "no reason"})`
    );
    res.json({ user: toFrontendUser(updated) });
  } catch (err) {
    logger.error("banUser failed:", err);
    res.status(500).json({ error: "Failed to ban user" });
  }
};
