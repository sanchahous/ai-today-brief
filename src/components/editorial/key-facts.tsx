import type { Lang } from '@/lib/site';

export interface Fact {
  term: string;
  definition: string;
}

export function KeyFacts({ lang, title, facts }: { lang: Lang; title?: string; facts: Fact[] }) {
  const heading = title || (lang === 'uk' ? 'Ключові факти' : 'Key facts');
  
  return (
    <div className="my-8">
      <h3 className="mb-4 font-serif text-xl font-semibold">{heading}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {facts.map((fact, i) => (
          <div key={i} className="flex flex-col border-t border-line pt-3">
            <dt className="text-sm font-semibold text-text">{fact.term}</dt>
            <dd className="mt-1 text-sm text-muted">{fact.definition}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
