import { Request, Response, NextFunction } from "express";
import { getSession } from "@/utils/getsession.util";
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

    // Reject banned users on every request (session may predate the ban)
    if (u.banned) {
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
      emailVerified: u.emailVerified ?? false,
      image: u.image ?? null,
      role: u.role ?? "user",
      userRoles: u.userRoles ?? "user",
      isSuperAdmin: u.isSuperAdmin ?? false,
      planSlug: u.planSlug ?? "free",
      brandCount: u.brandCount ?? 0,
      phone: u.phone ?? null,
      company: u.company ?? null,
      jobTitle: u.jobTitle ?? null,
      timezone: u.timezone ?? "UTC",
      locale: u.locale ?? "en",
      banned: u.banned ?? false,
      banReason: u.banReason ?? null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };

    if (process.env.NODE_ENV !== "production") {
      logger.debug(`Authenticated: ${req.user.id} (${req.user.userRoles})`);
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

// Guard: admin or super admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized", message: "No valid session found" });
    return;
  }
  if (!req.user.isSuperAdmin && req.user.userRoles !== "admin") {
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
