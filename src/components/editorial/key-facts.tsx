import type { Lang } from '@/lib/site';

export interface Fact {
  term: string;
  definition: string;
}

export function KeyFacts({ lang, title, facts }: { lang: Lang; title?: string; facts: Fact[] }) {
  const heading = title || (lang === 'uk' ? 'Ключові факти' : 'Key facts');

  return (
    <section className="border-line bg-surface my-8 overflow-hidden rounded-[var(--radius-md)] border">
      <h3 className="text-accent border-line m-0 border-b px-5 py-3 font-mono text-2xs font-medium tracking-[var(--tracking-eyebrow)] uppercase">
        {heading}
      </h3>
      <dl className="m-0">
        {facts.map((fact, i) => (
          <div
            key={i}
            className={`grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(120px,0.6fr)_minmax(0,1fr)] ${i % 2 === 1 ? 'bg-raised' : ''}`}
          >
            <dt className="text-muted m-0 text-sm">{fact.term}</dt>
            <dd className="text-text m-0 text-base font-semibold leading-snug">{fact.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
