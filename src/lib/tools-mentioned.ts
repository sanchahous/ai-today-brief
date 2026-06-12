/**
 * `brief_items.tools_mentioned` is a JSONB column written by the pipeline —
 * historically either `string[]` or `{ name: string }[]`. Single guarded
 * parser shared by items, concepts and briefs so every reader agrees.
 */
export function extractToolNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const entry of value) {
    if (entry && typeof entry === 'object' && 'name' in entry) {
      const name = (entry as { name: unknown }).name;
      if (typeof name === 'string' && name.trim()) names.push(name.trim());
    } else if (typeof entry === 'string' && entry.trim()) {
      names.push(entry.trim());
    }
  }
  return names;
}
