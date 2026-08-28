import { describe, expect, it } from 'vitest';
import {
  assembleFluxCardPrompt,
  assembleNotes,
  assembleSixBlocks,
  specFromBrief,
} from './assemble';
import { routeSeatTemplates, routeTemplate } from './route';
import { headNoun, stripPlanningPhrases } from './text';

/** Live weekly collapse: two titles, one sun-printing frame (digest 71af784b). */
const SUN_PRINTING_SUBJECT = 'A sun-printing frame exposing one large glass negative';
const SUN_PRINTING_SCENE =
  'A sun-printing frame exposing one large glass negative, the story-specific anchor is ' +
  'One glass tool-chain negative, a 76-tick log, and an empty cached-print tray, the visible cause is ' +
  'Each sheet gets a full exposure from the same negative and is';
const CACHE_ESSENCE_MECHANISM =
  'Repeated transmission of a large, stable instruction prefix as full-price cache-write tokens on every request.';
const CACHE_ESSENCE_CONSEQUENCE =
  "Teams should audit per-turn token usage now; the 85% figure is from one user's telemetry, not an invoice, so the true scope remains uncertain.";

describe('stripPlanningPhrases', () => {
  it('drops story-specific-anchor / visible-cause clauses from the live weekly dump', () => {
    const cleaned = stripPlanningPhrases(SUN_PRINTING_SCENE);
    expect(cleaned.toLowerCase()).toContain('sun-printing frame');
    expect(cleaned.toLowerCase()).not.toContain('story-specific anchor is');
    expect(cleaned.toLowerCase()).not.toContain('visible cause is');
  });
});

describe('specFromBrief + assembleSixBlocks (collapse fixture)', () => {
  it('diagram canonical never dumps essence.mechanism or essence.consequence', () => {
    const spec = specFromBrief({
      conceptLens: 'mechanism',
      grammar: 'deterministic_technical_hybrid',
      templateId: 'infographic-engine',
      subject: SUN_PRINTING_SUBJECT,
      action: 'exposing every fresh sheet from one glass negative',
      setting: 'sun-printing workshop with an empty cached-print tray',
      scene: SUN_PRINTING_SCENE,
    });
    const canonical = assembleSixBlocks(spec);
    expect(canonical.toLowerCase()).toMatch(/technical editorial comparison/);
    expect(canonical.toLowerCase()).toMatch(/unlabelled physical geometry/);
    expect(canonical.toLowerCase()).not.toMatch(/3-5 callout zones/);
    expect(canonical).toMatch(/no writing of any kind/i);
    expect(canonical).not.toMatch(/story-specific anchor is/i);
    expect(canonical).not.toMatch(/visible cause is/i);
    expect(canonical).not.toContain(CACHE_ESSENCE_MECHANISM);
    expect(canonical).not.toContain('Teams should audit');
    expect(canonical).not.toContain('full-price cache-write tokens');
    expect(canonical).not.toMatch(/and is\./);
  });

  it('sanitizes planning prose from every renderable field, not only scene', () => {
    const canonical = assembleSixBlocks(
      specFromBrief({
        conceptLens: 'literal_context',
        templateId: 'realistic-photography',
        scene: 'a concrete control room, the literal story context is an internal draft',
        subject: 'a concrete control room, the literal story context is an internal draft',
        action: 'show the physical causal process clearly: a valve closes',
        setting: 'make its grounded result unmistakable: a quiet server bay',
      }),
    ).toLowerCase();

    expect(canonical).not.toContain('literal story context is');
    expect(canonical).not.toContain('physical causal process clearly');
    expect(canonical).not.toContain('grounded result unmistakable');
  });

  it('photography canonical leads with the subject, not with style words', () => {
    const spec = specFromBrief({
      conceptLens: 'literal_context',
      grammar: 'cinematic_domain_scene',
      templateId: 'realistic-photography',
      subject: 'A brass adapter card',
      action: 'being pushed into a 1970s teleprinter expansion slot',
      setting: 'close three-quarter workshop view',
    });
    const canonical = assembleSixBlocks(spec);
    expect(canonical.toLowerCase().startsWith('task: photographic reportage of a brass adapter card')).toBe(
      true,
    );
  });
});

describe('routeSeatTemplates', () => {
  it('assigns three different templates to the three seats', () => {
    const assigned = routeSeatTemplates({
      lenses: ['literal_context', 'mechanism', 'consequence'],
      grammarByLens: { mechanism: 'deterministic_technical_hybrid' },
      headline: 'Cache writes cost 85% of the bill',
      summary: 'A large stable instruction prefix is retransmitted on every request.',
    });
    const ids = [
      assigned.literal_context,
      assigned.mechanism,
      assigned.consequence,
    ].filter(Boolean);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(assigned.mechanism).toBe('infographic-engine');
  });

  it('does not reuse an already occupied template for owner_direction alternatives', () => {
    const assigned = routeSeatTemplates({
      lenses: ['mechanism', 'consequence'],
      occupied: ['realistic-photography'],
      headline: 'A plugin ships overnight',
      summary: 'Developers resume after a crash.',
    });
    expect(assigned.mechanism).not.toBe('realistic-photography');
    expect(assigned.consequence).not.toBe('realistic-photography');
    expect(assigned.mechanism).not.toBe(assigned.consequence);
  });
});

describe('routeTemplate', () => {
  it('picks infographic-engine for a metric mechanism seat', () => {
    expect(
      routeTemplate({
        lens: 'mechanism',
        grammar: 'deterministic_technical_hybrid',
      }),
    ).toBe('infographic-engine');
  });
});

describe('subject-head orthogonality (sun-printing ×2)', () => {
  it('the same head noun on two seats is a collision', () => {
    expect(headNoun(SUN_PRINTING_SUBJECT)).toBe('negative');
    expect(headNoun('A sun-printing frame exposing one large glass negative')).toBe('negative');
  });
});

describe('assembleNotes', () => {
  it('keeps mechanism/reader-test in notes, not as a reason to dump essence into pixels', () => {
    const notes = assembleNotes({
      templateId: 'infographic-engine',
      mechanism: CACHE_ESSENCE_MECHANISM,
      readerTest: CACHE_ESSENCE_CONSEQUENCE,
    });
    expect(notes.some((note) => /deterministic overlay/i.test(note))).toBe(true);
    expect(notes.join(' ')).toMatch(/overlay/i);
  });
});

describe('assembleFluxCardPrompt', () => {
  it('keeps the news scene and bans typography', () => {
    const prompt = assembleFluxCardPrompt('violet purple', 'a cracked padlock over a server rack');
    expect(prompt).toContain('violet purple');
    expect(prompt).toContain('a cracked padlock over a server rack');
    expect(prompt.toLowerCase()).toContain('no typography');
    expect(prompt).toContain('16:9');
  });
});
