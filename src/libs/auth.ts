import {
  forgotPasswordTemplate,
  invitationTemplate,
  otpTemplate,
  sendEmail,
  signupTemplate,
} from "@/utils/email.util";
import { env } from "@/utils/env.util";
import { logger } from "@/utils/logger.util";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  admin as adminPlugin,
  emailOTP,
  twoFactor,
} from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { database } from "../configs/connection.config";
import * as schema from "../schema/schema";
import { ac, roles } from "./permission";

const isProduction = process.env.NODE_ENV === "production";

const OTP_LENGTH = 6;
const OTP_EXPIRES_IN_SECONDS = 60 * 30; // 30 minutes
const OTP_ALLOWED_ATTEMPTS = 5;

type UserAuthSnapshot = {
  id: string;
  isSuperAdmin: boolean | null;
  banned: boolean | null;
  twoFactorEnabled: boolean | null;
};

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

const getBaseURL = () => {
  const domain = env.BACKEND_DOMAIN.trim();
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    return normalizeUrl(domain);
  }
  return normalizeUrl(isProduction ? `https://${domain}` : `http://${domain}`);
};

const trustedOrigins = (() => {
  const frontend = normalizeUrl(env.FRONTEND_DOMAIN);
  return Array.from(
    new Set([
      frontend,
      `${frontend}/`,
      "http://localhost:3000",
      "https://localhost:3000",
    ])
  );
})();

const getDisplayNameFromEmail = (email: string) => {
  const atIndex = email.lastIndexOf("@");
  return atIndex > 0 ? email.substring(0, atIndex) : email;
};

