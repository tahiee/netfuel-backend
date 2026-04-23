import { users } from "@/schema/auth-schema";

/**
 * Map a Drizzle user row to the shape the admin frontend expects.
 * Keeps controllers free of field-mapping boilerplate.
 */
export const toFrontendUser = (u: typeof users.$inferSelect) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  plan: u.planSlug,
  role: u.userRoles,
  status: u.banned ? "suspended" : "active",
  emailVerified: u.emailVerified,
  isSuperAdmin: u.isSuperAdmin,
  phone: u.phone,
  company: u.company,
  jobTitle: u.jobTitle,
  timezone: u.timezone,
  locale: u.locale,
  brands: u.brandCount,
  joined: u.createdAt.toISOString().split("T")[0],
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
  banned: u.banned,
  banReason: u.banReason,
});

/**
 * URL-safe random password (no ambiguous chars like 0/O, 1/l/I).
 * Used when an admin creates a user without specifying a password.
 */
export const generateTempPassword = (length = 12): string => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};
