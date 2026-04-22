CREATE TYPE "public"."ai_model" AS ENUM('gpt-4o', 'gpt-4o-mini', 'gemini-pro', 'gemini-flash', 'claude-3-5-sonnet', 'claude-3-haiku', 'perplexity-sonar', 'perplexity-sonar-pro', 'grok-2', 'llama-3');--> statement-breakpoint
CREATE TYPE "public"."announcement_target" AS ENUM('all', 'free', 'pro', 'agency');--> statement-breakpoint
CREATE TYPE "public"."announcement_type" AS ENUM('info', 'warning', 'success', 'error');--> statement-breakpoint
CREATE TYPE "public"."api_env" AS ENUM('production', 'staging');--> statement-breakpoint
CREATE TYPE "public"."api_service" AS ENUM('openai', 'perplexity', 'gemini', 'reddit', 'sendgrid', 'stripe', 'custom');--> statement-breakpoint
CREATE TYPE "public"."email_category" AS ENUM('transactional', 'automated', 'reengagement');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('paid', 'open', 'void', 'uncollectible');--> statement-breakpoint
CREATE TYPE "public"."plan_slug" AS ENUM('free', 'pro', 'agency', 'custom');--> statement-breakpoint
CREATE TYPE "public"."query_frequency" AS ENUM('manual', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."query_run_status" AS ENUM('success', 'cached', 'error', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."reddit_monitor_status" AS ENUM('idle', 'running', 'error', 'paused');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_email" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"target_label" text,
	"ip_address" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_query_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"query_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"user_id" text NOT NULL,
	"model" text NOT NULL,
	"model_response" text,
	"mentioned" boolean DEFAULT false NOT NULL,
	"cited" boolean DEFAULT false NOT NULL,
	"mention_position" integer,
	"visibility_score" numeric(5, 2),
	"sentiment" "sentiment",
	"cost_usd" numeric(10, 6),
	"tokens_used" integer,
	"duration_ms" integer,
	"status" "query_run_status" NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"type" "announcement_type" DEFAULT 'info' NOT NULL,
	"target" "announcement_target" DEFAULT 'all' NOT NULL,
	"cta_label" text,
	"cta_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"service" "api_service" NOT NULL,
	"label" text NOT NULL,
	"key_encrypted" text NOT NULL,
	"quota_monthly" integer DEFAULT 10000 NOT NULL,
	"used_this_month" integer DEFAULT 0 NOT NULL,
	"env" "api_env" DEFAULT 'production' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_daily_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"score_date" date NOT NULL,
	"avg_score" numeric(5, 2) NOT NULL,
	"queries_run" integer DEFAULT 0 NOT NULL,
	"mentions_count" integer DEFAULT 0 NOT NULL,
	"citations_count" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_queries" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"prompt" text NOT NULL,
	"context" text,
	"frequency" "query_frequency" DEFAULT 'manual' NOT NULL,
	"target_models" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website" text,
	"description" text,
	"industry" text,
	"country" text,
	"logo_url" text,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"competitors" text[] DEFAULT '{}' NOT NULL,
	"target_models" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"latest_score" numeric(5, 2),
	"total_queries_run" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text,
	"to_email" text NOT NULL,
	"to_user_id" text,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"sendgrid_message_id" text,
	"metadata" jsonb,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"category" "email_category" NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"variables" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"open_rate_pct" numeric(5, 2),
	"total_sent" integer DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"enabled_free" boolean DEFAULT false NOT NULL,
	"enabled_pro" boolean DEFAULT false NOT NULL,
	"enabled_agency" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"subscription_id" text,
	"stripe_invoice_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" "invoice_status" NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"invoice_url" text,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" "plan_slug" NOT NULL,
	"description" text,
	"price_monthly" numeric(10, 2) NOT NULL,
	"price_yearly" numeric(10, 2) NOT NULL,
	"brand_limit" integer NOT NULL,
	"query_limit_monthly" integer NOT NULL,
	"reddit_monitors_limit" integer NOT NULL,
	"team_seats" integer DEFAULT 1 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reddit_mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"subreddit" text NOT NULL,
	"post_id" text NOT NULL,
	"post_title" text NOT NULL,
	"post_url" text NOT NULL,
	"comment_id" text,
	"author" text,
	"body_snippet" text,
	"sentiment" "sentiment" DEFAULT 'neutral' NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"found_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_monitors" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subreddits" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" "reddit_monitor_status" DEFAULT 'idle' NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"total_mentions_found" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" "subscription_status" NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"trial_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" "plan_slug" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"api_calls_today" integer DEFAULT 0 NOT NULL,
	"api_calls_month" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"credits_limit" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"two_factor_enabled" boolean DEFAULT false,
	"user_roles" text DEFAULT 'user' NOT NULL,
	"role" text DEFAULT 'user',
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"phone" text,
	"company" text,
	"job_title" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"plan_slug" text DEFAULT 'free' NOT NULL,
	"brand_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_query_runs" ADD CONSTRAINT "ai_query_runs_query_id_brand_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."brand_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_query_runs" ADD CONSTRAINT "ai_query_runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_query_runs" ADD CONSTRAINT "ai_query_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_daily_scores" ADD CONSTRAINT "brand_daily_scores_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_queries" ADD CONSTRAINT "brand_queries_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_mentions" ADD CONSTRAINT "reddit_mentions_monitor_id_reddit_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."reddit_monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_mentions" ADD CONSTRAINT "reddit_mentions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_monitors" ADD CONSTRAINT "reddit_monitors_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_monitors" ADD CONSTRAINT "reddit_monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_logs_actor" ON "activity_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_created" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_action" ON "activity_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_ai_runs_brand" ON "ai_query_runs" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_ai_runs_query" ON "ai_query_runs" USING btree ("query_id");--> statement-breakpoint
CREATE INDEX "idx_ai_runs_user" ON "ai_query_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_runs_created" ON "ai_query_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_announcements_active" ON "announcements" USING btree ("is_active","target");--> statement-breakpoint
CREATE INDEX "idx_api_keys_service" ON "api_keys" USING btree ("service");--> statement-breakpoint
CREATE INDEX "idx_daily_scores_brand" ON "brand_daily_scores" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_scores_brand_date" ON "brand_daily_scores" USING btree ("brand_id","score_date");--> statement-breakpoint
CREATE INDEX "idx_brand_queries_brand" ON "brand_queries" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_brands_user" ON "brands" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_brands_user_slug" ON "brands" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "idx_email_logs_user" ON "email_logs" USING btree ("to_user_id");--> statement-breakpoint
CREATE INDEX "idx_email_logs_sent" ON "email_logs" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_invoices_user" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_mentions_brand" ON "reddit_mentions" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_mentions_monitor" ON "reddit_mentions" USING btree ("monitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reddit_mentions_post_comment" ON "reddit_mentions" USING btree ("post_id","comment_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_monitors_brand" ON "reddit_monitors" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_monitors_user" ON "reddit_monitors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_profiles_stripe" ON "user_profiles" USING btree ("stripe_customer_id");