const getUserAuthSnapshotByEmail = async (
  email: string
): Promise<UserAuthSnapshot | undefined> => {
  const [user] = await database
    .select({
      id: schema.users.id,
      isSuperAdmin: schema.users.isSuperAdmin,
      banned: schema.users.banned,
      twoFactorEnabled: schema.users.twoFactorEnabled,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  return user;
};

const shouldSkipOtpForSuperAdmin = (user?: UserAuthSnapshot) =>
  Boolean(user?.isSuperAdmin && !user?.twoFactorEnabled);

const sendInvitationOtpEmail = async ({
  email,
  otp,
  reqUrl,
}: {
  email: string;
  otp: string;
  reqUrl: URL;
}) => {
  const password = reqUrl.searchParams.get("password");
  if (!password) return false;

  const name = reqUrl.searchParams.get("name") ?? getDisplayNameFromEmail(email);
  const invitationUrl = `${env.FRONTEND_DOMAIN}?otp=${otp}&email=${encodeURIComponent(
    email
  )}`;

  await sendEmail({
    to: { email, name },
    subject: "You've been invited to Netfuel",
    htmlContent: invitationTemplate({
      name,
      url: invitationUrl,
      email,
      password,
    }),
  });

  return true;
};

const sendOtpByType = async ({
  type,
  email,
  otp,
  req,
  user,
}: {
  type: string;
  email: string;
  otp: string;
  req?: Request;
  user?: UserAuthSnapshot;
}) => {
  if (type === "sign-in") {
    if (shouldSkipOtpForSuperAdmin(user)) {
      logger.info(`Skipping sign-in OTP for super admin: ${email}`);
      return;
    }

    if (!user?.twoFactorEnabled) {
      logger.info(`Skipping sign-in OTP — 2FA not enabled: ${email}`);
      return;
    }

    await sendEmail({
      to: { email },
      subject: "Your Sign-In Verification Code — Netfuel",
      htmlContent: otpTemplate(
        otp,
        "Sign-In Verification",
        "Use this code to complete your sign-in."
      ),
    });
    return;
  }

  if (type === "email-verification" && req) {
    const reqUrl = new URL(req.url);
    const sentInvitationEmail = await sendInvitationOtpEmail({
      email,
      otp,
      reqUrl,
    });

    if (sentInvitationEmail) return;

    if (!user) {
      logger.warn(`User not found for email verification OTP: ${email}`);
      return;
    }

    const is2FASetup = !user.twoFactorEnabled;
    await sendEmail({
      to: { email },
      subject: is2FASetup
        ? "Your 2FA Setup Verification Code — Netfuel"
        : "Your 2FA Verification Code — Netfuel",
      htmlContent: otpTemplate(
        otp,
        "Two-Factor Authentication",
        is2FASetup
          ? "Use this code to enable 2FA on your account."
          : "Use this code to complete your sign-in."
      ),
    });
    return;
  }

  if (!user || shouldSkipOtpForSuperAdmin(user)) return;

  await sendEmail({
    to: { email },
    subject: "Your Verification Code — Netfuel",
    htmlContent: otpTemplate(
      otp,
      "Verification Code",
      "Use this code to verify your request."
    ),
  });
};

export const auth = betterAuth({
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Single-tenant guard: once a superadmin exists, further onboarding
      // should go through invitation/admin-managed flows.
      if (ctx.path === "/sign-up/email") {
        const [existingSuperAdmin] = await database
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.isSuperAdmin, true))
          .limit(1);

        if (existingSuperAdmin) {
          logger.info("Super admin exists; sign-up flow should be invite-led.");
        }
        return;
      }

      if (ctx.path === "/sign-in/email" && ctx.body?.email) {
        const email = String(ctx.body.email);
        const user = await getUserAuthSnapshotByEmail(email);

        if (user?.banned) {
          // APIError makes better-auth serialize this as a structured JSON
          // response with the correct status — raw `Error` becomes a 500.
          throw new APIError("FORBIDDEN", {
            message:
              "Your account has been suspended. Please contact support.",
            code: "ACCOUNT_BANNED",
          });
        }

        // Keep login smooth for first-time superadmin flow.
        if (!user || shouldSkipOtpForSuperAdmin(user)) {
          (ctx as { skipOTP?: boolean }).skipOTP = true;
        }
      }
    }),
  },

  baseURL: getBaseURL(),
  secret: env.COOKIE_SECRET,
  trustedOrigins,

  advanced: {
    useSecureCookies: isProduction,
    cookies: {
      session_token: {
        attributes: {
          sameSite: isProduction ? "none" : "lax",
          httpOnly: false,
          secure: isProduction,
        },
      },
    },
  },

  database: drizzleAdapter(database, { provider: "pg", schema }),

  plugins: [
    twoFactor({ issuer: "Netfuel" }),
    adminPlugin({
      defaultRole: "user",
      ac,
      adminRoles: ["superadmin"],
      roles,
    }),
    emailOTP({
      sendVerificationOTP: async ({ type, email, otp }) => {
        logger.info(`OTP request — type: ${type}, email: ${email}`);
        const user = await getUserAuthSnapshotByEmail(email);

        try {
          await sendOtpByType({ type, email, otp, user });
          logger.info(`OTP handled — type: ${type}, email: ${email}`);
        } catch (error) {
          logger.error(`Failed to process OTP for ${email}:`, error);
          throw error;
        }
      },
      otpLength: OTP_LENGTH,
      expiresIn: OTP_EXPIRES_IN_SECONDS,
      allowedAttempts: OTP_ALLOWED_ATTEMPTS,
    }),
  ],

  user: {
    modelName: "users",
    additionalFields: {
      userRoles: {
        fieldName: "user_roles",
        defaultValue: "user",
        required: false,
        type: "string",
      },
      isSuperAdmin: {
        fieldName: "is_super_admin",
        defaultValue: false,
        required: false,
        type: "boolean",
      },
      planSlug: {
        fieldName: "plan_slug",
        defaultValue: "free",
        required: false,
        type: "string",
      },
      brandCount: {
        fieldName: "brand_count",
        defaultValue: 0,
        required: false,
        type: "number",
      },
      phone: {
        fieldName: "phone",
        defaultValue: null,
        required: false,
        type: "string",
      },
      company: {
        fieldName: "company",
        defaultValue: null,
        required: false,
        type: "string",
      },
      jobTitle: {
        fieldName: "job_title",
        defaultValue: null,
        required: false,
        type: "string",
      },
      timezone: {
        fieldName: "timezone",
        defaultValue: "UTC",
        required: false,
        type: "string",
      },
      locale: {
        fieldName: "locale",
        defaultValue: "en",
        required: false,
        type: "string",
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async () => {
        // TODO: send verification email for email change
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async () => {
        // TODO: send delete account confirmation email
      },
      beforeDelete: async (ctx: { id: string }) => {
        logger.info(`Starting deletion process for user: ${ctx.id}`);
        // Cascade deletes (brands, apiKeys, activityLogs, etc.) are handled by FK constraints
      },
      afterDelete: async (ctx: { id: string }) => {
        logger.info(`User ${ctx.id} deleted successfully.`);
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
    includeFields: [
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "role",
      "userRoles",
      "isSuperAdmin",
      "planSlug",
      "brandCount",
      "phone",
      "company",
      "jobTitle",
      "timezone",
      "locale",
      "banned",
      "banReason",
      "banExpires",
      "createdAt",
      "updatedAt",
    ],
  },

  emailAndPassword: {
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: { email: user.email, name: user.name },
        subject: "Reset your Netfuel password",
        htmlContent: forgotPasswordTemplate({ user, url }),
      });
    },
    requireEmailVerification: false,
    minPasswordLength: 8,
    autoSignIn: true,
    enabled: true,
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: { email: user.email, name: user.name },
        subject: "Verify your email address — Netfuel",
        htmlContent: signupTemplate({ user, url }),
      });
    },
    autoSignInAfterVerification: true,
    sendOnSignUp: false,
  },
});
