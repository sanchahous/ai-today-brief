import { describe, expect, it } from 'vitest';
import { buildEditorialConceptPrompt } from './card-image';
import type { EditorialEssence, WeeklyReportageSceneBriefResult } from './card-image';
import {
  clauseSafeTake,
  exportManualImagePrompt,
  exportManualImagePrompts,
  FLUX_CRAFT_SPLIT,
  type ImageGrammar,
} from './prompt-export';

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

  it('preserves owner_direction as its own conceptLens instead of collapsing it into literal_context (R2.5 / F12)', () => {
    const prompt = exportManualImagePrompt({
      brief: brief({ conceptLens: 'owner_direction' }),
      essence: CLI_ESSENCE,
    });
    expect(prompt.conceptLens).toBe('owner_direction');
  });

  it('falls back to the "Owner direction" title only when the brief has no metaphorTitle', () => {
    const prompt = exportManualImagePrompt({
      brief: brief({ conceptLens: 'owner_direction', metaphorTitle: undefined }),
      essence: CLI_ESSENCE,
    });
    expect(prompt.title).toBe('Owner direction');
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

  it('the FLUX craft-split marker survives a real buildEditorialConceptPrompt call (R2.4 / F10)', () => {
    // Guards against a card-image.ts prompt-format change silently
    // degrading translateFluxToCanonical to firstSentence() -- if
    // buildEditorialConceptPrompt's output stops containing this literal,
    // this test fails loudly instead of the canonical prompt quietly losing
    // its light/lens/accent extraction with no error anywhere.
    const realFluxPrompt = buildEditorialConceptPrompt(
      'muted teal',
      'A brass adapter card being pushed into a teleprinter terminal expansion slot',
    );
    expect(realFluxPrompt).toContain(FLUX_CRAFT_SPLIT);
  });

  it('canonical prompt length stays within the plan reference range (R2.4 / F11)', () => {
    const longScene = [
      'A brass adapter card being pushed into the expansion slot of a 1970s teleprinter terminal',
      'the contact strip catches a hard rim light while the slot interior stays in shadow',
      'so the act of connection is the brightest thing in the picture',
      'matte industrial plastics, worn enamel, fine dust in a shaft of window light',
      'the visible cause is the card seating fully home, the visible result is the old system running new tools',
    ].join(', ');
    const prompt = exportManualImagePrompt({
      brief: brief({ scene: longScene }),
      essence: CLI_ESSENCE,
      grammar: 'cinematic_domain_scene',
    });
    const wordCount = prompt.canonical.split(/\s+/).filter(Boolean).length;
    // The plan's worked reference (P1) is ~60-120 words; allow headroom for
    // the fixed light/lens/no-text boilerplate sentences without letting a
    // regression silently balloon or collapse the canonical prompt.
    expect(wordCount).toBeGreaterThanOrEqual(40);
    expect(wordCount).toBeLessThanOrEqual(160);
  });

});

describe('clauseSafeTake (R2.4 / F11)', () => {
  it('returns text under the budget unchanged', () => {
    expect(clauseSafeTake('a short scene description', 20)).toBe('a short scene description');
  });

  it('cuts at the last complete clause instead of mid-phrase', () => {
    const text = 'one two three four five, six seven eight nine ten, eleven twelve thirteen';
    // A hard cut at 8 words lands mid "nine ten" clause (words 6-9 of the
    // middle clause); the clause-safe cut backs up to the comma after "five"
    // instead of handing back a scene description that trails off mid-idea.
    expect(clauseSafeTake(text, 8)).toBe('one two three four five');
  });

  it('falls back to the hard word cut when there is no nearby clause boundary', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    expect(clauseSafeTake(text, 8)).toBe('one two three four five six seven eight');
  });

  it('does not over-shorten when the only comma is too close to the start', () => {
    const text = 'lead, ' + Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
    // The comma sits at word 1 of a 20-word budget -- backing up there would
    // throw away almost the whole scene. The 40%-of-length guard should
    // reject that and keep the hard cut instead.
    const result = clauseSafeTake(text, 15);
    expect(result.split(' ')).toHaveLength(15);
  });
});
