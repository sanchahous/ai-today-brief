import type { Lang } from '@/lib/site';

export function Takeaways({ lang, items }: { lang: Lang; items: string[] }) {
  const title = lang === 'uk' ? 'Головне' : 'Key Takeaways';

  return (
    <section className="border-line bg-surface my-8 rounded-[var(--radius-md)] border px-5 py-6 sm:px-6">
      <h3 className="text-text m-0 font-serif text-xl font-semibold">{title}</h3>
      <ol className="m-0 mt-3 list-none space-y-0 p-0">
        {items.map((item, i) => (
          <li
            key={i}
            className="border-line grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-t py-4"
          >
            <span
              aria-hidden
              className="text-accent font-serif text-xl leading-none tabular-nums"
            >
              {i + 1}
            </span>
            <span className="text-text m-0 text-base leading-[1.6]">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
