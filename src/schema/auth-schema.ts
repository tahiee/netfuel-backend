import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

/**
 * better-auth core tables — extended with Netfuel app fields.
 * Do NOT add foreign keys here pointing to app tables (circular deps).
 * App-level relations live in schema.ts via userProfiles.
 */

export const users = pgTable("users", {
  // ── better-auth required ──────────────────────────────────────────────────
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),

  // ── better-auth plugins ───────────────────────────────────────────────────
  twoFactorEnabled: boolean("two_factor_enabled").default(false),

  // ── Netfuel: access control ───────────────────────────────────────────────
  // "user" | "admin" — checked in AdminLayout as user.userRoles !== "admin"
  userRoles: text("user_roles").default("user").notNull(),
  role: text("role").default("user"),           // kept for better-auth compat
  banned: boolean("banned").default(false).notNull(),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),

  // ── Netfuel: profile extras ───────────────────────────────────────────────
  phone: text("phone"),
  company: text("company"),
  jobTitle: text("job_title"),
  timezone: text("timezone").default("UTC").notNull(),
  locale: text("locale").default("en").notNull(),

  // ── Netfuel: usage & limits (denormalized for fast reads) ─────────────────
  // Canonical source is userProfiles; these are synced by cron/hooks
  planSlug: text("plan_slug").default("free").notNull(),
  brandCount: integer("brand_count").default(0).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
  activeOrganizationId: text("active_organization_id"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});