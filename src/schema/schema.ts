import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth-schema";

// Re-export all auth tables so drizzleAdapter and drizzle() both see them
export * from "./auth-schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const planSlugEnum = pgEnum("plan_slug", [
  "free",
  "pro",
  "agency",
  "custom",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "paused",
]);

export const queryFrequencyEnum = pgEnum("query_frequency", [
  "manual",
  "daily",
  "weekly",
]);

export const queryRunStatusEnum = pgEnum("query_run_status", [
  "success",
  "cached",
  "error",
  "timeout",
]);

export const aiModelEnum = pgEnum("ai_model", [
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-pro",
  "gemini-flash",
  "claude-3-5-sonnet",
  "claude-3-haiku",
  "perplexity-sonar",
  "perplexity-sonar-pro",
  "grok-2",
  "llama-3",
]);

export const redditMonitorStatusEnum = pgEnum("reddit_monitor_status", [
  "idle",
  "running",
  "error",
  "paused",
]);

export const sentimentEnum = pgEnum("sentiment", [
  "positive",
  "neutral",
  "negative",
]);

export const apiServiceEnum = pgEnum("api_service", [
  "openai",
  "perplexity",
  "gemini",
  "reddit",
  "sendgrid",
  "stripe",
  "custom",
]);

export const apiEnvEnum = pgEnum("api_env", ["production", "staging"]);

export const announcementTypeEnum = pgEnum("announcement_type", [
  "info",
  "warning",
  "success",
  "error",
]);

export const announcementTargetEnum = pgEnum("announcement_target", [
  "all",
  "free",
  "pro",
  "agency",
]);

export const emailCategoryEnum = pgEnum("email_category", [
  "transactional",
  "automated",
  "reengagement",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "paid",
  "open",
  "void",
  "uncollectible",
]);

// ─── User Profiles ─────────────────────────────────────────────────────────────
// Extends better-auth `users` table with billing + app-level data.

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: planSlugEnum("plan").default("free").notNull(),
    stripeCustomerId: text("stripe_customer_id").unique(),
    onboardingCompleted: boolean("onboarding_completed")
      .default(false)
      .notNull(),
    // Usage counters (reset monthly by cron)
    apiCallsToday: integer("api_calls_today").default(0).notNull(),
    apiCallsMonth: integer("api_calls_month").default(0).notNull(),
    creditsUsed: integer("credits_used").default(0).notNull(),
    creditsLimit: integer("credits_limit").default(100).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_user_profiles_stripe").on(t.stripeCustomerId)]
);

// ─── Plans ─────────────────────────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: planSlugEnum("slug").notNull().unique(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }).notNull(),
  brandLimit: integer("brand_limit").notNull(), // -1 = unlimited
  queryLimitMonthly: integer("query_limit_monthly").notNull(),
  redditMonitorsLimit: integer("reddit_monitors_limit").notNull(),
  teamSeats: integer("team_seats").default(1).notNull(),
  features: jsonb("features")
    .$type<Record<string, boolean>>()
    .default({})
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isCustom: boolean("is_custom").default(false).notNull(),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Subscriptions ─────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => plans.id),
    status: subscriptionStatusEnum("status").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripeCustomerId: text("stripe_customer_id"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_subscriptions_user").on(t.userId),
    index("idx_subscriptions_status").on(t.status),
  ]
);

// ─── Invoices ──────────────────────────────────────────────────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").default("usd").notNull(),
    status: invoiceStatusEnum("status").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    invoiceUrl: text("invoice_url"),
    pdfUrl: text("pdf_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_invoices_user").on(t.userId)]
);

// ─── Brands ────────────────────────────────────────────────────────────────────

export const brands = pgTable(
  "brands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    website: text("website"),
    description: text("description"),
    industry: text("industry"),
    country: text("country"),
    logoUrl: text("logo_url"),
    keywords: text("keywords").array().default([]).notNull(),
    competitors: text("competitors").array().default([]).notNull(),
    targetModels: text("target_models").array().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    // Cached latest score (updated after each run batch)
    latestScore: decimal("latest_score", { precision: 5, scale: 2 }),
    totalQueriesRun: integer("total_queries_run").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_brands_user").on(t.userId),
    uniqueIndex("idx_brands_user_slug").on(t.userId, t.slug),
  ]
);

// ─── Brand Queries (prompt templates) ─────────────────────────────────────────

