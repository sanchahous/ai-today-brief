import { describe, expect, it } from 'vitest';
import type { EditorialEssence, WeeklyReportageSceneBriefResult } from './card-image';
import { exportManualImagePrompt, exportManualImagePrompts, type ImageGrammar } from './prompt-export';

/** Production `prompt-export.ts` must not contain these literals (F5). */
const MODEL_VERSION_TOKEN = /sonnet-5|gpt-5|gemini-3\.[0-9]|--v\s*\d/i;

const CLI_ESSENCE: EditorialEssence = {
  storyContext:
    "Simon Willison's llm-anthropic plugin brings Claude server-side tools to the command line.",
  meaning: 'Tools that lived on the server now run from a local CLI.',
  essence: 'Server-side tools become usable from the command line.',
  mustFeel: 'precise connection',
  forbiddenCliches: [],
  mechanism: 'A CLI plugin exposes server-side tools through a local command.',
  consequence: 'Developers invoke those tools from the command line without a separate service.',
  visualThesis:
    'A brass adapter card connecting into a teleprinter terminal lets the old system run new tools.',
  readerTest: 'grasp: server-side tools now plug into the command line',
};

function brief(partial: Partial<WeeklyReportageSceneBriefResult>): WeeklyReportageSceneBriefResult {
  return {
    scene:
      'A brass adapter card being pushed into the expansion slot of a 1970s teleprinter terminal, close three-quarter view, hands of a single engineer in frame',
    source: 'openrouter',
    conceptLens: 'mechanism',
    metaphorTitle: 'Teleprinter adapter',
    visibleMechanism: 'the card is half inserted; the contact strip is the brightest thing',
    readerTest: 'a reader should see a tool connecting to an old system',
    ...partial,
  };
}

describe('exportManualImagePrompt', () => {
  it('canonical prompt leads with the subject, not with the style', () => {
    const prompt = exportManualImagePrompt({
      brief: brief({}),
      essence: CLI_ESSENCE,
      accent: 'muted teal',
      grammar: 'cinematic_domain_scene',
    });
    const lead = prompt.canonical.slice(0, 80).toLowerCase();
    expect(lead.startsWith('a brass adapter card')).toBe(true);
    expect(lead).not.toMatch(/^(editorial|photoreal|illustration|cinematic|technical diagram)\b/);
    expect(prompt.canonical).toMatch(/no writing of any kind/i);
  });

  it('midjourney line carries the aspect ratio and the no-text flag', () => {
    const prompt = exportManualImagePrompt({
      brief: brief({}),
      essence: CLI_ESSENCE,
    });
    expect(prompt.midjourney).toContain('--ar 16:9');
    expect(prompt.midjourney).toMatch(/--style raw/);
    expect(prompt.midjourney).toMatch(/--no text/);
    expect(prompt.aspectRatio).toBe('16:9');
  });

  it('negative prompt always bans text, letters and logos', () => {
    const prompt = exportManualImagePrompt({
      brief: brief({}),
      essence: CLI_ESSENCE,
    });
    const negative = prompt.negative.toLowerCase();
    expect(negative).toMatch(/\btext\b/);
    expect(negative).toMatch(/\bletters\b/);
    expect(negative).toMatch(/\blogos?\b/);
    expect(negative).toContain('no watermarks');
    expect(negative).toMatch(/\bui\b/);
  });

  it('no model version numbers appear in any exported form', () => {
    const grammars: ImageGrammar[] = [
      'cinematic_domain_scene',
      'deterministic_technical_hybrid',
      'source_led_fallback',
    ];
    for (const grammar of grammars) {
      const prompt = exportManualImagePrompt({
        brief: brief({}),
        essence: CLI_ESSENCE,
        grammar,
      });
      const blob = [prompt.canonical, prompt.midjourney, prompt.negative, ...prompt.notes].join(
        '\n',
      );
      expect(blob).not.toMatch(MODEL_VERSION_TOKEN);
    }
  });

  it('three concepts of one story export three copy-ready prompts', () => {
    const prompts = exportManualImagePrompts(
      [
        brief({
          conceptLens: 'literal_context',
          metaphorTitle: 'Cartridge in the port',
          scene: 'A slim adapter cartridge seated in a teleprinter expansion port',
        }),
        brief({
          conceptLens: 'mechanism',
          metaphorTitle: 'Teleprinter adapter',
        }),
        brief({
          conceptLens: 'consequence',
          metaphorTitle: 'One connected tool',
          scene: 'A single engineer pressing one physical terminal button after the adapter seats',
        }),
      ],
      CLI_ESSENCE,
      'muted teal',
    );
    expect(prompts).toHaveLength(3);
    expect(prompts.map((row) => row.conceptLens)).toEqual([
      'literal_context',
      'mechanism',
      'consequence',
    ]);
    expect(new Set(prompts.map((row) => row.canonical)).size).toBe(3);
    for (const row of prompts) {
      expect(row.notes.length).toBeGreaterThanOrEqual(2);
      expect(row.notes.length).toBeLessThanOrEqual(4);
      expect(row.midjourney).toContain('--ar 16:9');
      expect(row.negative.toLowerCase()).toMatch(/\btext\b/);
    }
  });

  it('diagram grammar describes elements and arrows instead of a photograph', () => {
    const prompt = exportManualImagePrompt({
      brief: brief({}),
      essence: CLI_ESSENCE,
      grammar: 'deterministic_technical_hybrid',
    });
    expect(prompt.grammar).toBe('deterministic_technical_hybrid');
    expect(prompt.canonical.toLowerCase()).toMatch(/diagram/);
    expect(prompt.canonical.toLowerCase()).toMatch(/arrow/);
    expect(prompt.notes.some((note) => /diagram/i.test(note))).toBe(true);
  });

  it('exportManualImagePrompts writes each brief grammar instead of one cinematic default', () => {
    const prompts = exportManualImagePrompts(
      [
        brief({ grammar: 'cinematic_domain_scene' }),
        brief({
          grammar: 'deterministic_technical_hybrid',
          scene: 'Boxes for CLI plugin, server tools, and local command with arrows between them',
        }),
        brief({ grammar: 'source_led_fallback' }),
      ],
      CLI_ESSENCE,
    );
    expect(prompts.map((row) => row.grammar)).toEqual([
      'cinematic_domain_scene',
      'deterministic_technical_hybrid',
      'source_led_fallback',
    ]);
    expect(prompts[1]?.canonical.toLowerCase()).toMatch(/diagram/);
    expect(prompts[2]?.canonical.toLowerCase()).toMatch(/source story/);
  });
});
