import { describe, expect, it } from 'vitest';
import { buildHallucinationBoard } from './hallucination-board';

describe('buildHallucinationBoard', () => {
  it('blocks Ship while language blockers remain and surfaces numeric parity', () => {
    const board = buildHallucinationBoard({
      items: [{ id: 'item-1', rank: 1, title_en: 'Qwen3.8', title_uk: 'Qwen3.8' }],
      artifacts: [
        {
          artifact_type: 'research_pack',
          locale: 'en',
          is_current: true,
          review_status: 'approved',
          generation_status: 'ready',
          storage_path: null,
          external_url: null,
          revision_item_id: 'item-1',
          metadata: {},
          content: {
            claims: [
              {
                id: 'W1-C1',
                text: 'Qwen3.8 has 95B active parameters, not 2.4T.',
                evidenceUrls: ['https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B'],
              },
            ],
          },
        },
        {
          artifact_type: 'content_quality_report',
          locale: 'neutral',
          is_current: true,
          review_status: 'in_review',
          generation_status: 'ready',
          storage_path: null,
          external_url: null,
          revision_item_id: null,
          metadata: {},
          content: {
            issues: [
              {
                code: 'language_mechanics',
                message: 'Malformed Ukrainian.',
                blocker: true,
                span: 'потокенно',
              },
              {
                code: 'numeric_parity',
                message: 'EN 95B vs UK 2.4T',
                blocker: true,
                locale: 'en',
              },
            ],
          },
        },
      ],
    });
    expect(board.canShip).toBe(false);
    expect(board.claims).toHaveLength(1);
    expect(board.claims[0]?.sourceUrls).toEqual([
      'https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B',
    ]);
    expect(board.numericParityIssues).toHaveLength(1);
    expect(board.unresolvedBlockers).toHaveLength(2);
  });
});
