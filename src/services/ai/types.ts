/**
 * Common interface every AI provider implements. Keeps the executor agnostic
 * to which model it's calling — register a new provider by adding a file in
 * this folder and wiring it into `provider-registry.ts`.
 */

export type SupportedModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gemini-pro"
  | "gemini-flash"
  | "claude-3-5-sonnet"
  | "claude-3-haiku"
  | "perplexity-sonar"
  | "perplexity-sonar-pro"
  | "grok-2"
  | "llama-3";

export interface ProviderRunInput {
  prompt: string;
  /** Optional system / context message prepended before the user prompt. */
  context?: string | null;
}

export interface ProviderRunOutput {
  /** Full text response from the model. */
  response: string;
  /** Total tokens consumed (input + output combined when the API doesn't split). */
  tokensUsed: number;
  /** Cost in USD calculated from the provider's pricing table. */
  costUsd: number;
  /** Wall-clock time of the API call in milliseconds. */
  durationMs: number;
}

export interface AIProvider {
  /** The canonical model id used in DB / UI (e.g. "gpt-4o"). */
  readonly model: SupportedModel;
  /** Human-readable name for logs ("OpenAI · GPT-4o"). */
  readonly displayName: string;
  /** Whether this provider has the credentials it needs to actually run. */
  isConfigured(): boolean;
  /** Execute the prompt. Throws on API errors — caller wraps in try/catch. */
  run(input: ProviderRunInput): Promise<ProviderRunOutput>;
}

/** Per-1k-token pricing (USD). Cost = (tokensIn/1000)*input + (tokensOut/1000)*output. */
export interface ProviderPricing {
  inputPer1k: number;
  outputPer1k: number;
}
