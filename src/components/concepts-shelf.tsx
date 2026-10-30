'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  SHELF_KIND_ORDER,
  countPhrase,
  formatVerifiedDate,
  shelfKind,
  shelfKindLabel,
} from '@/lib/concept-meta';
import type { ConceptSummary } from '@/lib/concepts';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';
import { CheckIcon, SearchIcon } from '@/components/icons';
import styles from './concepts.module.css';

const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function letterOf(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return ch || '#';
}

function presentKinds(concepts: readonly ConceptSummary[]): string[] {
  const present = new Set(concepts.map((concept) => shelfKind(concept.type, concept.category)));
  const ordered: string[] = [];
  for (const kind of SHELF_KIND_ORDER) {
    if (present.has(kind)) ordered.push(kind);
  }
  const extra = [...present]
    .filter((kind) => !ordered.includes(kind))
    .sort((a, b) => a.localeCompare(b));
  return [...ordered, ...extra];
}

function groupByLetter(concepts: readonly ConceptSummary[]): { letter: string; items: ConceptSummary[] }[] {
  const map = new Map<string, ConceptSummary[]>();
  for (const concept of concepts) {
    const letter = letterOf(concept.name);
    const list = map.get(letter);
    if (list) list.push(concept);
    else map.set(letter, [concept]);
  }
  return [...map.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((letter) => ({ letter, items: map.get(letter) ?? [] }));
}

function matchesQuery(concept: ConceptSummary, query: string): boolean {
  if (!query) return true;
  return `${concept.name} ${concept.description}`.toLowerCase().includes(query);
}

export function ConceptsShelf({ lang, concepts }: { lang: Lang; concepts: ConceptSummary[] }) {
  const t = getStrings(lang);
  const labels = t.conceptKinds;
  const [kind, setKind] = useState('all');
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();
  const kinds = useMemo(() => presentKinds(concepts), [concepts]);
  const groups = useMemo(() => groupByLetter(concepts), [concepts]);

  let visible = 0;
  const groupVisible = new Map<string, number>();
  for (const group of groups) {
    let count = 0;
    for (const concept of group.items) {
      const shown =
        (kind === 'all' || shelfKind(concept.type, concept.category) === kind) &&
        matchesQuery(concept, query);
      if (shown) count += 1;
    }
    groupVisible.set(group.letter, count);
    visible += count;
  }

  const letters = new Set(groups.map((group) => group.letter));
  const extraLetters = [...letters]
    .filter((letter) => !LATIN.includes(letter))
    .sort((a, b) => a.localeCompare(b));
  const alphabet = [...LATIN, ...extraLetters];
  const forms = {
    one: t.conceptsEntryOne,
    few: t.conceptsEntryFew,
    many: t.conceptsEntryMany,
    other: t.conceptsEntryOther,
  };

  return (
    <section className={styles.shelf} aria-labelledby="shelf-title">
      <h2 id="shelf-title" className="sr-only">
        {t.nav.concepts}
      </h2>
      <div className={styles.toolbar}>
        <ul className={styles.typeTabs} aria-label={t.conceptsTypeNav}>
          <li>
            <button
              type="button"
              className={styles.typeTab}
              aria-pressed={kind === 'all'}
              onClick={() => setKind('all')}
            >
              {t.conceptsAll}
              <span className={styles.typeCount}>{concepts.length}</span>
            </button>
          </li>
          {kinds.map((id) => {
            let count = 0;
            for (const concept of concepts) {
              if (shelfKind(concept.type, concept.category) === id) count += 1;
            }
            return (
              <li key={id}>
                <button
                  type="button"
                  className={styles.typeTab}
                  aria-pressed={kind === id}
                  onClick={() => setKind(id)}
                >
                  {shelfKindLabel(id, labels)}
                  <span className={styles.typeCount}>{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className={styles.filter}>
          <SearchIcon size={18} />
          <label className="sr-only" htmlFor="shelf-q">
            {t.conceptsFilterLabel}
          </label>
          <input
            id="shelf-q"
            type="search"
            value={filter}
            placeholder={t.conceptsFilterPlaceholder}
            autoComplete="off"
            aria-describedby="shelf-count"
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>
      <nav className={styles.az} aria-label={t.conceptsJumpLetter}>
        <ul>
          {alphabet.map((letter) =>
            letters.has(letter) ? (
              <li key={letter}>
                <a href={`#letter-${letter}`}>{letter}</a>
              </li>
            ) : (
              <li key={letter}>
                <span aria-hidden="true">{letter}</span>
              </li>
            ),
          )}
        </ul>
      </nav>
      <p className={styles.countLine} id="shelf-count" role="status" aria-live="polite">
        {countPhrase(visible, lang, forms)}
      </p>
      <div>
        {groups.map((group) => (
          <section
            key={group.letter}
            className={styles.letterGroup}
            id={`letter-${group.letter}`}
            aria-labelledby={`lh-${group.letter}`}
            hidden={groupVisible.get(group.letter) === 0}
          >
            <h3 className={styles.letter} id={`lh-${group.letter}`}>
              {group.letter}
            </h3>
            <ul className={styles.termGrid}>
              {group.items.map((concept) => {
                const shown =
                  (kind === 'all' || shelfKind(concept.type, concept.category) === kind) &&
                  matchesQuery(concept, query);
                const badge = shelfKind(concept.type, concept.category);
                const checked =
                  concept.verification === 'verified' || concept.verification === 'partial'
                    ? formatVerifiedDate(concept.verifiedAt, lang, 'short')
                    : null;
                return (
                  <li key={concept.slug} hidden={!shown} data-term={concept.slug}>
                    <Link href={`/${lang}/concepts/${concept.slug}`} className={styles.termCard}>
                      <span className={styles.termTop}>
                        <span className={styles.termType} data-kind={badge}>
                          {shelfKindLabel(badge, labels)}
                        </span>
                        {concept.verification === 'verified' ? (
                          <span className={styles.termVerified} title={t.conceptVerifiedBadge}>
                            <CheckIcon size={14} />
                            <span className="sr-only">{t.conceptVerifiedBadge}</span>
                          </span>
                        ) : null}
                      </span>
                      <strong>{concept.name}</strong>
                      {concept.description ? (
                        <span className={styles.termDef}>{concept.description}</span>
                      ) : null}
                      {checked ? (
                        <span className={styles.termMeta}>
                          {t.conceptChecked} {checked}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {visible === 0 ? (
        <div className={styles.empty}>
          <h3>{t.conceptsNoMatchTitle}</h3>
          <p>{t.conceptsNoMatchBody}</p>
          <Link href={`/${lang}/news/search`}>{t.conceptsSearchAll}</Link>
        </div>
      ) : null}
    </section>
  );
}
