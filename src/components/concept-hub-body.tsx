import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Lang } from '@/lib/site';

export interface MentionableConcept {
  name: string;
  slug: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split a paragraph into text runs and internal links wherever another
 * concept's name occurs. Hrefs are always `/{lang}/concepts/{slug}` built from
 * our own DB rows — never an arbitrary URL from the body text. Each concept is
 * linked at most once per paragraph to avoid over-linking.
 */
export function linkConceptMentions(
  para: string,
  lang: Lang,
  concepts: MentionableConcept[],
): ReactNode[] {
  const usable = concepts.filter((c) => c.name.trim().length > 1);
  if (usable.length === 0 || !para) return [para];

  const byName = new Map<string, MentionableConcept>();
  // Longest names first so "Model Context Protocol" wins over its alias "MCP".
  const sorted = [...usable].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) byName.set(c.name.toLowerCase(), c);

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${sorted.map((c) => escapeRegExp(c.name)).join('|')})(?![\\p{L}\\p{N}])`,
    'giu',
  );

  const nodes: ReactNode[] = [];
  const linked = new Set<string>();
  let last = 0;
  for (const m of para.matchAll(pattern)) {
    const idx = m.index ?? 0;
    const matched = m[0];
    const key = matched.toLowerCase();
    const concept = byName.get(key);
    if (!concept || linked.has(concept.slug)) continue;
    if (idx > last) nodes.push(para.slice(last, idx));
    nodes.push(
      <Link
        key={`${concept.slug}-${idx}`}
        href={`/${lang}/concepts/${concept.slug}`}
        className="text-accent font-medium hover:underline"
      >
        {matched}
      </Link>,
    );
    linked.add(concept.slug);
    last = idx + matched.length;
  }
  if (last < para.length) nodes.push(para.slice(last));
  return nodes.length > 0 ? nodes : [para];
}
