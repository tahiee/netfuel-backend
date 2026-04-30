import { AnthropicProvider } from "./anthropic.provider";
import { GeminiProvider } from "./gemini.provider";
import { OpenAIProvider } from "./openai.provider";
import { PerplexityProvider } from "./perplexity.provider";
import type { AIProvider, SupportedModel } from "./types";

/**
 * Maps a model id (as stored in `brandQueries.targetModels`) to the provider
 * instance that knows how to call it. Unknown / unimplemented models return
 * `null` so the executor can record a "provider not configured" run instead
 * of crashing the whole batch.
 *
 * Provider instances are cached per-model so we don't re-spin SDK clients
 * on every executor run.
 */
const cache = new Map<SupportedModel, AIProvider>();

export function getProvider(model: SupportedModel): AIProvider | null {
  const cached = cache.get(model);
  if (cached) return cached;

  let provider: AIProvider | null = null;

  switch (model) {
    case "gpt-4o":
    case "gpt-4o-mini":
      provider = new OpenAIProvider(model);
      break;
    case "claude-3-5-sonnet":
    case "claude-3-haiku":
      provider = new AnthropicProvider(model);
      break;
    case "gemini-pro":
    case "gemini-flash":
      provider = new GeminiProvider(model);
      break;
    case "perplexity-sonar":
    case "perplexity-sonar-pro":
      provider = new PerplexityProvider(model);
      break;
    case "grok-2":
    case "llama-3":
      // Stubs — these models aren't wired yet. Executor will record a
      // `status: "error"` run with a clear message until we add providers.
      provider = null;
      break;
  }

  if (provider) cache.set(model, provider);
  return provider;
}
