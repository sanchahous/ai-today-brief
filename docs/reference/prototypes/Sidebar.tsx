import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CATEGORIES } from './data';
import { useProto } from './ProtoContext';
import { CategoryGlyph, CloseIcon } from './icons';
import { Feature, TrendingTopics } from './features';

export type SortMode = 'newest' | 'oldest' | 'relevance' | 'discussed';
export type DatePreset = 'today' | 'week' | 'month' | 'all';

export interface NewsFilters {
  /** Free-text query, set by the header search. */
  q: string;
  categories: string[];
  date: DatePreset;
  sort: SortMode;
}

interface Props {
  filters: NewsFilters;
  facets: Map<string, number>;
  onToggleCategory: (slug: string) => void;
  onDate: (d: DatePreset) => void;
  onSort: (s: SortMode) => void;
  onReset: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  hasActive: boolean;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '1.6rem' }}>
      <h3
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-accent)',
          margin: '0 0 0.7rem',
        }}
      >
        {label}
      </h3>
      {children}
    </section>
  );
}

function Controls({
  filters,
  facets,
  onToggleCategory,
  onDate,
  onSort,
  onReset,
  hasActive,
}: Omit<Props, 'drawerOpen' | 'setDrawerOpen'>) {
  const { t, lang } = useProto();

  const dates: DatePreset[] = ['today', 'week', 'month', 'all'];
  const sorts: SortMode[] = ['newest', 'oldest', 'relevance', 'discussed'];

  return (
    <>
      {/* Search now lives in the header (canonical) — the sidebar focuses on
          filtering, sorting and topic discovery. */}
      <Group label={t('sortLabel')}>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {sorts.map((s) => {
            const active = filters.sort === s;
            return (
              <label
                key={s}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  color: active ? 'var(--color-text)' : 'var(--color-muted)',
                }}
              >
                <input
                  type="radio"
                  name="proto-sort"
                  checked={active}
                  onChange={() => onSort(s)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                {t(
                  s === 'newest'
                    ? 'sortNewest'
                    : s === 'oldest'
                      ? 'sortOldest'
                      : s === 'relevance'
                        ? 'sortRelevance'
                        : 'sortDiscussed',
                )}
              </label>
            );
          })}
        </div>
      </Group>

      <Group label={t('filterCategories')}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.3rem' }}>
          {CATEGORIES.map((c) => {
            const checked = filters.categories.includes(c.slug);
            const count = facets.get(c.slug) ?? c.count;
            return (
              <li key={c.slug}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(c.slug)}
                    style={{ accentColor: c.color }}
                  />
                  <span style={{ color: c.color, display: 'inline-flex' }}>
                    <CategoryGlyph icon={c.icon} size={16} strokeWidth={1.6} />
                  </span>
                  <span
                    style={{ flex: 1, color: checked ? 'var(--color-text)' : 'var(--color-muted)' }}
                  >
                    {c.name[lang]}
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--color-faint)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {count}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group label={t('filterDate')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          {dates.map((d) => {
            const active = filters.date === d;
            return (
              <button
                key={d}
                onClick={() => onDate(d)}
                aria-pressed={active}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.45rem',
                  color: active ? '#141414' : 'var(--color-text)',
                  background: active ? 'var(--color-accent)' : 'transparent',
                  border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                {t(`date.${d}`)}
              </button>
            );
          })}
        </div>
      </Group>

      {hasActive && (
        <button
          onClick={onReset}
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginBottom: '1.6rem' }}
        >
          {t('filterReset')}
        </button>
      )}

      {/* FEATURE F4 — trending topics / internal linking from the sidebar */}
      <Feature id="F4" label={t('trendingEyebrow')}>
        <TrendingTopics variant="sidebar" />
      </Feature>
    </>
  );
}

export function Sidebar(props: Props) {
  const { t } = useProto();
  const reduce = useReducedMotion();
  const { drawerOpen, setDrawerOpen, ...controls } = props;

  return (
    <>
      {/* Desktop sticky rail */}
      <aside
        className="desktop-only"
        aria-label={t('filters')}
        style={{ position: 'sticky', top: 76, alignSelf: 'start' }}
      >
        <Controls {...controls} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="mobile-only"
            initial={reduce ? { opacity: 0 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 120,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('filters')}
              initial={reduce ? false : { x: '100%' }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: 'min(340px, 88vw)',
                height: '100%',
                background: 'var(--color-bg)',
                borderLeft: '1px solid var(--color-border)',
                padding: '1.4rem',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.2rem',
                }}
              >
                <h2 style={{ fontSize: '1.15rem' }}>{t('filters')}</h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-muted)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
              <Controls {...controls} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                {t('applyFilters')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
