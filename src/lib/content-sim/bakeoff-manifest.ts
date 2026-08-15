/** Manifest rows the vision-critic bake-off can score. */

export type BakeoffManifestStory = {
  title?: string;
  summary?: string;
  why?: string | null;
  practical?: string | null;
  takeaway?: string | null;
};

export type BakeoffManifestRow = {
  rank: number;
  headline?: string;
  story?: BakeoffManifestStory;
};

/**
 * Visual-compiler packages put the story title on `headline`.
 * Older bake-off packages nested it under `story.title`.
 */
export function criticHeadlineFromManifestRow(row: BakeoffManifestRow): string | null {
  const headline = row.headline?.trim() || row.story?.title?.trim() || '';
  return headline.length > 0 ? headline : null;
}
