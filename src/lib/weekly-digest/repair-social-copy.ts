import type { InstagramCarouselSpec } from '@/lib/social/instagram-carousel';

export const INSTAGRAM_STORY_ROLES = ['huggingFace', 'privaiTe', 'openaiUltrafast'] as const;
export type InstagramStoryRole = (typeof INSTAGRAM_STORY_ROLES)[number];

export type GroundedWeeklySocialCopy = {
  instagram: InstagramCarouselSpec;
  facebookUk: string;
  threadsUk: [string, string, string, string];
};

const INSTAGRAM_CAPTION =
  "Qwen3.8 activates only 95 billion of its 2.4 trillion parameters per token, the routing efficiency that makes a model this large deployable outside a hyperscaler. IBM Research's agent memory system matches ACE's accuracy while using as little as one-seventh the inference tokens. Hugging Face's Summer 2026 report found zero of 178 Chinese model releases above 20 billion parameters carried a non-commercial license restriction this year. #OpenSourceAI #LLM #Qwen #AIAgents #MachineLearning";

const STORY_SLIDE: Record<InstagramStoryRole, { headline: string; body: string }> = {
  huggingFace: {
    headline: 'Zero of 178 Chinese 20B+ releases',
    body: 'Hugging Face Summer 2026: none had a non-commercial license restriction this year.',
  },
  privaiTe: {
    headline: 'PrivAiTe missed up to 2 of 24',
    body: 'The self-hosted proxy still leaked some secrets in its own redaction tests.',
  },
  openaiUltrafast: {
    headline: 'OpenAI Ultrafast claims 14x',
    body: 'GPT-5.6 Sol on Cerebras, versus the standard API, initially for select customers.',
  },
};

/**
 * Complete, takeaway-grounded copy. Instagram story slides follow the three
 * approved story images (by role), not leftover truncated carousel paragraphs.
 */
export function groundedWeeklySocialCopy(input: {
  stories: [
    { revisionItemId: string; role: InstagramStoryRole },
    { revisionItemId: string; role: InstagramStoryRole },
    { revisionItemId: string; role: InstagramStoryRole },
  ];
  facebookTrackedUrl: string;
  threadsTrackedUrl: string;
}): GroundedWeeklySocialCopy {
  const coverHeadline = 'Qwen3.8 fires 95B of 2.4T per token';
  const storySlides = input.stories.map((story) => ({
    kind: 'story' as const,
    revisionItemId: story.revisionItemId,
    ...STORY_SLIDE[story.role],
  }));
  const first = storySlides[0];
  const second = storySlides[1];
  const third = storySlides[2];
  if (!first || !second || !third) {
    throw new Error('Instagram grounded copy needs three story slides.');
  }
  return {
    instagram: {
      version: 1,
      angle: 'Watch active parameters and the license column',
      hookCandidates: [coverHeadline, first.headline, second.headline],
      caption: INSTAGRAM_CAPTION,
      slides: [
        { kind: 'cover', headline: coverHeadline },
        first,
        second,
        third,
        {
          kind: 'comparison',
          headline: 'Active 95B, not 2.4T every token',
          body: 'That routing makes Qwen3.8 deployable on standard vLLM or SGLang.',
        },
        {
          kind: 'caveat',
          headline: 'We did not run the benchmarks',
          body: 'Primary sources: Alibaba, IBM Research, Hugging Face. Vendor claims stay claimed.',
        },
        {
          kind: 'takeaway',
          headline: 'Watch active params and licenses',
          body: 'Active parameters affect deployability; licenses affect commercial use of the weights.',
        },
      ],
    },
    facebookUk: [
      'Qwen3.8 від Alibaba має 2,4 трильйона параметрів, але на кожен токен активує лише 95 мільярдів. Саме ця ефективність маршрутизації дозволяє розгортати таку велику модель через vLLM чи SGLang поза гіперскейлером.',
      "IBM Research: система пам'яті агентів зрівнялася за точністю з ACE, витрачаючи аж до однієї сьомої токенів на інференс — бо підтягує релевантні правила замість повного набору траєкторій.",
      'Hugging Face, літо 2026: жоден зі 178 китайських релізів моделей понад 20 мільярдів параметрів цього року не мав обмеження у вигляді некомерційної ліцензії.',
      input.facebookTrackedUrl,
    ].join('\n\n'),
    threadsUk: [
      'Qwen3.8 від Alibaba має 2,4 трильйона параметрів, але на кожен токен активує лише 95 мільярдів. Ця ефективність маршрутизації дозволяє розгортати модель через vLLM чи SGLang поза гіперскейлером.',
      "IBM Research показала систему пам'яті агентів, яка зрівнялася за точністю з ACE і витрачає аж до однієї сьомої токенів на інференс, підтягуючи релевантні правила замість повного набору траєкторій.",
      'Звіт Hugging Face за літо 2026: жоден зі 178 китайських релізів моделей понад 20 мільярдів параметрів цього року не мав некомерційної ліцензії.',
      `Коли обираєте відкриті ваги під продакшн, що дивитеся першим — активні параметри чи колонку ліцензії? ${input.threadsTrackedUrl}`,
    ],
  };
}

export function instagramStoryRoleFromItem(item: {
  id: string;
  title_en?: string | null;
}): InstagramStoryRole | null {
  const title = item.title_en?.toLocaleLowerCase() ?? '';
  if (title.includes('hugging face')) return 'huggingFace';
  if (title.includes('privaite')) return 'privaiTe';
  if (title.includes('ultrafast') || title.includes('cerebras')) return 'openaiUltrafast';
  return null;
}

export const GROUNDED_COPY_FORBIDDEN_CLAIMS = [
  '56,0',
  '56.0',
  '54,8',
  '54.8',
  'gpt-oss',
  'DeepSeek-V3.2',
  '1.65T',
  '1,65T',
  '130B',
  '150,000',
  '150 тисяч',
  'найбільший відкритий реліз',
  'дрібногранульований',
  'AppWorld',
  'ALTK',
  '41%',
  'ecosystem gravity',
  'A permissive,',
  'And it shipped with a full',
] as const;
