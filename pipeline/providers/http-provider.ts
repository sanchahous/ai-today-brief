/**
 * Generic OpenAI-compatible HTTP provider adapter. `generateWithOpenRouterChain`
 * (pipeline/openrouter-summarize.ts) already speaks standard OpenAI
 * `chat/completions` JSON in and out -- the only OpenRouter-proprietary
 * pieces are its base URL, two app-attribution headers, and its `usage.cost`
 * field (which degrades to null for any provider that doesn't report it,
 * not a hard failure). This module is a thin, provider-agnostic wrapper over
 * that same request/response logic, parameterized by base URL + API key +
 * an explicit model list (no live catalog assumed -- see the module doc on
 * why catalog-less providers like NVIDIA NIM can't use OpenRouter's
 * live-fetch-and-rank approach).
 *
 * See wiki/pipeline/llm-providers.md for the full registry plan this is
 * Phase 1 of.
 */

import { generateWithOpenRouterChain } from '../openrouter-summarize';
import {
  OpenRouterIncompleteJsonError,
  type OpenRouterResponseValidator,
} from '../openrouter-brief-json';
import type { ProviderCallResult } from './types';
import { openRouterPriceRouting } from '../openrouter-provider-routing';

export interface HttpProviderConfig {
  /** Stable id: 'openrouter' | 'nim' | an owner-defined slug. Used in logs and the cost ledger. */
  id: string;
  /** Base URL through .../v1 — '/chat/completions' is appended by the underlying client. */
  baseUrl: string;
  apiKey: string;
  /** Ordered model ids to try. Live-ranked for OpenRouter by the caller; hand-configured for catalog-less providers. */
  modelQueue: string[];
  extraHeaders?: Record<string, string>;
  /** OpenRouter reports usage.cost; a bare OpenAI-compatible endpoint like NIM does not. */
  reportsCost?: boolean;
  /**
   * When false, skip `provider.sort: "price"` even if `id` is `openrouter`.
   * NIM and other catalog-less HTTP providers never set this.
   */
  routeOpenRouterProvider?: boolean;
  /** Low-uptime provider slugs to ignore. Empty = sort by price with no ignore list. */
  openRouterIgnoreProviders?: readonly string[];
  openRouterMaxLatencyS?: number;
}

/** OpenRouter's own defaults — passing this reproduces generateWithOpenRouterChain's exact current behavior. */
export const OPENROUTER_HTTP_DEFAULTS = {
  baseUrl: 'https://openrouter.ai/api/v1',
  extraHeaders: {
    'HTTP-Referer': 'https://aitodaybrief.com',
    'X-Title': 'AI Today Brief Pipeline',
  },
  reportsCost: true,
} as const;

/** NVIDIA NIM: free-tier OpenAI-compatible endpoint, no card required. No usage.cost, no live catalog. */
export const NIM_HTTP_DEFAULTS = {
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  reportsCost: false,
} as const;

function mergeOpenRouterProviderBody(
  cfg: HttpProviderConfig,
  callerExtra: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (cfg.id !== 'openrouter' || cfg.routeOpenRouterProvider === false) return callerExtra;
  const routing = openRouterPriceRouting({
    ignore: cfg.openRouterIgnoreProviders,
    maxLatencyS: cfg.openRouterMaxLatencyS,
  });
  const callerProvider =
    callerExtra &&
    typeof callerExtra.provider === 'object' &&
    callerExtra.provider !== null &&
    !Array.isArray(callerExtra.provider)
      ? (callerExtra.provider as Record<string, unknown>)
      : {};
  return {
    ...callerExtra,
    provider: { ...routing, ...callerProvider },
  };
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

/** Generic pass-through validator: no domain JSON shape assumed, unlike OpenRouter's brief-JSON default. */
const passthroughValidator: OpenRouterResponseValidator = (modelId, rawText, finishReason) => {
  // Typed rather than a bare SyntaxError so the chain can tell "ran out of
  // room" (retry this model wider) from "wrong shape" (try another model).
  if (finishReason === 'length') {
    throw new OpenRouterIncompleteJsonError(
      modelId,
      rawText.length,
      'truncated completion',
      finishReason,
    );
  }
  return rawText.trim();
};

/** Try each configured model in order against one OpenAI-compatible HTTP provider. */
export async function generateWithHttpProviderChain(
  prompt: string,
  cfg: HttpProviderConfig,
  options?: {
    validateResponse?: OpenRouterResponseValidator;
    extraBodyForModel?: (modelId: string, attempt: number) => Record<string, unknown> | undefined;
    /** Retry a model once with a wider ceiling when its answer was cut off. */
    retryTruncatedOnce?: boolean;
  },
): Promise<ProviderCallResult> {
  const reportsCost = cfg.reportsCost ?? false;
  // buildChatBody() (openrouter-summarize.ts) unconditionally requests
  // `usage: { include: true }` -- an OpenRouter-proprietary field. Live
  // verification against NVIDIA NIM (2026-08-06) found this is NOT a
  // graceful no-op everywhere: NIM validates request bodies strictly and
  // returns HTTP 400 "Unsupported parameter(s): `usage`" for any provider
  // that doesn't report cost. `extraBody` is spread after the base fields in
  // buildChatBody, so `usage: undefined` here overwrites it and
  // JSON.stringify drops the key entirely (it does not send `"usage":null`).
  // The streaming path (openrouter-adaptive.ts's streamOpenRouterCompletion)
  // used to re-add `usage: { include: true }` a second time independently of
  // buildChatBody's result -- also fixed, or this override would have been
  // silently discarded there.
  const extraBodyForModel = (modelId: string, attempt: number) => {
    const callerExtra = mergeOpenRouterProviderBody(
      cfg,
      options?.extraBodyForModel?.(modelId, attempt),
    );
    return reportsCost ? callerExtra : { ...callerExtra, usage: undefined };
  };
  const result = await generateWithOpenRouterChain(prompt, {
    apiKey: cfg.apiKey,
    modelQueue: cfg.modelQueue,
    validateResponse: options?.validateResponse ?? passthroughValidator,
    extraBodyForModel,
    retryTruncatedOnce: options?.retryTruncatedOnce ?? false,
    requestConfig: {
      url: chatCompletionsUrl(cfg.baseUrl),
      headers: cfg.extraHeaders,
    },
  });
  return {
    text: result.text,
    provider: cfg.id,
    model: result.model,
    usage: {
      promptTokens: result.usage?.promptTokens ?? null,
      outputTokens: result.usage?.completionTokens ?? null,
      costUsd: reportsCost ? (result.usage?.costUsd ?? null) : null,
      costSource: reportsCost && result.usage ? 'reported' : 'estimated',
    },
    discarded: (result.discardedUsage ?? []).map((usage) => ({
      promptTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
      costUsd: reportsCost ? usage.costUsd : null,
      costSource: reportsCost ? ('reported' as const) : ('estimated' as const),
    })),
  };
}
