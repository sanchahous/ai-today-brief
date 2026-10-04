import type { Lang } from '@/lib/site';

export function WhenGrid({ lang, useCases, avoidCases }: { lang: Lang; useCases: string[]; avoidCases: string[] }) {
  const useTitle = lang === 'uk' ? 'Коли використовувати' : 'When to use';
  const avoidTitle = lang === 'uk' ? 'Коли уникати' : 'When to avoid';

  return (
    <div className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-6">
      <div className="rounded-xl border border-success/30 bg-success/5 p-5">
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-success-contrast">
          <span aria-hidden>✓</span>
          {useTitle}
        </h4>
        <ul className="m-0 flex flex-col gap-2 pl-5 text-sm text-text">
          {useCases.map((item, i) => (
            <li key={i} className="list-disc">{item}</li>
          ))}
        </ul>
      </div>
      
      <div className="rounded-xl border border-error/30 bg-error/5 p-5">
        <h4 className="mb-3 flex items-center gap-2 font-semibold text-error-contrast">
          <span aria-hidden>✕</span>
          {avoidTitle}
        </h4>
        <ul className="m-0 flex flex-col gap-2 pl-5 text-sm text-text">
          {avoidCases.map((item, i) => (
            <li key={i} className="list-disc">{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
