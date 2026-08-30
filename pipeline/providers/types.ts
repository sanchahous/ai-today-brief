/**
 * Shared result/error shapes for every provider adapter (http-provider.ts,
 * cli-provider.ts, gemini-provider.ts) and the registry that dispatches
 * across them (registry.ts). See wiki/pipeline/llm-providers.md for why
 * this module exists and the phased migration plan.
 */

export interface ProviderUsage {
  promptTokens: number | null;
  outputTokens: number | null;
  /** Real billed USD when the provider reports it (e.g. OpenRouter's usage.cost). Null = unknown. */
  costUsd: number | null;
  /**
   * 'reported' = real billed cost from the provider's own usage payload.
   * 'estimated' = char-count-derived guess, used only when the provider
   * doesn't report real cost. 'subscription' = ran via a CLI subscription
   * tier (Claude Code, Codex) — real work happened, draws down a plan
   * allowance rather than a metered budget; costUsd is always 0 here and
   * must never be conflated with a genuine $0 'reported' price.
   */
  costSource: 'reported' | 'estimated' | 'subscription';
}

export interface ProviderCallResult {
  /** Raw text only — adapters never parse domain JSON shape; callers validate/parse their own schema. */
  text: string;
  /** Stable provider id for logs + generation_cost_events.provider, e.g. 'gemini', 'openrouter', 'nim', 'claude-cli'. */
  provider: string;
  /** Concrete model id actually used. */
  model: string;
  usage: ProviderUsage;
  /**
   * Billed usage from earlier models in the chain whose answer was rejected.
   * A metered provider charges for a discarded answer exactly like a kept one,
   * so a caller that books only `usage` under-reports real spend — that is how
   * $8.09 of an $8.74 day went unrecorded on 2026-08-28. Empty for providers
   * that answer on the first try or don't report cost.
   */
  discarded?: ProviderUsage[];
}

/**
 * Thrown by any adapter to mean "not usable right now" (no key configured,
 * no CLI binary found, no base url) — distinct from a mid-call failure so a
 * chain-walker can log it as a fast, expected skip rather than a retry-worthy
 * error. Mirrors pipeline/claude-cli.ts's ClaudeCliUnavailableError pattern,
 * generalized across provider kinds.
 */
export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerId: string,
    reason: string,
  ) {
    super(`UNCONFIGURED:${providerId}: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}
