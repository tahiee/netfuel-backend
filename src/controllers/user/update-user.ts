import { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";

import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import type { UpdateUserBody } from "@/validations/user.validation";
import { toFrontendUser } from "./_helpers";

// PATCH /api/users/:id
export const updateUser = async (req: Request, res: Response) => {
  const id = req.params.id;
  const body = req.body as UpdateUserBody;

  try {
    const [existing] = await database
      .select({ id: users.id, isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Protect super admin from demotion via this endpoint
    if (existing.isSuperAdmin && body.role && body.role !== "admin") {
      res.status(403).json({
        error: "Forbidden",
        message: "Super admin role cannot be changed via this endpoint.",
      });
      return;
    }

    // Ensure new email is unique
    if (body.email) {
      const clash = await database.query.users.findFirst({
        where: and(eq(users.email, body.email), sql`${users.id} <> ${id}`),
        columns: { id: true },
      });
      if (clash) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.email !== undefined) patch.email = body.email;
    if (body.plan !== undefined) patch.planSlug = body.plan;
    if (body.role !== undefined) {
      patch.userRoles = body.role;
      patch.role = body.role === "admin" ? "admin" : "user";
    }
    if (body.phone !== undefined) patch.phone = body.phone;
    if (body.company !== undefined) patch.company = body.company;
    if (body.jobTitle !== undefined) patch.jobTitle = body.jobTitle;
    if (body.timezone !== undefined) patch.timezone = body.timezone;
    if (body.locale !== undefined) patch.locale = body.locale;

    const [updated] = await database
      .update(users)
      .set(patch)
      .where(eq(users.id, id))
      .returning();

    logger.info(`User updated by admin ${req.user?.id}: ${id}`);
    res.json({ user: toFrontendUser(updated) });
  } catch (err) {
    logger.error("updateUser failed:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
};
