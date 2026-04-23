import { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import { toFrontendUser } from "./_helpers";

// POST /api/users/:id/unban
export const unbanUser = async (req: Request, res: Response) => {
  const id = req.params.id;

  try {
    const [updated] = await database
      .update(users)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    logger.info(`User unbanned by admin ${req.user?.id}: ${id}`);
    res.json({ user: toFrontendUser(updated) });
  } catch (err) {
    logger.error("unbanUser failed:", err);
    res.status(500).json({ error: "Failed to unban user" });
  }
};
