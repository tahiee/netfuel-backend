/**
 * Netfuel / CrowdReply — Zod validation schemas
 *
 * Written as pure Zod (not drizzle-zod overrides) for full type safety.
 * - Insert* schemas  → POST / create endpoints
 * - Update* schemas  → PATCH endpoints (all fields optional)
 * - Select* types    → TypeScript shapes for query results
 */

import { z } from "zod";

// ─── Re-usable primitives ─────────────────────────────────────────────────────

const id = z.string().min(1).max(128);
const email = z.string().email().max(320).toLowerCase().trim();
const url = z.string().url().max(2048);
const shortText = (max = 255) => z.string().min(1).max(max).trim();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const moneyStr = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount");
const decimalScore = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Expected 0–100");
const snakeKey = (max = 100) =>
  z.string().min(1).max(max).regex(/^[a-z0-9_]+$/, "Must be snake_case");

const planSlug = z.enum(["free", "pro", "agency", "custom"]);
const subscriptionStatus = z.enum([
  "trialing", "active", "past_due", "canceled", "incomplete", "paused",
]);
const aiModel = z.enum([
  "gpt-4o", "gpt-4o-mini", "gemini-pro", "gemini-flash",
  "claude-3-5-sonnet", "claude-3-haiku",
  "perplexity-sonar", "perplexity-sonar-pro",
  "grok-2", "llama-3",
]);
const queryFrequency = z.enum(["manual", "daily", "weekly"]);
const queryRunStatus = z.enum(["success", "cached", "error", "timeout"]);
const sentiment = z.enum(["positive", "neutral", "negative"]);
const apiService = z.enum(["openai", "perplexity", "gemini", "reddit", "sendgrid", "stripe", "custom"]);
const apiEnv = z.enum(["production", "staging"]);
const announcementType = z.enum(["info", "warning", "success", "error"]);
const announcementTarget = z.enum(["all", "free", "pro", "agency"]);
const emailCategory = z.enum(["transactional", "automated", "reengagement"]);
const invoiceStatus = z.enum(["paid", "open", "void", "uncollectible"]);
const redditMonitorStatus = z.enum(["idle", "running", "error", "paused"]);

// ─── Auth / Users ─────────────────────────────────────────────────────────────

export const insertUserSchema = z.object({
  id,
  name: shortText(100),
  email,
  emailVerified: z.boolean().default(false),
  image: url.optional(),
  userRoles: z.enum(["user", "admin"]).default("user"),
  twoFactorEnabled: z.boolean().default(false),
  banned: z.boolean().default(false),
  banReason: z.string().max(500).optional(),
  banExpires: z.coerce.date().optional(),
  isSuperAdmin: z.boolean().default(false),
  phone: z.string().max(30).optional(),
  company: z.string().max(120).trim().optional(),
  jobTitle: z.string().max(120).trim().optional(),
  timezone: z.string().max(64).default("UTC"),
  locale: z.string().length(2).default("en"),
  planSlug: planSlug.default("free"),
  brandCount: z.number().int().min(0).default(0),
});

export const updateUserSchema = insertUserSchema
  .omit({ id: true, email: true })
  .partial();

export const selectUserSchema = insertUserSchema;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type SelectUser = z.infer<typeof selectUserSchema>;

// ─── User Profiles ────────────────────────────────────────────────────────────

export const insertUserProfileSchema = z.object({
  userId: id,
  plan: planSlug.default("free"),
  stripeCustomerId: z.string().max(255).optional(),
  onboardingCompleted: z.boolean().default(false),
  apiCallsToday: z.number().int().min(0).default(0),
  apiCallsMonth: z.number().int().min(0).default(0),
  creditsUsed: z.number().int().min(0).default(0),
  creditsLimit: z.number().int().min(0).max(1_000_000).default(100),
});

export const updateUserProfileSchema = insertUserProfileSchema
  .omit({ userId: true })
  .partial();

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

// ─── Plans ────────────────────────────────────────────────────────────────────

