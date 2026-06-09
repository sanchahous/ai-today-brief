/** Resolve `tools_mentioned` strings to concept slugs for the junction table. */

export interface ConceptRow {
  slug: string;
  name_en: string;
  name_uk: string;
  aliases: string[] | null;
}

export function buildConceptNameIndex(rows: ConceptRow[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    index.set(row.name_en.trim().toLowerCase(), row.slug);
    index.set(row.name_uk.trim().toLowerCase(), row.slug);
    if (Array.isArray(row.aliases)) {
      for (const alias of row.aliases) {
        const key = alias.trim().toLowerCase();
        if (key) index.set(key, row.slug);
      }
    }
  }
  return index;
}

export function toolNamesFromJsonb(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim()) {
      names.push(entry.trim());
    } else if (entry && typeof entry === 'object' && 'name' in entry) {
      const name = (entry as { name: unknown }).name;
      if (typeof name === 'string' && name.trim()) names.push(name.trim());
    }
  }
  return names;
}

export function resolveConceptSlugs(
  tools: string[],
  index: Map<string, string>,
): string[] {
  const slugs = new Set<string>();
  for (const tool of tools) {
    const slug = index.get(tool.trim().toLowerCase());
    if (slug) slugs.add(slug);
  }
  return [...slugs];
}
