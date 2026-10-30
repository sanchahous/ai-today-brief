import { Badge } from '@/components/ui/badge';
import {
  formatVerifiedDate,
  officialHref,
  shelfKind,
  shelfKindLabel,
} from '@/lib/concept-meta';
import type { ConceptDetail } from '@/lib/concepts';
import { getStrings } from '@/lib/i18n';
import { pluralLabel } from '@/lib/home-stats';
import type { Lang } from '@/lib/site';
import { ExternalLinkIcon } from '@/components/icons';
import styles from './concepts.module.css';

function distinctAliases(name: string, aliases: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const alias of aliases) {
    const trimmed = alias.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || key === name.trim().toLowerCase() || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function ConceptHeader({
  lang,
  concept,
  storyCount,
}: {
  lang: Lang;
  concept: ConceptDetail;
  storyCount: number;
}) {
  const t = getStrings(lang);
  const kind = shelfKind(concept.type, concept.category);
  const href = officialHref(concept.officialUrl);
  const showVerified = concept.verification === 'verified' || concept.verification === 'partial';
  const checked = showVerified ? formatVerifiedDate(concept.verifiedAt, lang, 'long') : null;
  const aliases = distinctAliases(concept.name, concept.aliases);

  return (
    <header className={styles.conceptHead}>
      <div className={styles.labels}>
        <span className={styles.termType} data-kind={kind}>
          {shelfKindLabel(kind, t.conceptKinds)}
        </span>
        {showVerified ? (
          <Badge kind={concept.verification === 'verified' ? 'verified' : 'partial'} lang={lang}>
            {concept.verification === 'verified' ? t.conceptVerifiedBadge : t.conceptPartialBadge}
          </Badge>
        ) : null}
      </div>
      <h1 className={styles.conceptTitle}>{concept.name}</h1>
      {aliases.length > 0 ? (
        <p className={styles.aliases}>
          {t.conceptAlsoKnown}: <span>{aliases.join(', ')}</span>
        </p>
      ) : null}
      {concept.description ? (
        <p className={styles.dek}>
          <strong>{concept.name}</strong>
          {' — '}
          {concept.description}
        </p>
      ) : null}
      {href || storyCount > 0 || checked ? (
        <ul className={styles.meta}>
          {href ? (
            <li>
              <a href={href} target="_blank" rel="noopener noreferrer">
                {t.officialSite}
                <ExternalLinkIcon size={14} />
              </a>
            </li>
          ) : null}
          {storyCount > 0 ? (
            <li>
              {storyCount} {pluralLabel(storyCount, lang, 'stories')}
            </li>
          ) : null}
          {checked ? (
            <li>
              {t.conceptLastVerified} <time dateTime={concept.verifiedAt ?? undefined}>{checked}</time>
            </li>
          ) : null}
        </ul>
      ) : null}
    </header>
  );
}
