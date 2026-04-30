import axios from "axios";
import { env } from "@/utils/env.util";
import type {
  AIProvider,
  ProviderPricing,
  ProviderRunInput,
  ProviderRunOutput,
} from "./types";

const PRICING: Record<"perplexity-sonar" | "perplexity-sonar-pro", ProviderPricing> = {
  "perplexity-sonar": { inputPer1k: 0.001, outputPer1k: 0.001 },
  "perplexity-sonar-pro": { inputPer1k: 0.003, outputPer1k: 0.015 },
};

const MODEL_ID: Record<"perplexity-sonar" | "perplexity-sonar-pro", string> = {
  "perplexity-sonar": "sonar",
  "perplexity-sonar-pro": "sonar-pro",
};

export class PerplexityProvider implements AIProvider {
  constructor(public readonly model: "perplexity-sonar" | "perplexity-sonar-pro") {}

  get displayName(): string {
    return this.model === "perplexity-sonar"
      ? "Perplexity · Sonar"
      : "Perplexity · Sonar Pro";
  }

  isConfigured(): boolean {
    return Boolean(env.PERPLEXITY_API_KEY);
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    if (!env.PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    }
    const startedAt = Date.now();

    const messages: { role: "system" | "user"; content: string }[] = [];
    if (input.context) {
      messages.push({ role: "system", content: input.context });
    }
    messages.push({ role: "user", content: input.prompt });

    const { data } = await axios.post(
      "https://api.perplexity.ai/chat/completions",
      {
        model: MODEL_ID[this.model],
        messages,
        temperature: 0.2,
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
          "content-type": "application/json",
        },
      }
    );

    const durationMs = Date.now() - startedAt;
    const response: string = data?.choices?.[0]?.message?.content ?? "";
    const tokensIn: number = data?.usage?.prompt_tokens ?? 0;
    const tokensOut: number = data?.usage?.completion_tokens ?? 0;
    const tokensUsed = tokensIn + tokensOut;

    const pricing = PRICING[this.model];
    const costUsd =
      (tokensIn / 1000) * pricing.inputPer1k +
      (tokensOut / 1000) * pricing.outputPer1k;

    return { response, tokensUsed, costUsd, durationMs };
  }
}
