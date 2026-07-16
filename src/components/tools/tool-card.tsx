import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import type { ToolContent } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

export function ToolCard({ tool, lang }: { tool: ToolContent; lang: Lang }) {
  const t = getStrings(lang);
  const dateFmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Link
      href={tool.href(lang)}
      className="rounded-card border-border bg-surface hover:border-accent block border p-5 no-underline transition"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="m-0 text-[1.15rem] leading-snug">{tool.title[lang]}</h2>
        <span className="rounded-pill bg-surface-2 border-border text-faint border px-2 py-0.5 text-[0.72rem] tracking-[0.12em] uppercase">
          {tool.status === 'live' ? t.toolsPage.liveStatus : t.toolsPage.comingSoonStatus}
        </span>
      </div>
      <p className="text-muted m-0 mt-2 text-[0.92rem] leading-relaxed">{tool.description[lang]}</p>
      <p className="text-faint m-0 mt-3 flex items-center gap-2 text-[0.78rem]">
        {t.lastVerifiedLabel}: {dateFmt.format(new Date(`${tool.lastVerified}T00:00:00`))}
        <span className="text-accent inline-flex items-center gap-1">
          {t.toolsPage.openTool} <ArrowRight size={14} aria-hidden />
        </span>
      </p>
    </Link>
  );
}
