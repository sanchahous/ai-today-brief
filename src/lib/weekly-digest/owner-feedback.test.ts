import { describe, expect, it } from 'vitest';
import {
  applyOwnerFeedbackToImageMetadata,
  applyOwnerFeedbackToPromptSet,
  closedReasonTags,
  mergeOwnerFeedbackOntoImageMetadata,
  ownerCalibrationRecords,
  ownerFeedbackFromImageMetadata,
  ownerFeedbackFromPromptSet,
  recordOwnerConceptFeedback,
} from './owner-feedback';

const entry = recordOwnerConceptFeedback({
  verdict: 'used',
  reasonTags: ['domain_context_success', 'not_a_real_tag', 'domain_context_success'],
  promptTitle: 'Teleprinter adapter',
  canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
  recordedAt: '2026-08-15T12:00:00.000Z',
});

describe('owner-feedback contract', () => {
  it('unknown reason tags are dropped from the closed list', () => {
    expect(closedReasonTags(['broken_arrow', 'made_up', 'broken_arrow', 1])).toEqual([
      'broken_arrow',
    ]);
    expect(recordOwnerConceptFeedback({ verdict: 'ship' })).toBeNull();
    expect(entry?.reasonTags).toEqual(['domain_context_success']);
  });

  it('owner verdict from admin lands on the prompt set and uploaded image metadata', () => {
    if (!entry) throw new Error('fixture');
    const promptSet = applyOwnerFeedbackToPromptSet(
      {
        prompts: [{ conceptLens: 'mechanism', canonical: 'A brass adapter card.' }],
        policy: 'weekly-semantic-story-v5.1',
        generated_at: '2026-08-15T11:00:00.000Z',
      },
      'mechanism',
      entry,
    );
    const imageMetadata = applyOwnerFeedbackToImageMetadata(
      { post_upload_qa: { pending: true } },
      'mechanism',
      entry,
    );

    expect(ownerFeedbackFromPromptSet(promptSet).mechanism?.verdict).toBe('used');
    expect(ownerFeedbackFromImageMetadata(imageMetadata).mechanism?.verdict).toBe('used');
    expect(imageMetadata.post_upload_qa).toEqual({ pending: true });
    expect(ownerCalibrationRecords(ownerFeedbackFromPromptSet(promptSet))).toEqual([
      {
        conceptLens: 'mechanism',
        verdict: 'used',
        reasonTags: ['domain_context_success'],
        recordedAt: '2026-08-15T12:00:00.000Z',
        promptTitle: 'Teleprinter adapter',
        canonical: 'A brass adapter card being pushed into a teleprinter terminal.',
      },
    ]);
  });

  it('calibration records keep the judged prompt after a later prompt rewrite', () => {
    if (!entry) throw new Error('fixture');
    const rewritten = applyOwnerFeedbackToPromptSet(
      {
        prompts: [{ conceptLens: 'mechanism', canonical: 'A completely new scene.' }],
        owner_feedback: { mechanism: entry },
      },
      'rejected_seat',
      recordOwnerConceptFeedback({
        verdict: 'rejected',
        reasonTags: ['weak_context'],
        promptTitle: 'Generic pipes',
        canonical: 'Glowing tubes that mean software.',
        recordedAt: '2026-08-15T13:00:00.000Z',
      })!,
    );
    const records = ownerCalibrationRecords(ownerFeedbackFromPromptSet(rewritten));
    expect(records.find((row) => row.conceptLens === 'mechanism')?.canonical).toBe(
      'A brass adapter card being pushed into a teleprinter terminal.',
    );
    expect(records.map((row) => row.conceptLens)).toEqual(['mechanism', 'rejected_seat']);
  });

  it('upload copies the prompt-set map next to post_upload_qa without dropping QA', () => {
    if (!entry) throw new Error('fixture');
    const merged = mergeOwnerFeedbackOntoImageMetadata(
      { source: 'manual_upload', post_upload_qa: { pending: true } },
      { mechanism: entry },
    );
    expect(merged.source).toBe('manual_upload');
    expect(merged.post_upload_qa).toEqual({ pending: true });
    expect(ownerFeedbackFromImageMetadata(merged).mechanism?.verdict).toBe('used');
  });
});