export const brandQueries = pgTable(
  "brand_queries",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    context: text("context"), // optional extra context injected before prompt
    frequency: queryFrequencyEnum("frequency").default("manual").notNull(),
    targetModels: text("target_models").array().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    totalRuns: integer("total_runs").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_brand_queries_brand").on(t.brandId)]
);

// ─── AI Query Runs (individual model execution results) ────────────────────────

export const aiQueryRuns = pgTable(
  "ai_query_runs",
  {
    id: text("id").primaryKey(),
    queryId: text("query_id")
      .notNull()
      .references(() => brandQueries.id, { onDelete: "cascade" }),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    model: text("model").notNull(), // free-text to support new models
    modelResponse: text("model_response"), // full AI response text
    mentioned: boolean("mentioned").default(false).notNull(),
    cited: boolean("cited").default(false).notNull(),
    mentionPosition: integer("mention_position"), // 1=first mention, null=not found
    visibilityScore: decimal("visibility_score", { precision: 5, scale: 2 }),
    sentiment: sentimentEnum("sentiment"),
    costUsd: decimal("cost_usd", { precision: 10, scale: 6 }),
    tokensUsed: integer("tokens_used"),
    durationMs: integer("duration_ms"),
    status: queryRunStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_ai_runs_brand").on(t.brandId),
    index("idx_ai_runs_query").on(t.queryId),
    index("idx_ai_runs_user").on(t.userId),
    index("idx_ai_runs_created").on(t.createdAt),
  ]
);

// ─── Brand Daily Scores (aggregated for charts) ───────────────────────────────

export const brandDailyScores = pgTable(
  "brand_daily_scores",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    scoreDate: date("score_date").notNull(),
    avgScore: decimal("avg_score", { precision: 5, scale: 2 }).notNull(),
    queriesRun: integer("queries_run").default(0).notNull(),
    mentionsCount: integer("mentions_count").default(0).notNull(),
    citationsCount: integer("citations_count").default(0).notNull(),
    totalCostUsd: decimal("total_cost_usd", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_daily_scores_brand").on(t.brandId),
    uniqueIndex("idx_daily_scores_brand_date").on(t.brandId, t.scoreDate),
  ]
);

// ─── Reddit Monitors ──────────────────────────────────────────────────────────

export const redditMonitors = pgTable(
  "reddit_monitors",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subreddits: text("subreddits").array().default([]).notNull(),
    keywords: text("keywords").array().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    status: redditMonitorStatusEnum("status").default("idle").notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    totalMentionsFound: integer("total_mentions_found").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_reddit_monitors_brand").on(t.brandId),
    index("idx_reddit_monitors_user").on(t.userId),
  ]
);

// ─── Reddit Mentions ──────────────────────────────────────────────────────────

export const redditMentions = pgTable(
  "reddit_mentions",
  {
    id: text("id").primaryKey(),
    monitorId: text("monitor_id")
      .notNull()
      .references(() => redditMonitors.id, { onDelete: "cascade" }),
    brandId: text("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    subreddit: text("subreddit").notNull(),
    postId: text("post_id").notNull(),
    postTitle: text("post_title").notNull(),
    postUrl: text("post_url").notNull(),
    commentId: text("comment_id"), // null if mention is in the post body
    author: text("author"),
    bodySnippet: text("body_snippet"), // first 500 chars of relevant content
    sentiment: sentimentEnum("sentiment").default("neutral").notNull(),
    upvotes: integer("upvotes").default(0).notNull(),
    foundAt: timestamp("found_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_reddit_mentions_brand").on(t.brandId),
    index("idx_reddit_mentions_monitor").on(t.monitorId),
    uniqueIndex("idx_reddit_mentions_post_comment").on(t.postId, t.commentId),
  ]
);

// ─── Admin — API Keys ─────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    service: apiServiceEnum("service").notNull(),
    label: text("label").notNull(),
    keyEncrypted: text("key_encrypted").notNull(), // AES-256 encrypted
    quotaMonthly: integer("quota_monthly").default(10000).notNull(),
    usedThisMonth: integer("used_this_month").default(0).notNull(),
    env: apiEnvEnum("env").default("production").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_api_keys_service").on(t.service)]
);

// ─── Admin — Activity Logs ────────────────────────────────────────────────────

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"), // snapshot so log survives user deletion
    action: text("action").notNull(), // e.g. "user.suspended", "plan.updated"
    targetType: text("target_type"), // e.g. "user", "brand", "subscription"
    targetId: text("target_id"),
    targetLabel: text("target_label"), // human-readable snapshot of target
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_activity_logs_actor").on(t.actorId),
    index("idx_activity_logs_created").on(t.createdAt),
    index("idx_activity_logs_action").on(t.action),
  ]
);

