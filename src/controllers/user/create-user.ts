import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { database } from "@/configs/connection.config";
import { users, account } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";
import { sendEmail, invitationTemplate } from "@/utils/email.util";
import { hashPassword } from "@/utils/password.util";
import { env } from "@/utils/env.util";
import type { CreateUserBody } from "@/validations/user.validation";
import { toFrontendUser, generateTempPassword } from "./_helpers";

// POST /api/users
export const createUser = async (req: Request, res: Response) => {
  const body = req.body as CreateUserBody;

  try {
    const existing = await database.query.users.findFirst({
      where: eq(users.email, body.email),
      columns: { id: true },
    });

    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const plainPassword = body.password ?? generateTempPassword();
    // better-auth uses its own hasher (scrypt) — bcrypt here would make
    // subsequent sign-in calls fail with "Invalid password hash".
    const hashed = await hashPassword(plainPassword);
    const userId = createId();
    const accountId = createId();

    await database.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        name: body.name,
        email: body.email,
        emailVerified: true, // admin-created → pre-verified
        userRoles: body.role,
        role: body.role === "admin" ? "admin" : "user", // better-auth core role
        planSlug: body.plan,
        phone: body.phone ?? null,
        company: body.company ?? null,
        jobTitle: body.jobTitle ?? null,
        timezone: body.timezone ?? "UTC",
        locale: body.locale ?? "en",
        isSuperAdmin: false,
        brandCount: 0,
        banned: false,
      });

      await tx.insert(account).values({
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId,
        password: hashed,
      });
    });

    if (body.sendInvitation) {
      try {
        await sendEmail({
          to: { email: body.email, name: body.name },
          subject: "You've been invited to Netfuel",
          htmlContent: invitationTemplate({
            name: body.name,
            url: env.FRONTEND_DOMAIN,
            email: body.email,
            password: plainPassword,
          }),
        });
      } catch (err) {
        // Non-fatal — user is created, log & continue
        logger.warn(
          `User created but invitation email failed for ${body.email}:`,
          err
        );
      }
    }

    const [created] = await database
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    logger.info(
      `User created by admin ${req.user?.id}: ${userId} (${body.email})`
    );

    res.status(201).json({
      user: toFrontendUser(created),
      // Return temp password ONLY when admin opted out of sending invitation
      tempPassword: body.sendInvitation ? undefined : plainPassword,
    });
  } catch (err) {
    logger.error("createUser failed:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
};
