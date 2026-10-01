import type { Lang } from '@/lib/site';
import { shownVolumeLabel, updatedAgoLabel } from '@/lib/ui/feedback-copy';
import { Notice } from './notice';

export function StaleNotice({
  hoursAgo,
  shown,
  lang,
}: {
  hoursAgo: number;
  shown: number;
  lang: Lang;
}) {
  return (
    <div className="grid gap-2">
      <Notice tone="warning">{updatedAgoLabel(hoursAgo, lang)}</Notice>
      <Notice tone="info">{shownVolumeLabel(shown, lang)}</Notice>
    </div>
  );
}