// ─── Admin — Announcements ────────────────────────────────────────────────────

export const announcements = pgTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    type: announcementTypeEnum("type").default("info").notNull(),
    target: announcementTargetEnum("target").default("all").notNull(),
    ctaLabel: text("cta_label"),
    ctaUrl: text("cta_url"),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("idx_announcements_active").on(t.isActive, t.target)]
);

// ─── Admin — Feature Flags ────────────────────────────────────────────────────

export const featureFlags = pgTable("feature_flags", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  enabledFree: boolean("enabled_free").default(false).notNull(),
  enabledPro: boolean("enabled_pro").default(false).notNull(),
  enabledAgency: boolean("enabled_agency").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Admin — Email Templates ──────────────────────────────────────────────────

export const emailTemplates = pgTable("email_templates", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g. "welcome", "plan_upgraded"
  name: text("name").notNull(),
  category: emailCategoryEnum("category").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  variables: text("variables").array().default([]).notNull(), // e.g. ["{{name}}", "{{plan}}"]
  isActive: boolean("is_active").default(true).notNull(),
  openRatePct: decimal("open_rate_pct", { precision: 5, scale: 2 }),
  totalSent: integer("total_sent").default(0).notNull(),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Email Logs ───────────────────────────────────────────────────────────────

export const emailLogs = pgTable(
  "email_logs",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").references(() => emailTemplates.id),
    toEmail: text("to_email").notNull(),
    toUserId: text("to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subject: text("subject").notNull(),
    status: text("status").notNull(), // sent / failed / bounced / opened
    sendgridMessageId: text("sendgrid_message_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("idx_email_logs_user").on(t.toUserId),
    index("idx_email_logs_sent").on(t.sentAt),
  ]
);

// ═══════════════════════════════════════════════════════════════════════════════
// Relations
// ═══════════════════════════════════════════════════════════════════════════════

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [subscriptions.userId],
      references: [users.id],
    }),
    plan: one(plans, {
      fields: [subscriptions.planId],
      references: [plans.id],
    }),
    invoices: many(invoices),
  })
);

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, { fields: [invoices.userId], references: [users.id] }),
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  user: one(users, { fields: [brands.userId], references: [users.id] }),
  queries: many(brandQueries),
  dailyScores: many(brandDailyScores),
  redditMonitors: many(redditMonitors),
  aiRuns: many(aiQueryRuns),
}));

export const brandQueriesRelations = relations(
  brandQueries,
  ({ one, many }) => ({
    brand: one(brands, {
      fields: [brandQueries.brandId],
      references: [brands.id],
    }),
    runs: many(aiQueryRuns),
  })
);

export const aiQueryRunsRelations = relations(aiQueryRuns, ({ one }) => ({
  query: one(brandQueries, {
    fields: [aiQueryRuns.queryId],
    references: [brandQueries.id],
  }),
  brand: one(brands, {
    fields: [aiQueryRuns.brandId],
    references: [brands.id],
  }),
  user: one(users, { fields: [aiQueryRuns.userId], references: [users.id] }),
}));

export const brandDailyScoresRelations = relations(
  brandDailyScores,
  ({ one }) => ({
    brand: one(brands, {
      fields: [brandDailyScores.brandId],
      references: [brands.id],
    }),
  })
);

export const redditMonitorsRelations = relations(
  redditMonitors,
  ({ one, many }) => ({
    brand: one(brands, {
      fields: [redditMonitors.brandId],
      references: [brands.id],
    }),
    user: one(users, {
      fields: [redditMonitors.userId],
      references: [users.id],
    }),
    mentions: many(redditMentions),
  })
);

export const redditMentionsRelations = relations(redditMentions, ({ one }) => ({
  monitor: one(redditMonitors, {
    fields: [redditMentions.monitorId],
    references: [redditMonitors.id],
  }),
  brand: one(brands, {
    fields: [redditMentions.brandId],
    references: [brands.id],
  }),
}));

export const emailTemplatesRelations = relations(
  emailTemplates,
  ({ many }) => ({
    logs: many(emailLogs),
  })
);

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  template: one(emailTemplates, {
    fields: [emailLogs.templateId],
    references: [emailTemplates.id],
  }),
}));