export const insertPlanSchema = z.object({
  id,
  name: shortText(),
  slug: planSlug,
  description: z.string().max(500).trim().optional(),
  priceMonthly: moneyStr,
  priceYearly: moneyStr,
  brandLimit: z.number().int().min(-1),
  queryLimitMonthly: z.number().int().min(-1),
  redditMonitorsLimit: z.number().int().min(-1),
  teamSeats: z.number().int().min(1).max(500).default(1),
  features: z.record(z.string(), z.boolean()).default({}),
  isActive: z.boolean().default(true),
  isCustom: z.boolean().default(false),
  stripePriceIdMonthly: z.string().max(255).optional(),
  stripePriceIdYearly: z.string().max(255).optional(),
});

export const updatePlanSchema = insertPlanSchema
  .omit({ id: true, slug: true })
  .partial();

export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type UpdatePlan = z.infer<typeof updatePlanSchema>;
export type SelectPlan = z.infer<typeof insertPlanSchema> & { createdAt: Date; updatedAt: Date };

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const insertSubscriptionSchema = z.object({
  id,
  userId: id,
  planId: id,
  status: subscriptionStatus,
  stripeSubscriptionId: z.string().max(255).optional(),
  stripeCustomerId: z.string().max(255).optional(),
  currentPeriodStart: z.coerce.date().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
  trialEnd: z.coerce.date().optional(),
  canceledAt: z.coerce.date().optional(),
});

