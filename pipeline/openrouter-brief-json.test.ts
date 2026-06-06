import { describe, it, expect } from 'vitest';
import {
  validateOpenRouterBriefJson,
  OpenRouterIncompleteJsonError,
  isOpenRouterIncompleteJsonError,
  stripJsonFences,
  tryAcceptStreamedBriefJson,
  validateOpenRouterBriefShellJson,
} from './openrouter-brief-json';

const VALID_BRIEF = JSON.stringify({
  title_en: 'AI Breakthroughs',
  title_uk: 'Проривні AI',
  intro_en: 'Today in AI.',
  intro_uk: 'Сьогодні в AI.',
  items: [
    {
      ref: 1,
      category_slug: 'models',
      title_en: 'GPT-5 Released',
      title_uk: 'GPT-5 випущено',
      summary_en: 'OpenAI released GPT-5.',
      summary_uk: 'OpenAI випустила GPT-5.',
      why_matters_en: 'Better reasoning.',
      why_matters_uk: 'Краще мислення.',
      deep_dive_en: 'Details here.',
      deep_dive_uk: 'Деталі тут.',
      takeaways_en: ['Point one'],
      takeaways_uk: ['Пункт один'],
      tools_mentioned: [],
    },
  ],
});

describe('validateOpenRouterBriefJson', () => {
  it('accepts valid brief JSON', () => {
    const result = validateOpenRouterBriefJson('model-a', VALID_BRIEF);
    expect(JSON.parse(result)).toEqual(JSON.parse(VALID_BRIEF));
  });

  it('strips json fences before validating', () => {
    const fenced = '```json\n' + VALID_BRIEF + '\n```';
    const result = validateOpenRouterBriefJson('model-a', fenced);
    expect(JSON.parse(result)).toEqual(JSON.parse(VALID_BRIEF));
  });

  it('strips plain code fences', () => {
    const fenced = '```\n' + VALID_BRIEF + '\n```';
    const result = validateOpenRouterBriefJson('model-a', fenced);
    expect(JSON.parse(result)).toEqual(JSON.parse(VALID_BRIEF));
  });

  it('throws on finish_reason=length', () => {
    expect(() =>
      validateOpenRouterBriefJson('model-a', '{"title_en":"x"', 'length'),
    ).toThrow(OpenRouterIncompleteJsonError);
  });

  it('throws when response does not start with {', () => {
    expect(() =>
      validateOpenRouterBriefJson('model-a', 'Sorry, I cannot generate that.'),
    ).toThrow(OpenRouterIncompleteJsonError);
  });

  it('throws on invalid JSON', () => {
    expect(() => validateOpenRouterBriefJson('model-a', '{"title_en": }')).toThrow(
      OpenRouterIncompleteJsonError,
    );
  });

  it('throws when items array is missing', () => {
    const noItems = JSON.stringify({ title_en: 'x', title_uk: 'y' });
    expect(() => validateOpenRouterBriefJson('model-a', noItems)).toThrow(
      OpenRouterIncompleteJsonError,
    );
  });

  it('throws when items array is empty', () => {
    const emptyItems = JSON.stringify({ title_en: 'x', title_uk: 'y', items: [] });
    expect(() => validateOpenRouterBriefJson('model-a', emptyItems)).toThrow(
      OpenRouterIncompleteJsonError,
    );
  });

  it('throws when title_en/title_uk are missing', () => {
    const noTitles = JSON.stringify({ items: [{ ref: 1 }] });
    expect(() => validateOpenRouterBriefJson('model-a', noTitles)).toThrow(
      OpenRouterIncompleteJsonError,
    );
  });

  it('includes modelId and responseChars in error', () => {
    try {
      validateOpenRouterBriefJson('my-model', 'not json');
    } catch (e) {
      expect(e).toBeInstanceOf(OpenRouterIncompleteJsonError);
      const err = e as OpenRouterIncompleteJsonError;
      expect(err.modelId).toBe('my-model');
      expect(err.responseChars).toBe('not json'.length);
    }
  });
});

describe('OpenRouterIncompleteJsonError', () => {
  it('has correct name and properties', () => {
    const err = new OpenRouterIncompleteJsonError('m', 42, 'bad json', 'length');
    expect(err.name).toBe('OpenRouterIncompleteJsonError');
    expect(err.modelId).toBe('m');
    expect(err.responseChars).toBe(42);
    expect(err.parseDetail).toBe('bad json');
    expect(err.finishReason).toBe('length');
    expect(err.message).toContain('m');
    expect(err.message).toContain('42');
  });

  it('defaults finishReason to null', () => {
    const err = new OpenRouterIncompleteJsonError('m', 0, 'd');
    expect(err.finishReason).toBeNull();
  });
});

describe('isOpenRouterIncompleteJsonError', () => {
  it('returns true for correct instance', () => {
    expect(isOpenRouterIncompleteJsonError(new OpenRouterIncompleteJsonError('m', 0, 'd'))).toBe(
      true,
    );
  });

  it('returns false for plain Error', () => {
    expect(isOpenRouterIncompleteJsonError(new Error('nope'))).toBe(false);
  });
});

describe('stripJsonFences', () => {
  it('strips ```json fences', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips plain ``` fences', () => {
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('returns plain text unchanged', () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}');
  });

  it('trims outer whitespace', () => {
    expect(stripJsonFences('  {"a":1}  ')).toBe('{"a":1}');
  });

  it('handles case-insensitive JSON tag', () => {
    expect(stripJsonFences('```JSON\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe('tryAcceptStreamedBriefJson', () => {
  it('returns normalized text for valid JSON', () => {
    const result = tryAcceptStreamedBriefJson(VALID_BRIEF);
    expect(result).not.toBeNull();
  });

  it('returns null for incomplete JSON', () => {
    expect(tryAcceptStreamedBriefJson('{"title_en": "partial')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(tryAcceptStreamedBriefJson('')).toBeNull();
  });
});

describe('validateOpenRouterBriefShellJson', () => {
  it('accepts valid shell JSON', () => {
    const raw = JSON.stringify({
      title_en: 'AI Today',
      title_uk: 'AI Сьогодні',
      intro_en: 'A sentence.',
      intro_uk: 'Речення.',
    });
    const result = validateOpenRouterBriefShellJson('m', raw);
    expect(result.title_en).toBe('AI Today');
    expect(result.intro_uk).toBe('Речення.');
  });

  it('throws on missing intro fields', () => {
    const raw = JSON.stringify({ title_en: 'x', title_uk: 'y' });
    expect(() => validateOpenRouterBriefShellJson('m', raw)).toThrow(OpenRouterIncompleteJsonError);
  });
});
