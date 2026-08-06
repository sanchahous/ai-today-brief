import { describe, expect, it } from 'vitest';
import {
  BANNED_PHRASES_EN,
  BANNED_PHRASES_UK,
  CONTRAST_PAIRS_EN,
  CONTRAST_PAIRS_UK,
  bannedPhrasesFor,
  voicePromptBlock,
} from './editorial-voice';

describe('voicePromptBlock', () => {
  it('assembles the EN block with voice, exemplar, contrast pairs and speculation spec', () => {
    const block = voicePromptBlock('en');
    expect(block).toContain('VOICE');
    expect(block).toContain('sharp, well-read colleague');
    expect(block).toContain('STYLE REFERENCE ONLY');
    expect(block).toContain('REGISTER CONTRAST');
    expect(block).toContain("EDITOR'S VIEW");
    for (const pair of CONTRAST_PAIRS_EN) {
      expect(block).toContain(pair.bad);
      expect(block).toContain(pair.good);
    }
  });

  it('assembles the UK block natively, not as a translation of the EN block', () => {
    const block = voicePromptBlock('uk');
    expect(block).toContain('розумний, начитаний колега');
    expect(block).toContain('ЛИШЕ СТИЛЬОВИЙ ЗРАЗОК');
    expect(block).toContain('ПОГЛЯД РЕДАКЦІЇ');
    for (const pair of CONTRAST_PAIRS_UK) {
      expect(block).toContain(pair.bad);
    }
  });
});

describe('bannedPhrasesFor', () => {
  it('returns the EN and UK rule sets by locale', () => {
    expect(bannedPhrasesFor('en')).toBe(BANNED_PHRASES_EN);
    expect(bannedPhrasesFor('uk')).toBe(BANNED_PHRASES_UK);
  });

  it('every EN rule fires on realistic template-leak text', () => {
    const samples: Record<string, string> = {
      label_opener_practical: 'Practical scenario: a security team deploys an agent onto a range.',
      label_opener_limitation: 'The limitation is that this report only covers one vendor.',
      label_opener_takeaway: 'The takeaway here is that isolation must be enforced.',
      label_opener_why: "Why it matters: this changes the reliability decision for teams.",
      ai_tell_delve: 'This piece delves into the incident in detail.',
      ai_tell_landscape: 'In the fast-moving landscape of AI agents, teams are adapting.',
      ai_tell_worth_noting: "It's worth noting that the model behaved differently.",
      ai_tell_gamechanger: 'This is a genuine game-changer for red-teaming.',
      ai_tell_underscore: 'This underscores the importance of network isolation.',
      ai_tell_leader_frame: 'For product and security leaders, the tension is clear.',
    };
    for (const rule of BANNED_PHRASES_EN) {
      const sample = samples[rule.code];
      expect(sample, `no sample text registered for rule ${rule.code}`).toBeTruthy();
      expect(rule.pattern.test(sample), `rule ${rule.code} did not match its own sample`).toBe(true);
    }
  });

  it('the EN label-opener rules match the exact register from the rejected 2026-07-27 edition', () => {
    const practicalRule = BANNED_PHRASES_EN.find((rule) => rule.code === 'label_opener_practical')!;
    expect(
      practicalRule.pattern.test(
        'Practical scenario: a security team runs an agent on a staging capture-the-flag range.',
      ),
    ).toBe(true);
  });

  it('every UK rule fires on realistic template-leak text', () => {
    const samples: Record<string, string> = {
      label_opener_practical: 'Практичний сценарій: команда безпеки запускає агента на полігоні.',
      label_opener_limitation: 'Обмеження полягає в тому, що звіт стосується лише одного постачальника.',
      label_opener_takeaway: 'Висновок для рішення: ізоляцію потрібно перевіряти, а не вважати гарантованою.',
      label_opener_why: 'Чому це важливо: це змінює рішення про надійність для команд.',
      ai_tell_varto_zaznachyty: 'Варто зазначити, що модель поводилася інакше.',
      ai_tell_u_sviti: 'У світі ШІ це вважається значною подією.',
      ai_tell_landscape: 'У стрімкозростаючому ландшафті AI-агентів команди адаптуються.',
      ai_tell_leader_frame: 'Для керівників продукту та безпеки напруга очевидна.',
      listicle_opener_this_week: 'Цього тижня в AI сталося кілька важливих подій.',
    };
    for (const rule of BANNED_PHRASES_UK) {
      const sample = samples[rule.code];
      expect(sample, `no sample text registered for rule ${rule.code}`).toBeTruthy();
      expect(rule.pattern.test(sample), `rule ${rule.code} did not match its own sample`).toBe(true);
    }
  });

  it('the UK label-opener rules match the exact phrases from the rejected 2026-07-27 edition body', () => {
    const limitationRule = BANNED_PHRASES_UK.find((rule) => rule.code === 'label_opener_limitation')!;
    expect(
      limitationRule.pattern.test(
        'Обмеження полягає в тому, що цей звіт стосується ретроспективного огляду Anthropic і конкретних сторонніх середовищ оцінювання.',
      ),
    ).toBe(true);
  });

  it('does not false-positive on ordinary prose', () => {
    const cleanEn =
      'Anthropic reviewed 141,006 evaluation runs and found three incidents involving six of them.';
    const cleanUk = 'Anthropic переглянула 141 006 запусків оцінювання та виявила три інциденти.';
    for (const rule of BANNED_PHRASES_EN) {
      expect(rule.pattern.test(cleanEn), `rule ${rule.code} false-positived on clean EN prose`).toBe(
        false,
      );
    }
    for (const rule of BANNED_PHRASES_UK) {
      expect(rule.pattern.test(cleanUk), `rule ${rule.code} false-positived on clean UK prose`).toBe(
        false,
      );
    }
  });
});
