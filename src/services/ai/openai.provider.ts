import OpenAI from "openai";
import { env } from "@/utils/env.util";
import type {
  AIProvider,
  ProviderPricing,
  ProviderRunInput,
  ProviderRunOutput,
} from "./types";

// Pricing (USD per 1k tokens) — keep close to OpenAI's published rates.
// Update when their pricing changes; off-by-a-bit is fine for ranking purposes.
const PRICING: Record<"gpt-4o" | "gpt-4o-mini", ProviderPricing> = {
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
};

let cachedClient: OpenAI | null = null;
const getClient = (): OpenAI => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return cachedClient;
};

export class OpenAIProvider implements AIProvider {
  constructor(public readonly model: "gpt-4o" | "gpt-4o-mini") {}

  get displayName(): string {
    return this.model === "gpt-4o" ? "OpenAI · GPT-4o" : "OpenAI · GPT-4o mini";
  }

  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    const client = getClient();
    const startedAt = Date.now();

    const messages: { role: "system" | "user"; content: string }[] = [];
    if (input.context) {
      messages.push({ role: "system", content: input.context });
    }
    messages.push({ role: "user", content: input.prompt });

    const completion = await client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0.2, // low — we want consistent answers we can compare day-to-day
      max_tokens: 800,
    });

    const durationMs = Date.now() - startedAt;
    const response = completion.choices[0]?.message?.content ?? "";

    const tokensIn = completion.usage?.prompt_tokens ?? 0;
    const tokensOut = completion.usage?.completion_tokens ?? 0;
    const tokensUsed = tokensIn + tokensOut;

    const pricing = PRICING[this.model];
    const costUsd =
      (tokensIn / 1000) * pricing.inputPer1k +
      (tokensOut / 1000) * pricing.outputPer1k;

    return { response, tokensUsed, costUsd, durationMs };
  }
}
