import { eq, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

import { database } from "@/configs/connection.config";
import {
  aiQueryRuns,
  brandQueries,
  brands,
} from "@/schema/schema";
import { logger } from "@/utils/logger.util";
import { getProvider } from "./provider-registry";
import { scoreResponse } from "./scorer";
import type { SupportedModel } from "./types";

export interface ExecutorRunResult {
  id: string;
  model: SupportedModel;
  status: "success" | "error";
  visibilityScore: number | null;
  mentioned: boolean;
  durationMs: number | null;
  errorMessage: string | null;
}

/**
 * Run one brand-query against every model in its `targetModels` array.
 *
 * Per-model failures are isolated — if Anthropic times out, GPT still records
 * its run successfully. We always insert a row in `ai_query_runs` so the user
 * has a paper trail of "we tried, here's what happened".
 *
 * Updates the parent query's `lastRunAt` + `totalRuns` and bumps the brand's
 * `latestScore` (running average of last batch) + `totalQueriesRun`.
 */
export async function executeQuery(queryId: string): Promise<{
  queryId: string;
  brandId: string;
  runs: ExecutorRunResult[];
}> {
  // 1. Load query + brand context (need brand name/keywords/competitors for scoring)
  const [row] = await database
    .select({
      query: brandQueries,
      brand: brands,
    })
    .from(brandQueries)
    .innerJoin(brands, eq(brandQueries.brandId, brands.id))
    .where(eq(brandQueries.id, queryId))
    .limit(1);

  if (!row) {
    throw new Error(`Query not found: ${queryId}`);
  }
  const { query, brand } = row;

  if (!query.targetModels || query.targetModels.length === 0) {
    throw new Error("Query has no target models — nothing to run");
  }

  // 2. Run all models in parallel — each model's failure is captured per-row,
  //    so one slow/broken provider can't take the whole batch down.
  const settled = await Promise.allSettled(
    query.targetModels.map((modelStr) =>
      runOneModel({
        queryId: query.id,
        brandId: brand.id,
        userId: brand.userId,
        prompt: query.prompt,
        context: query.context,
        model: modelStr as SupportedModel,
        brand: {
          name: brand.name,
          website: brand.website,
          keywords: brand.keywords,
          competitors: brand.competitors,
        },
      })
    )
  );

  const runs: ExecutorRunResult[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    // This should be rare — runOneModel catches its own errors and returns
    // a structured failure. A rejection here means something exploded
    // outside the try/catch (e.g., DB write failed).
    return {
      id: "",
      model: query.targetModels[i] as SupportedModel,
      status: "error",
      visibilityScore: null,
      mentioned: false,
      durationMs: null,
      errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  // 3. Update query stats
  await database
    .update(brandQueries)
    .set({
      lastRunAt: new Date(),
      totalRuns: sql`${brandQueries.totalRuns} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(brandQueries.id, query.id));

  // 4. Update brand cached score (running latest = avg of this batch)
  const successfulScores = runs
    .filter((r) => r.status === "success" && r.visibilityScore != null)
    .map((r) => r.visibilityScore as number);

  if (successfulScores.length > 0) {
    const batchAvg =
      successfulScores.reduce((s, v) => s + v, 0) / successfulScores.length;
    await database
      .update(brands)
      .set({
        latestScore: String(batchAvg.toFixed(2)),
        totalQueriesRun: sql`${brands.totalQueriesRun} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, brand.id));
  } else {
    // All models failed — still bump `totalQueriesRun` for visibility
    await database
      .update(brands)
      .set({
        totalQueriesRun: sql`${brands.totalQueriesRun} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, brand.id));
  }

  logger.info(
    `Query ${query.id} executed: ${runs.filter((r) => r.status === "success").length}/${runs.length} successful`
  );

  return { queryId: query.id, brandId: brand.id, runs };
}

interface RunOneModelArgs {
  queryId: string;
  brandId: string;
  userId: string;
  prompt: string;
  context: string | null;
  model: SupportedModel;
  brand: {
    name: string;
    website: string | null;
    keywords: string[] | null;
    competitors: string[] | null;
  };
}

async function runOneModel(args: RunOneModelArgs): Promise<ExecutorRunResult> {
  const runId = createId();
  const provider = getProvider(args.model);

  // Provider not implemented at all (grok-2, llama-3 today)
  if (!provider) {
    await database.insert(aiQueryRuns).values({
      id: runId,
      queryId: args.queryId,
      brandId: args.brandId,
      userId: args.userId,
      model: args.model,
      modelResponse: null,
      mentioned: false,
      cited: false,
      mentionPosition: null,
      visibilityScore: null,
      sentiment: null,
      costUsd: "0",
      tokensUsed: 0,
      durationMs: 0,
      status: "error",
      errorMessage: `Provider for "${args.model}" is not implemented yet`,
    });
    return {
      id: runId,
      model: args.model,
      status: "error",
      visibilityScore: null,
      mentioned: false,
      durationMs: null,
      errorMessage: `Provider for "${args.model}" is not implemented yet`,
    };
  }

  // Provider exists but missing API key — record a clear "not configured" run
  if (!provider.isConfigured()) {
    await database.insert(aiQueryRuns).values({
      id: runId,
      queryId: args.queryId,
      brandId: args.brandId,
      userId: args.userId,
      model: args.model,
      modelResponse: null,
      mentioned: false,
      cited: false,
      mentionPosition: null,
      visibilityScore: null,
      sentiment: null,
      costUsd: "0",
      tokensUsed: 0,
      durationMs: 0,
      status: "error",
      errorMessage: `${provider.displayName} API key is not configured`,
    });
    return {
      id: runId,
      model: args.model,
      status: "error",
      visibilityScore: null,
      mentioned: false,
      durationMs: null,
      errorMessage: `${provider.displayName} API key is not configured`,
    };
  }

  // Actually call the AI
  try {
    const out = await provider.run({
      prompt: args.prompt,
      context: args.context,
    });

    const score = scoreResponse(out.response, args.brand);

    await database.insert(aiQueryRuns).values({
      id: runId,
      queryId: args.queryId,
      brandId: args.brandId,
      userId: args.userId,
      model: args.model,
      modelResponse: out.response,
      mentioned: score.mentioned,
      cited: score.cited,
      mentionPosition: score.mentionPosition,
      visibilityScore: String(score.visibilityScore.toFixed(2)),
      sentiment: score.sentiment,
      costUsd: out.costUsd.toFixed(6),
      tokensUsed: out.tokensUsed,
      durationMs: out.durationMs,
      status: "success",
      errorMessage: null,
    });

    return {
      id: runId,
      model: args.model,
      status: "success",
      visibilityScore: score.visibilityScore,
      mentioned: score.mentioned,
      durationMs: out.durationMs,
      errorMessage: null,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(
      `Model ${args.model} failed for query ${args.queryId}: ${errorMessage}`
    );

    await database.insert(aiQueryRuns).values({
      id: runId,
      queryId: args.queryId,
      brandId: args.brandId,
      userId: args.userId,
      model: args.model,
      modelResponse: null,
      mentioned: false,
      cited: false,
      mentionPosition: null,
      visibilityScore: null,
      sentiment: null,
      costUsd: "0",
      tokensUsed: 0,
      durationMs: 0,
      status: "error",
      errorMessage: errorMessage.slice(0, 500),
    });

    return {
      id: runId,
      model: args.model,
      status: "error",
      visibilityScore: null,
      mentioned: false,
      durationMs: null,
      errorMessage,
    };
  }
}
