/**
 * Validate bilingual brief JSON from OpenRouter before parsing.
 * Handles JSON fences, stream-abort salvage, and finish_reason=length detection.
 */

export class OpenRouterIncompleteJsonError extends Error {
  readonly modelId: string;
  readonly responseChars: number;
  readonly parseDetail: string;
  readonly finishReason: string | null;

  constructor(
    modelId: string,
    responseChars: number,
    parseDetail: string,
    finishReason: string | null = null,
  ) {
    super(
      `[openrouter] incomplete brief JSON (${modelId}): ${parseDetail} (${responseChars} chars)`,
    );
    this.name = 'OpenRouterIncompleteJsonError';
    this.modelId = modelId;
    this.responseChars = responseChars;
    this.parseDetail = parseDetail;
    this.finishReason = finishReason;
  }
}

export function isOpenRouterIncompleteJsonError(
  error: unknown,
): error is OpenRouterIncompleteJsonError {
  return error instanceof OpenRouterIncompleteJsonError;
}

/** Stream / non-stream validator: returns normalized JSON text. */
export type OpenRouterResponseValidator = (
  modelId: string,
  rawText: string,
  finishReason: string | null,
) => string;

export function tryAcceptStreamedJson(
  content: string,
  validate: OpenRouterResponseValidator,
): string | null {
  try {
    return validate('salvage', content, null);
  } catch {
    return null;
  }
}

/** Strip optional ```json fences some models add despite json_object mode. */
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(trimmed);
  if (fenced) return fenced[1]!.trim();
  return trimmed;
}

/**
 * Parse and validate brief shape. Throws OpenRouterIncompleteJsonError on failure.
 * Returns normalized JSON string (for parseBrief in summarize.ts).
 */
export function validateOpenRouterBriefJson(
  modelId: string,
  rawText: string,
  finishReason: string | null = null,
): string {
  if (finishReason === 'length') {
    throw new OpenRouterIncompleteJsonError(
      modelId,
      rawText.length,
      'output truncated (finish_reason=length)',
      finishReason,
    );
  }

  const text = stripJsonFences(rawText);
  if (!text.startsWith('{')) {
    throw new OpenRouterIncompleteJsonError(
      modelId,
      rawText.length,
      'response does not start with {',
      finishReason,
    );
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object') {
      throw new SyntaxError('root is not an object');
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.items) || obj.items.length === 0) {
      throw new SyntaxError('items missing or empty');
    }
    if (typeof obj.title_en !== 'string' || typeof obj.title_uk !== 'string') {
      throw new SyntaxError('title_en/title_uk missing');
    }
    return text;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new OpenRouterIncompleteJsonError(modelId, rawText.length, detail, finishReason);
  }
}

/** Lenient check for salvage while stream is still open (stall abort). */
export function tryAcceptStreamedBriefJson(content: string): string | null {
  return tryAcceptStreamedJson(content, validateOpenRouterBriefJson);
}

// ─── Shell validator (for per-item variant) ──────────────────────────────────

export type BriefShellJson = {
  title_en: string;
  title_uk: string;
  intro_en: string;
  intro_uk: string;
};

function parseJsonObject(rawText: string, finishReason: string | null, modelId: string): unknown {
  if (finishReason === 'length') {
    throw new OpenRouterIncompleteJsonError(
      modelId,
      rawText.length,
      'output truncated (finish_reason=length)',
      finishReason,
    );
  }
  const text = stripJsonFences(rawText);
  if (!text.startsWith('{')) {
    throw new OpenRouterIncompleteJsonError(
      modelId,
      rawText.length,
      'response does not start with {',
      finishReason,
    );
  }
  return JSON.parse(text) as unknown;
}

export function validateOpenRouterBriefShellJson(modelId: string, rawText: string): BriefShellJson {
  try {
    const parsed = parseJsonObject(rawText, null, modelId) as Record<string, unknown>;
    if (typeof parsed.title_en !== 'string' || typeof parsed.title_uk !== 'string') {
      throw new SyntaxError('title_en/title_uk missing');
    }
    if (typeof parsed.intro_en !== 'string' || typeof parsed.intro_uk !== 'string') {
      throw new SyntaxError('intro_en/intro_uk missing');
    }
    return {
      title_en: parsed.title_en,
      title_uk: parsed.title_uk,
      intro_en: parsed.intro_en,
      intro_uk: parsed.intro_uk,
    };
  } catch (error) {
    if (error instanceof OpenRouterIncompleteJsonError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new OpenRouterIncompleteJsonError(modelId, rawText.length, detail, null);
  }
}

export const validateOpenRouterBriefShellValidator: OpenRouterResponseValidator = (
  modelId,
  rawText,
  finishReason,
) => {
  if (finishReason === 'length') {
    throw new OpenRouterIncompleteJsonError(
      modelId,
      rawText.length,
      'output truncated (finish_reason=length)',
      finishReason,
    );
  }
  return JSON.stringify(validateOpenRouterBriefShellJson(modelId, rawText));
};
