import { CHANNEL_RULES } from './quality';
import type { SocialChannel } from './types';

export type SocialFormField =
  | 'post_copy'
  | 'thread_parts'
  | 'first_comment'
  | 'caption'
  | 'carousel_preview'
  | 'destination'
  | 'alt'
  | 'schedule'
  | 'linkedin_document'
  | 'media_summary';

const CHANNEL_FIELDS: Record<SocialChannel, readonly SocialFormField[]> = {
  telegram: ['post_copy', 'destination', 'alt', 'schedule', 'media_summary'],
  facebook: ['post_copy', 'destination', 'alt', 'schedule', 'media_summary'],
  linkedin: ['post_copy', 'destination', 'alt', 'schedule', 'linkedin_document', 'media_summary'],
  x: ['post_copy', 'first_comment', 'destination', 'alt', 'schedule', 'media_summary'],
  threads: ['thread_parts', 'destination', 'alt', 'schedule', 'media_summary'],
  instagram: ['caption', 'carousel_preview', 'alt', 'schedule', 'media_summary'],
};

export function socialFormFields(channel: SocialChannel): readonly SocialFormField[] {
  return CHANNEL_FIELDS[channel];
}

export function socialFormHas(channel: SocialChannel, field: SocialFormField) {
  return CHANNEL_FIELDS[channel].includes(field);
}

export function socialCopyLimit(channel: SocialChannel) {
  return CHANNEL_RULES[channel].maxChars;
}

export function threadsPartLimit() {
  return 500;
}
