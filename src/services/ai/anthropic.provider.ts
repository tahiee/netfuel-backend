import axios from "axios";
import { env } from "@/utils/env.util";
import type {
  AIProvider,
  ProviderPricing,
  ProviderRunInput,
  ProviderRunOutput,
} from "./types";

const PRICING: Record<"claude-3-5-sonnet" | "claude-3-haiku", ProviderPricing> = {
  "claude-3-5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-haiku": { inputPer1k: 0.00025, outputPer1k: 0.00125 },
};

const MODEL_ID: Record<"claude-3-5-sonnet" | "claude-3-haiku", string> = {
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-haiku": "claude-3-haiku-20240307",
};

export class AnthropicProvider implements AIProvider {
  constructor(public readonly model: "claude-3-5-sonnet" | "claude-3-haiku") {}

  get displayName(): string {
    return this.model === "claude-3-5-sonnet"
      ? "Anthropic · Claude 3.5 Sonnet"
      : "Anthropic · Claude 3 Haiku";
  }

  isConfigured(): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    const startedAt = Date.now();

    const { data } = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: MODEL_ID[this.model],
        max_tokens: 800,
        temperature: 0.2,
        system: input.context ?? undefined,
        messages: [{ role: "user", content: input.prompt }],
      },
      {
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      }
    );

    const durationMs = Date.now() - startedAt;
    const response: string =
      Array.isArray(data?.content)
        ? data.content
            .filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("\n")
        : "";

    const tokensIn: number = data?.usage?.input_tokens ?? 0;
    const tokensOut: number = data?.usage?.output_tokens ?? 0;
    const tokensUsed = tokensIn + tokensOut;

    const pricing = PRICING[this.model];
    const costUsd =
      (tokensIn / 1000) * pricing.inputPer1k +
      (tokensOut / 1000) * pricing.outputPer1k;

    return { response, tokensUsed, costUsd, durationMs };
  }
}