export const updateSubscriptionSchema = insertSubscriptionSchema
  .omit({ id: true, userId: true })
  .partial();

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;
export type SelectSubscription = InsertSubscription & { createdAt: Date; updatedAt: Date };

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const insertInvoiceSchema = z.object({
  id,
  userId: id,
  subscriptionId: id.optional(),
  stripeInvoiceId: z.string().max(255).optional(),
  amountCents: z.number().int().min(0),
  currency: z.string().length(3).toLowerCase().default("usd"),
  status: invoiceStatus,
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  invoiceUrl: url.optional(),
  pdfUrl: url.optional(),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type SelectInvoice = InsertInvoice & { createdAt: Date };

// ─── Brands ───────────────────────────────────────────────────────────────────

export const insertBrandSchema = z.object({
  id,
  userId: id,
  name: shortText(),
  slug: z
    .string().min(1).max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  website: url.optional(),
  description: z.string().max(1000).trim().optional(),
  industry: z.string().max(100).trim().optional(),
  country: z.string().max(80).trim().optional(),
  logoUrl: url.optional(),
  keywords: z.array(z.string().min(1).max(100)).max(50).default([]),
  competitors: z.array(z.string().min(1).max(200)).max(20).default([]),
  targetModels: z.array(aiModel).max(20).default([]),
  isActive: z.boolean().default(true),
  latestScore: decimalScore.optional(),
  totalQueriesRun: z.number().int().min(0).default(0),
});

export const updateBrandSchema = insertBrandSchema
  .omit({ id: true, userId: true })
  .partial();

export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type UpdateBrand = z.infer<typeof updateBrandSchema>;
export type SelectBrand = InsertBrand & { createdAt: Date; updatedAt: Date };

// ─── Brand Queries ────────────────────────────────────────────────────────────

export const insertBrandQuerySchema = z
  .object({
    id,
    brandId: id,
    prompt: z.string().min(10).max(2000).trim(),
    context: z.string().max(1000).trim().optional(),
    frequency: queryFrequency.default("manual"),
    targetModels: z.array(aiModel).min(1, "Select at least one model").max(20),
    isActive: z.boolean().default(true),
    nextRunAt: z.coerce.date().optional(),
  });

export const updateBrandQuerySchema = insertBrandQuerySchema
  .omit({ id: true, brandId: true })
  .partial();

export type InsertBrandQuery = z.infer<typeof insertBrandQuerySchema>;
export type UpdateBrandQuery = z.infer<typeof updateBrandQuerySchema>;
export type SelectBrandQuery = InsertBrandQuery & {
  lastRunAt: Date | null;
  totalRuns: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── AI Query Runs ────────────────────────────────────────────────────────────

export const insertAiQueryRunSchema = z.object({
  id,
  queryId: id,
  brandId: id,
  userId: id,
  model: z.string().min(1).max(100),
  modelResponse: z.string().max(100_000).optional(),
  mentioned: z.boolean().default(false),
  cited: z.boolean().default(false),
  mentionPosition: z.number().int().min(1).optional(),
  visibilityScore: decimalScore.optional(),
  sentiment: sentiment.optional(),
  costUsd: z.string().regex(/^\d+\.\d{1,6}$/).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
  status: queryRunStatus,
  errorMessage: z.string().max(2000).optional(),
});

export type InsertAiQueryRun = z.infer<typeof insertAiQueryRunSchema>;
export type SelectAiQueryRun = InsertAiQueryRun & { createdAt: Date };

// ─── Brand Daily Scores ───────────────────────────────────────────────────────

export const insertBrandDailyScoreSchema = z.object({
  id,
  brandId: id,
  scoreDate: isoDate,
  avgScore: decimalScore,
  queriesRun: z.number().int().min(0).default(0),
  mentionsCount: z.number().int().min(0).default(0),
  citationsCount: z.number().int().min(0).default(0),
  totalCostUsd: z.string().optional(),
});

export type InsertBrandDailyScore = z.infer<typeof insertBrandDailyScoreSchema>;
export type SelectBrandDailyScore = InsertBrandDailyScore & { createdAt: Date };

// ─── Reddit Monitors ──────────────────────────────────────────────────────────

export const insertRedditMonitorSchema = z.object({
  id,
  brandId: id,
  userId: id,
  subreddits: z
    .array(
      z.string().min(1).max(100)
        .regex(/^[A-Za-z0-9_]+$/, "Invalid subreddit name"),
    )
    .min(1, "Add at least one subreddit")
    .max(20),
  keywords: z
    .array(z.string().min(1).max(100))
    .min(1, "Add at least one keyword")
    .max(50),
  isActive: z.boolean().default(true),
  status: redditMonitorStatus.default("idle"),
  nextRunAt: z.coerce.date().optional(),
});

export const updateRedditMonitorSchema = insertRedditMonitorSchema
  .omit({ id: true, brandId: true, userId: true })
  .partial();

export type InsertRedditMonitor = z.infer<typeof insertRedditMonitorSchema>;
export type UpdateRedditMonitor = z.infer<typeof updateRedditMonitorSchema>;
export type SelectRedditMonitor = InsertRedditMonitor & {
  lastRunAt: Date | null;
  totalMentionsFound: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Reddit Mentions ──────────────────────────────────────────────────────────

export const insertRedditMentionSchema = z.object({
  id,
  monitorId: id,
  brandId: id,
  subreddit: z.string().min(1).max(100),
  postId: z.string().min(1).max(64),
  postTitle: z.string().min(1).max(500),
  postUrl: url,
  commentId: z.string().max(64).optional(),
  author: z.string().max(100).optional(),
  bodySnippet: z.string().max(1000).optional(),
  sentiment: sentiment.default("neutral"),
  upvotes: z.number().int().min(0).default(0),
  foundAt: z.coerce.date(),
});

export type InsertRedditMention = z.infer<typeof insertRedditMentionSchema>;
export type SelectRedditMention = InsertRedditMention & { createdAt: Date };

// ─── Admin — API Keys ─────────────────────────────────────────────────────────

export const insertApiKeySchema = z.object({
  id,
  service: apiService,
  label: shortText(),
  keyEncrypted: z.string().min(1).max(2048),
  quotaMonthly: z.number().int().min(1).max(10_000_000).default(10_000),
  env: apiEnv.default("production"),
  isActive: z.boolean().default(true),
  expiresAt: z.coerce.date().optional(),
  createdBy: id.optional(),
});

export const updateApiKeySchema = insertApiKeySchema
  .omit({ id: true, keyEncrypted: true, service: true, createdBy: true })
  .partial();

// Form received from admin UI — raw key, server encrypts before storing
export const createApiKeyFormSchema = z.object({
  service: apiService,
  label: shortText(),
  key: z.string().min(8).max(512).trim(),
  quotaMonthly: z.number().int().min(1).max(10_000_000).default(10_000),
  env: apiEnv.default("production"),
  expiresAt: z.string().optional(),
});

// Returned to frontend — never expose encrypted key
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type UpdateApiKey = z.infer<typeof updateApiKeySchema>;
export type CreateApiKeyForm = z.infer<typeof createApiKeyFormSchema>;
export type SelectApiKey = Omit<InsertApiKey, "keyEncrypted"> & {
  usedThisMonth: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Admin — Activity Logs ────────────────────────────────────────────────────

export const insertActivityLogSchema = z.object({
  id,
  actorId: id.optional(),
  actorEmail: email.optional(),
  action: z.string().min(1).max(120),
  targetType: z.string().max(60).optional(),
  targetId: z.string().max(128).optional(),
  targetLabel: z.string().max(255).optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().max(512).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type SelectActivityLog = InsertActivityLog & { createdAt: Date };

// ─── Admin — Announcements ────────────────────────────────────────────────────

export const insertAnnouncementSchema = z.object({
  id,
  title: z.string().min(1).max(120).trim(),
  body: z.string().min(1).max(1000).trim(),
  type: announcementType.default("info"),
  target: announcementTarget.default("all"),
  ctaLabel: z.string().max(60).trim().optional(),
  ctaUrl: url.optional(),
  isActive: z.boolean().default(true),
  expiresAt: z.coerce.date().optional(),
  createdBy: id.optional(),
});

export const updateAnnouncementSchema = insertAnnouncementSchema
  .omit({ id: true, createdBy: true })
  .partial();

export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type UpdateAnnouncement = z.infer<typeof updateAnnouncementSchema>;
export type SelectAnnouncement = InsertAnnouncement & { createdAt: Date; updatedAt: Date };

// ─── Admin — Feature Flags ────────────────────────────────────────────────────

export const insertFeatureFlagSchema = z.object({
  id,
  key: snakeKey(),
  label: shortText(),
  description: z.string().max(500).trim().optional(),
  category: shortText(),
  enabledFree: z.boolean().default(false),
  enabledPro: z.boolean().default(false),
  enabledAgency: z.boolean().default(true),
});

export const updateFeatureFlagSchema = insertFeatureFlagSchema
  .omit({ id: true, key: true })
  .partial();

export const toggleFeatureFlagSchema = z.object({
  key: snakeKey(),
  plan: z.enum(["free", "pro", "agency"]),
  enabled: z.boolean(),
});

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type UpdateFeatureFlag = z.infer<typeof updateFeatureFlagSchema>;
export type ToggleFeatureFlag = z.infer<typeof toggleFeatureFlagSchema>;
export type SelectFeatureFlag = InsertFeatureFlag & { createdAt: Date; updatedAt: Date };

// ─── Admin — Email Templates ──────────────────────────────────────────────────

const mustacheVar = z.string().regex(/^\{\{[a-zA-Z_]+\}\}$/, "Must be {{varName}}");

export const insertEmailTemplateSchema = z.object({
  id,
  key: snakeKey(80),
  name: shortText(),
  category: emailCategory,
  subject: z.string().min(1).max(255).trim(),
  bodyHtml: z.string().min(1).max(100_000),
  variables: z.array(mustacheVar).max(30).default([]),
  isActive: z.boolean().default(true),
});

export const updateEmailTemplateSchema = insertEmailTemplateSchema
  .omit({ id: true, key: true })
  .partial();

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type UpdateEmailTemplate = z.infer<typeof updateEmailTemplateSchema>;
export type SelectEmailTemplate = InsertEmailTemplate & {
  openRatePct: string | null;
  totalSent: number;
  lastSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Email Logs ───────────────────────────────────────────────────────────────

export const insertEmailLogSchema = z.object({
  id,
  templateId: id.optional(),
  toEmail: email,
  toUserId: id.optional(),
  subject: z.string().min(1).max(255),
  status: z.enum(["sent", "failed", "bounced", "opened"]),
  sendgridMessageId: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sentAt: z.coerce.date().optional(),
});

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type SelectEmailLog = InsertEmailLog & { sentAt: Date };

// ─── API request shapes (cross-table) ────────────────────────────────────────

export const runQueriesRequestSchema = z.object({
  brandId: id,
  queryIds: z.array(id).min(1).max(50),
  models: z.array(aiModel).min(1).max(20).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
  sortBy: z.string().max(60).optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const dateRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((d) => d.from <= d.to, { message: "from must be before to" });

export const banUserSchema = z.object({
  userId: id,
  reason: z.string().min(1).max(500),
  expiresAt: z.coerce.date().optional(),
});

export const changePlanSchema = z.object({
  userId: id,
  planSlug,
  note: z.string().max(500).optional(),
});

export type RunQueriesRequest = z.infer<typeof runQueriesRequestSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type BanUser = z.infer<typeof banUserSchema>;
export type ChangePlan = z.infer<typeof changePlanSchema>;
