import { aiQueryRuns, brandQueries, brands } from "@/schema/schema";

type RunRow = typeof aiQueryRuns.$inferSelect;
type QueryRow = typeof brandQueries.$inferSelect;
type BrandRow = typeof brands.$inferSelect;

/**
 * Frontend-friendly shape — flattens decimal scores to numbers, includes
 * brand + query refs for context (so the UI doesn't need a second fetch).
 *
 * Keep in sync with `dev/src/types/aiRun.types.ts`.
 */
export const toFrontendRun = (
  r: RunRow,
  query?: Pick<QueryRow, "id" | "prompt" | "frequency"> | null,
  brand?: Pick<BrandRow, "id" | "name" | "slug"> | null
) => ({
  id: r.id,
  queryId: r.queryId,
  brandId: r.brandId,
  userId: r.userId,
  model: r.model,
  modelResponse: r.modelResponse,
  mentioned: r.mentioned,
  cited: r.cited,
  mentionPosition: r.mentionPosition,
  // Decimal columns come back as strings — coerce to numbers for charts/UI
  visibilityScore: r.visibilityScore != null ? Number(r.visibilityScore) : null,
  sentiment: r.sentiment,
  costUsd: r.costUsd != null ? Number(r.costUsd) : 0,
  tokensUsed: r.tokensUsed,
  durationMs: r.durationMs,
  status: r.status,
  errorMessage: r.errorMessage,
  createdAt: r.createdAt,
  query: query
    ? { id: query.id, prompt: query.prompt, frequency: query.frequency }
    : undefined,
  brand: brand
    ? { id: brand.id, name: brand.name, slug: brand.slug }
    : undefined,
});
