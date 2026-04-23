import { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import { toFrontendUser } from "./_helpers";

// GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
  try {
    const [row] = await database
      .select()
      .from(users)
      .where(eq(users.id, req.params.id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: toFrontendUser(row) });
  } catch (err) {
    logger.error("getUserById failed:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};
