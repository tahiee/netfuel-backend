import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { getSession } from "@/utils/getsession.util";
import { database } from "@/configs/connection.config";
import { users } from "@/schema/auth-schema";
import { logger } from "@/utils/logger.util";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null;
        role?: string | null;
        userRoles: string;
        isSuperAdmin: boolean;
        planSlug: string;
        brandCount: number;
        phone?: string | null;
        company?: string | null;
        jobTitle?: string | null;
        timezone: string;
        locale: string;
        banned: boolean;
        banReason?: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
      session?: any;
    }
  }
}

/**
 * Verifies a session cookie + hydrates `req.user` with fresh admin flags.
 *
 * IMPORTANT: better-auth's `session.user` payload doesn't reliably surface
 * custom `additionalFields` (userRoles, isSuperAdmin, planSlug, brandCount).
 * The session only carries what the admin plugin natively knows about. So we
 * do a single indexed lookup on `users.id` to ensure admin checks use the
 * authoritative DB values instead of whatever the cached session thinks.
 */
export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await getSession(req);

    if (!session?.user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "No valid session found",
      });
      return;
    }

    const u = session.user as any;

    const [dbUser] = await database
      .select({
        userRoles: users.userRoles,
        isSuperAdmin: users.isSuperAdmin,
        planSlug: users.planSlug,
        brandCount: users.brandCount,
        phone: users.phone,
        company: users.company,
        jobTitle: users.jobTitle,
        timezone: users.timezone,
        locale: users.locale,
        banned: users.banned,
        banReason: users.banReason,
        role: users.role,
        emailVerified: users.emailVerified,
        image: users.image,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, u.id))
      .limit(1);

    if (!dbUser) {
      // Session points at a user that no longer exists (deleted mid-session)
      res.status(401).json({
        error: "Unauthorized",
        message: "Session user no longer exists",
      });
      return;
    }

    if (dbUser.banned) {
      logger.warn(`Banned user attempted access: ${u.id}`);
      res.status(403).json({
        error: "Forbidden",
        message:
          "Your account has been suspended. Please contact support.",
        code: "ACCOUNT_BANNED",
      });
      return;
    }

    req.session = session;
    req.user = {
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: dbUser.emailVerified ?? false,
      image: dbUser.image ?? null,
      role: dbUser.role ?? "user",
      userRoles: dbUser.userRoles ?? "user",
      isSuperAdmin: dbUser.isSuperAdmin ?? false,
      planSlug: dbUser.planSlug ?? "free",
      brandCount: dbUser.brandCount ?? 0,
      phone: dbUser.phone ?? null,
      company: dbUser.company ?? null,
      jobTitle: dbUser.jobTitle ?? null,
      timezone: dbUser.timezone ?? "UTC",
      locale: dbUser.locale ?? "en",
      banned: dbUser.banned ?? false,
      banReason: dbUser.banReason ?? null,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    };

    if (process.env.NODE_ENV !== "production") {
      logger.debug(
        `Authenticated: ${req.user.id} (role=${req.user.role}, userRoles=${req.user.userRoles}, isSuperAdmin=${req.user.isSuperAdmin})`
      );
    }

    return next();
  } catch (error) {
    logger.error("Authentication error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Authentication failed",
    });
  }
};

/**
 * Normalizes a role value for admin comparisons — case-insensitive and
 * tolerant of "super admin" vs "superadmin" variants.
 */
const matchesAdminRole = (value: unknown): boolean => {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "admin" || v === "superadmin" || v === "super admin";
};

// Guard: admin or super admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", message: "No valid session found" });
    return;
  }

  const allowed =
    req.user.isSuperAdmin === true ||
    matchesAdminRole(req.user.role) ||
    matchesAdminRole(req.user.userRoles);

  if (!allowed) {
    res.status(403).json({ error: "Forbidden", message: "Admin access required" });
    return;
  }

  next();
};

// Guard: super admin only
export const isSuperAdminOnly = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.isSuperAdmin) {
    res
      .status(403)
      .json({ error: "Forbidden", message: "Super admin access required" });
    return;
  }
  next();
};

export const isUnAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const session = await getSession(req);

    if (!session) {
      return next();
    }

    res.status(400).json({
      error: "Bad Request",
      message: "User is already authenticated",
    });
  } catch (error) {
    logger.error("Unauthenticated check error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Authentication check failed",
    });
  }
};
