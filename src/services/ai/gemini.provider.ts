import axios from "axios";
import { env } from "@/utils/env.util";
import type {
  AIProvider,
  ProviderPricing,
  ProviderRunInput,
  ProviderRunOutput,
} from "./types";

const PRICING: Record<"gemini-pro" | "gemini-flash", ProviderPricing> = {
  "gemini-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
  "gemini-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
};

const MODEL_ID: Record<"gemini-pro" | "gemini-flash", string> = {
  "gemini-pro": "gemini-1.5-pro-latest",
  "gemini-flash": "gemini-1.5-flash-latest",
};

export class GeminiProvider implements AIProvider {
  constructor(public readonly model: "gemini-pro" | "gemini-flash") {}

  get displayName(): string {
    return this.model === "gemini-pro" ? "Google · Gemini 1.5 Pro" : "Google · Gemini 1.5 Flash";
  }

  isConfigured(): boolean {
    return Boolean(env.GOOGLE_AI_KEY);
  }

  async run(input: ProviderRunInput): Promise<ProviderRunOutput> {
    if (!env.GOOGLE_AI_KEY) {
      throw new Error("GOOGLE_AI_KEY is not configured");
    }
    const startedAt = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID[this.model]}:generateContent?key=${env.GOOGLE_AI_KEY}`;

    const { data } = await axios.post(url, {
      systemInstruction: input.context
        ? { role: "system", parts: [{ text: input.context }] }
        : undefined,
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
    });

    const durationMs = Date.now() - startedAt;
    const candidate = data?.candidates?.[0];
    const response: string =
      candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

    const tokensIn: number = data?.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut: number = data?.usageMetadata?.candidatesTokenCount ?? 0;
    const tokensUsed = tokensIn + tokensOut;

    const pricing = PRICING[this.model];
    const costUsd =
      (tokensIn / 1000) * pricing.inputPer1k +
      (tokensOut / 1000) * pricing.outputPer1k;

    return { response, tokensUsed, costUsd, durationMs };
  }
}
