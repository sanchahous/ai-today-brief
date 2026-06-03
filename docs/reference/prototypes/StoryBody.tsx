import React from 'react';
import type { ProtoPost } from './data';
import { categoryBySlug, conceptBySlug, slugify } from './data';
import { useProto } from './ProtoContext';
import { CategoryGlyph, PlayIcon } from './icons';

function formatDate(iso: string, lang: 'uk' | 'en') {
  return new Date(iso).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The reusable analysis body of a story: why-it-matters, deep-dive paragraphs,
 * key takeaways and the tool tags (which link out to concept hubs). Shared by
 * the expanded PostCard (compactHeader) and the full ItemPage (no header — the
 * page provides its own hero).
 */
export function StoryBody({ post, compactHeader = false }: { post: ProtoPost; compactHeader?: boolean }) {
  const { lang, t, navigate } = useProto();
  const cat = categoryBySlug.get(post.categorySlug)!;

  return (
    <div style={{ paddingTop: compactHeader ? '1.1rem' : 0 }}>
      {compactHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '0.7rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(135deg, ${cat.color}22, ${cat.color}0a)`,
            border: `1px solid ${cat.color}44`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 42,
              height: 42,
              flexShrink: 0,
              borderRadius: 10,
              color: cat.color,
              background: `${cat.color}1f`,
              border: `1px solid ${cat.color}55`,
            }}
          >
            <CategoryGlyph icon={cat.icon} size={22} strokeWidth={1.6} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '0.2rem',
              }}
            >
              <strong style={{ fontSize: '0.9rem', color: cat.color }}>{cat.name[lang]}</strong>
              {post.hasVideo && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: cat.color,
                  }}
                >
                  <PlayIcon size={13} /> {t('watchVideo')}
                </span>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '0.45rem',
                flexWrap: 'wrap',
                fontSize: '0.76rem',
                color: 'var(--color-faint)',
              }}
            >
              <span>{post.source}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDate(post.date, lang)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {post.readMinutes} {t('readMin')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Why it matters */}
      <div
        style={{
          background: 'var(--color-surface-2)',
          borderLeft: `3px solid ${cat.color}`,
          padding: '0.8rem 1rem',
          borderRadius: '0 8px 8px 0',
          margin: compactHeader ? '1.1rem 0' : '0 0 1.1rem',
        }}
      >
        <p
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: cat.color,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 0.35rem',
          }}
        >
          {t('whyMatters')}
        </p>
        <p style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--color-text)', margin: 0 }}>
          {post.whyMatters[lang]}
        </p>
      </div>

      {post.deepDive[lang].map((para, i) => (
        <p
          key={i}
          style={{
            fontSize: '0.96rem',
            lineHeight: 1.75,
            color: 'var(--color-text)',
            margin: '0 0 0.85rem',
          }}
        >
          {para}
        </p>
      ))}

      {post.takeaways[lang].length > 0 && (
        <>
          <p
            style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: '1.2rem 0 0.6rem',
            }}
          >
            {t('keyTakeaways')}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {post.takeaways[lang].map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.55rem' }}>
                <span style={{ color: cat.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.92rem', lineHeight: 1.6 }}>{b}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Tools mentioned → concept hubs */}
      {post.tools.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '1.1rem' }}>
          {post.tools.map((tool) => {
            const hub = conceptBySlug.get(slugify(tool));
            const chip: React.CSSProperties = {
              fontSize: '0.74rem',
              padding: '0.25rem 0.6rem',
              color: 'var(--color-muted)',
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              borderRadius: '999px',
            };
            return hub ? (
              <button
                key={tool}
                className="topic-chip"
                onClick={() => navigate('concept', { conceptSlug: hub.slug })}
                style={{ ...chip, cursor: 'pointer', color: 'var(--color-text)' }}
              >
                #{tool}
              </button>
            ) : (
              <span key={tool} style={chip}>
                #{tool}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
