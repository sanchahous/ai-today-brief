import type { BriefItemDetail } from '@/lib/items';

/** Payload order is the production article contract, independent of category. */
export function selectStorySections(detail: Partial<BriefItemDetail>, toolCount = 0) {
  const present = {
    why: Boolean(detail.why?.trim()),
    takeaways: Boolean(detail.takeaways?.length),
    facts: Boolean(detail.facts?.length),
    body: Boolean(detail.bodyMd?.trim() || detail.deepDive?.trim()),
    codeSnippet: Boolean(detail.codeSnippet?.code.trim()),
    whenToUse: Boolean(detail.whenToUse?.length),
    whenNotToUse: Boolean(detail.whenNotToUse?.length),
    actionItems: Boolean(detail.actionItems?.length),
    editorTake: Boolean(detail.editorTake?.trim()),
    communityReactions: Boolean(detail.communityReactions?.length),
    tools: toolCount > 0,
    citations: Boolean(detail.citations?.length),
  };
  return present;
}
