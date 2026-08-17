import { describe, expect, it } from 'vitest';
import {
  corroborationWindow,
  identitiesOverlap,
  isIndependentPublisherUrl,
  researchCorroborationCandidates,
  storyIdentityKeys,
} from './story-identity';

const QWEN_NVIDIA = {
  title:
    "Alibaba open-sources its largest AI model, and NVIDIA's GB300 server already runs it at 4K tokens per second",
  url: 'https://developer.nvidia.com/blog/serve-qwen3-8-2-4t-a95b-a-2-4t-parameter-model-with-configurable-reasoning-on-nvidia-gb300-nvl72/',
};

const QWEN_HF_CARD = {
  title: 'Qwen/Qwen3.8-2.4T-A95B · Hugging Face',
  url: 'https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B',
};

const QWEN_MODELSCOPE = {
  title: 'ModelScope 魔搭社区',
  url: 'https://modelscope.cn/models/Qwen/Qwen3.8-2.4T-A95B',
};

const QWEN_27B = {
  title: 'Qwen/Qwen3.8-27B · Upcoming release · Hugging Face',
  url: 'https://huggingface.co/Qwen/Qwen3.8-27B',
};

describe('storyIdentityKeys', () => {
  it('extracts the Qwen 2.4T model id from a vendor slug and a model card', () => {
    const nvidia = storyIdentityKeys(QWEN_NVIDIA.title, QWEN_NVIDIA.url);
    const card = storyIdentityKeys(QWEN_HF_CARD.title, QWEN_HF_CARD.url);
    expect(card).toContain('model:qwen/qwen3-8-2-4t-a95b');
    expect(identitiesOverlap(nvidia, card)).toBe(true);
  });

  it('does not treat Qwen3.8-27B as the same event as Qwen3.8-2.4T', () => {
    const big = storyIdentityKeys(QWEN_NVIDIA.title, QWEN_NVIDIA.url);
    const small = storyIdentityKeys(QWEN_27B.title, QWEN_27B.url);
    expect(identitiesOverlap(big, small)).toBe(false);
  });
});

describe('isIndependentPublisherUrl', () => {
  it('rejects discussion threads, same host, and parent-company hosts', () => {
    expect(
      isIndependentPublisherUrl(
        'https://developer.nvidia.com/blog/qwen',
        'https://news.ycombinator.com/item?id=1',
      ),
    ).toBe(false);
    expect(
      isIndependentPublisherUrl(
        'https://huggingface.co/blog/report',
        'https://huggingface.co/Qwen/model',
      ),
    ).toBe(false);
    expect(
      isIndependentPublisherUrl(
        'https://developer.nvidia.com/blog/qwen',
        'https://nvidia.com/qwen',
      ),
    ).toBe(false);
    expect(
      isIndependentPublisherUrl(
        'https://developer.nvidia.com/blog/qwen',
        'https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B',
      ),
    ).toBe(true);
  });
});

describe('researchCorroborationCandidates', () => {
  const corpus = [
    { ...QWEN_NVIDIA, clusterId: '06e533fdcf85' },
    { ...QWEN_HF_CARD, clusterId: 'f9e1ef66ab3d' },
    { ...QWEN_MODELSCOPE, clusterId: 'cc3909d23dba' },
    { ...QWEN_27B, clusterId: '6c64301c09e0' },
    {
      title: 'AI News — August 13, 2026: DeepSeek V4 Pro, Qwen3.8, and Grok 4.6',
      url: 'https://ai0.news/posts/2026-08-13-daily-digest/',
      clusterId: 'c13cd444e6cd',
    },
  ];

  it('finds the HF card and ModelScope page for a NVIDIA-only citation set', () => {
    const urls = researchCorroborationCandidates({
      primaryUrl: QWEN_NVIDIA.url,
      primaryTitle: QWEN_NVIDIA.title,
      listedUrls: [QWEN_NVIDIA.url, 'https://news.ycombinator.com/item?id=1'],
      corpus,
    });
    expect(urls).toContain('https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B');
    expect(urls).toContain('https://modelscope.cn/models/Qwen/Qwen3.8-2.4T-A95B');
    expect(urls.some((url) => url.includes('news.ycombinator.com'))).toBe(false);
    expect(urls.some((url) => url.includes('Qwen3.8-27B'))).toBe(false);
    expect(urls.some((url) => url.includes('ai0.news'))).toBe(false);
  });

  it('prefers a listed independent citation and does not duplicate it from the corpus', () => {
    const listed = 'https://www.cerebras.ai/blog/accelerating-gpt-5-6-sol-ultrafast-with-openai';
    const urls = researchCorroborationCandidates({
      primaryUrl: 'https://openai.com/index/previewing-ultrafast/',
      primaryTitle: 'Previewing Ultrafast mode',
      listedUrls: [listed],
      corpus: [
        { title: 'Cerebras mirror', url: `${listed}/`, clusterId: 'dup' },
        { title: 'Unrelated', url: 'https://example.net/other', clusterId: 'other' },
      ],
    });
    expect(urls).toEqual([
      'https://cerebras.ai/blog/accelerating-gpt-5-6-sol-ultrafast-with-openai',
    ]);
  });

  it('accepts a shared cluster id even when titles do not match', () => {
    const urls = researchCorroborationCandidates({
      primaryUrl: 'https://example.com/a',
      primaryTitle: 'Completely different wording',
      primaryClusterId: 'shared-cluster',
      listedUrls: [],
      corpus: [
        {
          title: 'Unrelated headline',
          url: 'https://other.example.org/b',
          clusterId: 'shared-cluster',
        },
      ],
    });
    expect(urls).toEqual(['https://other.example.org/b']);
  });

  it('returns nothing when the corpus has no independent sibling', () => {
    expect(
      researchCorroborationCandidates({
        primaryUrl: 'https://huggingface.co/blog/state-of-open-models-summer-2026',
        primaryTitle: 'State of Open Models: Summer 2026 Observations',
        listedUrls: [],
        corpus,
      }),
    ).toEqual([]);
  });
});

describe('corroborationWindow', () => {
  it('pads three days before the week and four days after as an exclusive end', () => {
    expect(corroborationWindow('2026-08-09', '2026-08-15')).toEqual({
      from: '2026-08-06T00:00:00.000Z',
      toExclusive: '2026-08-19T00:00:00.000Z',
    });
  });
});
