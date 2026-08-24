import Image from 'next/image';
import Link from 'next/link';
import { MarkdownBody } from '@/components/markdown-body';
import type { WeeklyDigestItemView } from '@/lib/digests';
import type { Lang } from '@/lib/site';
import { WEEKLY_COPY } from './copy';

function formatDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00Z`));
}

function sourceLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function WeeklyStory({ item, lang }: { item: WeeklyDigestItemView; lang: Lang }) {
  const copy = WEEKLY_COPY[lang];
  return (
    <section
      id={`story-${item.rank}`}
      data-weekly-story
      data-story-id={item.id}
      aria-labelledby={`story-${item.rank}-title`}
      className="border-border-soft scroll-mt-[calc(var(--header-h)+2rem)] border-t pt-10"
    >
      <div className="grid gap-4 sm:grid-cols-[3rem_minmax(0,1fr)]">
        <span aria-hidden className="text-accent font-serif text-4xl leading-none font-semibold">
          {item.rank}
        </span>
        <div>
          {item.date ? (
            <time className="text-faint text-xs">{formatDate(item.date, lang)}</time>
          ) : null}
          <h2
            id={`story-${item.rank}-title`}
            className="mt-1 text-[clamp(1.65rem,4vw,2.5rem)] leading-tight"
          >
            {item.href ? (
              <Link href={item.href} className="hover:text-accent no-underline transition-colors">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h2>
          <p className="mt-4 text-[1.06rem] leading-8">{item.summary}</p>
        </div>
      </div>

      {item.image ? (
        <figure className="border-border bg-surface rounded-card relative mt-7 aspect-video overflow-hidden border">
          <Image
            src={item.image.url}
            alt={item.image.alt}
            fill
            sizes="(max-width: 900px) 100vw, 760px"
            className="object-contain"
          />
        </figure>
      ) : null}

      {item.body ? (
        <div className="mt-7">
          <MarkdownBody markdown={item.body} />
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {item.why ? <Insight title={copy.why} body={item.why} /> : null}
        {item.practicalExample ? (
          <Insight title={copy.practical} body={item.practicalExample} />
        ) : null}
      </div>

      {item.takeaway ? (
        <div className="border-accent bg-surface rounded-card mt-4 border-l-4 p-5">
          <p className="text-accent text-xs font-bold tracking-[0.12em] uppercase">
            {copy.takeaway}
          </p>
          <p className="mt-2 leading-7">{item.takeaway}</p>
        </div>
      ) : null}

      {item.limitation ? (
        <p className="text-faint mt-4 text-sm leading-6">
          <span className="font-semibold">{copy.limitation}: </span>
          {item.limitation}
        </p>
      ) : null}

      {item.editorsView ? (
        <div className="border-border bg-surface/60 rounded-card mt-6 border border-dashed p-5">
          <p className="text-faint text-xs font-bold tracking-[0.12em] uppercase">
            {copy.editorsView}
          </p>
          <p className="text-faint mt-1 text-xs italic">{copy.editorsViewNote}</p>
          <p className="mt-3 leading-7">{item.editorsView}</p>
        </div>
      ) : null}

      {item.discussionQuestion ? (
        <p className="border-border mt-6 border-t pt-6 text-lg leading-8 font-medium italic">
          <span aria-hidden className="text-accent not-italic">
            {copy.discuss}:{' '}
          </span>
          {item.discussionQuestion}
        </p>
      ) : null}

      {item.sources.length ? (
        <div className="mt-5 text-sm">
          <p className="text-faint text-xs font-bold tracking-[0.08em] uppercase">{copy.source}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {item.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent font-semibold no-underline hover:underline"
                >
                  {source.name ?? sourceLabel(source.url)} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Insight({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-border bg-surface rounded-card border p-5">
      <h3 className="text-accent text-sm font-bold">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-7">{body}</p>
    </div>
  );
}
