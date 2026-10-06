import type { Lang } from '@/lib/site';

export function Takeaways({ lang, items }: { lang: Lang; items: string[] }) {
  const title = lang === 'uk' ? 'Головне' : 'Key Takeaways';
  
  return (
    <div className="my-8 rounded-2xl bg-raised p-5 sm:p-7">
      <h3 className="mb-4 font-serif text-xl font-semibold">{title}</h3>
      <ol className="m-0 list-none space-y-4 p-0">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
              {i + 1}
            </span>
            <span className="text-base leading-relaxed text-text mt-[-1px]">
              {item}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
