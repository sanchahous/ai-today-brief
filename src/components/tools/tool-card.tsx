import Link from 'next/link';
import { ArrowRight, Doc } from '@/components/icons';
import type { ToolContent } from '@/content/tools';
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

export interface ToolCardProps {
  tool: ToolContent;
  lang: Lang;
  index?: number;
}

function ToolPreview({ slug, lang }: { slug: string; lang: Lang }) {
  if (slug === 'prompt-optimizer') {
    return (
      <ul className="preview-findings grid gap-2 list-none p-0 m-0 text-sm">
        <li className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium uppercase">
            <span className="h-2 w-2 shrink-0 rounded-full bg-error" aria-hidden="true" />
            {lang === 'uk' ? 'Проблема' : 'Issue'}
          </span>
          <span>{lang === 'uk' ? 'Немає контракту результату' : 'No output contract'}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium uppercase">
            <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            {lang === 'uk' ? 'Порада' : 'Suggestion'}
          </span>
          <span>{lang === 'uk' ? 'Сталі правила — першими' : 'Stable rules first'}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium uppercase">
            <span className="h-2 w-2 shrink-0 rounded-full bg-signal" aria-hidden="true" />
            {lang === 'uk' ? 'Інфо' : 'Info'}
          </span>
          <span>≈ 1,240 {lang === 'uk' ? 'токенів' : 'tokens'}</span>
        </li>
      </ul>
    );
  }

  if (slug === 'settings-builder') {
    return (
      <pre
        className="preview-code m-0 font-mono text-xs leading-relaxed overflow-x-auto"
        aria-hidden="true"
      >
        {`{
  "permissions": {
    "defaultMode": "plan",
    "deny": ["Read(./.env*)"]
  }
}`}
      </pre>
    );
  }

  return (
    <ul className="preview-tree grid gap-2 list-none p-0 m-0 font-mono text-sm" aria-hidden="true">
      <li className="flex items-center gap-2">
        <Doc size={16} className="text-accent shrink-0" aria-hidden="true" />
        <span>AGENTS.md</span>
        <small className="text-xs opacity-70">
          {lang === 'uk' ? 'спільні правила' : 'shared rules'}
        </small>
      </li>
      <li className="flex items-center gap-2">
        <Doc size={16} className="text-accent shrink-0" aria-hidden="true" />
        <span>CLAUDE.md</span>
        <small className="text-xs opacity-70">→ @AGENTS.md</small>
      </li>
    </ul>
  );
}

export function ToolCard({ tool, lang, index = 0 }: ToolCardProps) {
  const t = getStrings(lang);
  const dateFmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const indexFormatted = String(index + 1).padStart(2, '0');
  const cardTitle = tool.shortTitle ? tool.shortTitle[lang] : tool.title[lang];

  return (
    <article
      className="instrument relative flex flex-col justify-between gap-4 p-6 rounded-2xl border border-border bg-surface shadow-sm transition hover:border-accent/60"
      aria-labelledby={`tool-${tool.slug}`}
    >
      <header className="flex items-center justify-between">
        <span className="instrument-no font-display text-4xl leading-none text-muted" aria-hidden="true">
          {indexFormatted}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-mono font-semibold tracking-wider uppercase text-foreground">
          <span className="h-2 w-2 rounded-full bg-signal" aria-hidden="true" />
          {tool.status === 'live' ? t.toolsPage.liveStatus : t.toolsPage.comingSoonStatus}
        </span>
      </header>

      <div>
        <h2 id={`tool-${tool.slug}`} className="text-xl sm:text-2xl font-normal tracking-tight m-0 text-foreground">
          {cardTitle}
        </h2>
        <p className="text-muted text-sm sm:text-base leading-relaxed mt-2 mb-0">
          {tool.description[lang]}
        </p>
      </div>

      <div className="instrument-preview min-h-[132px] p-4 rounded-xl border border-border bg-stage text-[var(--art-text)] flex items-center">
        <ToolPreview slug={tool.slug} lang={lang} />
      </div>

      <dl className="instrument-facts grid gap-1.5 pt-3 border-t border-border mt-auto mb-0">
        <div className="flex justify-between gap-3 text-sm">
          <dt className="text-muted">{t.toolsPage.outputLabel}</dt>
          <dd className="text-foreground font-medium text-right m-0">{tool.output[lang]}</dd>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <dt className="text-muted">{t.toolsPage.rulesLabel}</dt>
          <dd className="text-foreground font-medium text-right m-0">
            {tool.rulesCount} · {tool.citationsCount} {t.toolsPage.citationsLabel}
          </dd>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <dt className="text-muted">{t.toolsPage.verifiedLabel}</dt>
          <dd className="text-foreground font-medium text-right m-0">
            <time dateTime={tool.lastVerified}>
              {dateFmt.format(new Date(`${tool.lastVerified}T00:00:00`))}
            </time>
          </dd>
        </div>
      </dl>

      <Link
        href={tool.href(lang)}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-fill text-on-accent font-medium px-5 py-3 hover:opacity-90 transition min-h-[44px] text-sm no-underline"
      >
        <span>{t.toolsPage.openTool}</span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </article>
  );
}
