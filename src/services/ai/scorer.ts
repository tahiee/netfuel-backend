/**
 * Mention detection + visibility scoring.
 *
 * Given an AI response and a brand definition, this answers:
 *   1. Was the brand mentioned at all?
 *   2. How prominently (which "rank" in a list, if any)?
 *   3. What was the sentiment?
 *   4. Were any of the brand's URLs cited?
 *   5. What's an overall 0-100 "visibility score" for this single run?
 *
 * Implementation is intentionally simple/deterministic (regex + heuristics).
 * Good enough for v1 demo; production would swap in a per-response LLM call
 * for more accurate sentiment + position parsing.
 */

export type Sentiment = "positive" | "neutral" | "negative";

export interface BrandShape {
  name: string;
  website?: string | null;
  keywords?: string[] | null;
  competitors?: string[] | null;
}

export interface ScoringResult {
  mentioned: boolean;
  cited: boolean;
  /** 1 = first/prominent mention; 2-5 = mentioned but later; null = not mentioned. */
  mentionPosition: number | null;
  sentiment: Sentiment | null;
  /** 0-100 — combines mention + position + sentiment + citation. */
  visibilityScore: number;
}

const POSITIVE_HINTS = [
  "best",
  "leading",
  "top",
  "recommended",
  "excellent",
  "great",
  "powerful",
  "popular",
  "trusted",
  "favorite",
];
const NEGATIVE_HINTS = [
  "avoid",
  "not recommended",
  "poor",
  "limited",
  "expensive",
  "outdated",
  "weak",
  "lacks",
  "buggy",
  "unreliable",
];

/** Where in the text does the first occurrence of `needle` appear? */
function firstIndexOf(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

/**
 * Approximate "rank" of a brand vs its competitors in a list-style answer.
 * If brand appears before all known competitors → position 1.
 * If after K competitors → position K+1.
 * Returns null if brand isn't mentioned at all.
 */
function calcMentionPosition(
  text: string,
  brandName: string,
  competitors: string[]
): number | null {
  const brandIdx = firstIndexOf(text, brandName);
  if (brandIdx < 0) return null;

  const competitorIndexes = competitors
    .map((c) => firstIndexOf(text, c))
    .filter((i) => i >= 0);

  const beforeBrand = competitorIndexes.filter((i) => i < brandIdx).length;
  return beforeBrand + 1;
}

/**
 * Sentiment near the brand mention. Looks at a +/- 120 char window
 * around the brand name and tallies hint words.
 */
function calcSentiment(text: string, brandName: string): Sentiment | null {
  const idx = firstIndexOf(text, brandName);
  if (idx < 0) return null;

  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, idx + brandName.length + 120);
  const window = text.slice(start, end).toLowerCase();

  let positive = 0;
  let negative = 0;
  for (const w of POSITIVE_HINTS) if (window.includes(w)) positive++;
  for (const w of NEGATIVE_HINTS) if (window.includes(w)) negative++;

  if (positive === 0 && negative === 0) return "neutral";
  if (negative > positive) return "negative";
  if (positive > negative) return "positive";
  return "neutral";
}

/** Did the response link to the brand's actual website? */
function detectCitation(text: string, website?: string | null): boolean {
  if (!website) return false;
  try {
    const url = new URL(
      /^https?:\/\//i.test(website) ? website : `https://${website}`
    );
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return text.toLowerCase().includes(host);
  } catch {
    return false;
  }
}

/**
 * Final 0-100 score combining all signals.
 *   - Not mentioned                                → 0-15 (citation alone gives partial credit)
 *   - Mentioned                                    → 50 base
 *   - Mention position 1 (above all competitors)  → +25
 *   - Position 2-3                                 → +12
 *   - Position 4+                                  → +5
 *   - Positive sentiment                           → +15
 *   - Neutral sentiment                            → +5
 *   - Negative sentiment                           → -10
 *   - Cited in response                            → +10
 *   - Capped at 100, floored at 0
 */
function calcScore(parts: {
  mentioned: boolean;
  cited: boolean;
  position: number | null;
  sentiment: Sentiment | null;
}): number {
  let score = 0;
  if (parts.mentioned) {
    score += 50;
    if (parts.position === 1) score += 25;
    else if (parts.position && parts.position <= 3) score += 12;
    else if (parts.position && parts.position >= 4) score += 5;

    if (parts.sentiment === "positive") score += 15;
    else if (parts.sentiment === "neutral") score += 5;
    else if (parts.sentiment === "negative") score -= 10;
  } else {
    // Not mentioned but cited via URL = some signal
    if (parts.cited) score += 15;
  }
  if (parts.cited) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreResponse(
  response: string,
  brand: BrandShape
): ScoringResult {
  const safeText = response ?? "";
  const competitors = brand.competitors ?? [];
  const mentioned = firstIndexOf(safeText, brand.name) >= 0;
  const cited = detectCitation(safeText, brand.website);
  const mentionPosition = mentioned
    ? calcMentionPosition(safeText, brand.name, competitors)
    : null;
  const sentiment = mentioned ? calcSentiment(safeText, brand.name) : null;

  const visibilityScore = calcScore({
    mentioned,
    cited,
    position: mentionPosition,
    sentiment,
  });

  return {
    mentioned,
    cited,
    mentionPosition,
    sentiment,
    visibilityScore,
  };
}
