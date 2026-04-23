import { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";

// DELETE /api/users/:id
export const deleteUser = async (req: Request, res: Response) => {
  const id = req.params.id;

  try {
    if (req.user?.id === id) {
      res.status(400).json({
        error: "You cannot delete your own account from this endpoint",
      });
      return;
    }

    const [existing] = await database
      .select({
        id: users.id,
        isSuperAdmin: users.isSuperAdmin,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (existing.isSuperAdmin) {
      res.status(403).json({ error: "Super admin account cannot be deleted" });
      return;
    }

    await database.delete(users).where(eq(users.id, id));
    // FK cascade cleans up session, account, brands, apiKeys, activityLogs, etc.

    logger.info(
      `User deleted by admin ${req.user?.id}: ${id} (${existing.email})`
    );
    res.status(204).send();
  } catch (err) {
    logger.error("deleteUser failed:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
};
