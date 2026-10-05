import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/breadcrumbs';
import { Check, Lock } from '@/components/icons';
import type { ToolContent } from '@/content/tools';

/** Serializable tool fields safe to pass from Server Components to clients. */
export type ToolWorkspaceTool = Pick<
  ToolContent,
  'slug' | 'title' | 'fullTitle' | 'description' | 'lede' | 'lastVerified' | 'status' | 'output'
>;

export function toToolWorkspaceTool(tool: ToolContent): ToolWorkspaceTool {
  return {
    slug: tool.slug,
    title: tool.title,
    fullTitle: tool.fullTitle,
    description: tool.description,
    lede: tool.lede,
    lastVerified: tool.lastVerified,
    status: tool.status,
    output: tool.output,
  };
}
import { getStrings } from '@/lib/i18n';
import type { Lang } from '@/lib/site';

export interface ToolWorkspaceTemplateProps {
  tool: ToolWorkspaceTool;
  lang: Lang;
  breadcrumbs: BreadcrumbItem[];
  lede: string;
  privacyPromiseText?: string;
  inputStepNumber?: string;
  inputTitle: string;
  inputPanel: ReactNode;
  outputStepNumber?: string;
  outputTitle: string;
  outputPanel: ReactNode;
  catalogSlot?: ReactNode;
  children?: ReactNode;
}

export function ToolWorkspaceTemplate({
  tool,
  lang,
  breadcrumbs,
  lede,
  privacyPromiseText,
  inputStepNumber = '01',
  inputTitle,
  inputPanel,
  outputStepNumber = '02',
  outputTitle,
  outputPanel,
  catalogSlot,
  children,
}: ToolWorkspaceTemplateProps) {
  const t = getStrings(lang);
  const dateFmt = new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-4 sm:px-6 py-8 sm:py-10">
      <Breadcrumbs items={breadcrumbs} />

      <header className="tool-head max-w-[56.25rem] pt-6 sm:pt-8 pb-2">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-mono font-semibold tracking-wider uppercase text-foreground">
            <span className="h-2 w-2 rounded-full bg-signal" aria-hidden="true" />
            {tool.status === 'live' ? t.toolsPage.liveStatus : t.toolsPage.comingSoonStatus}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Check size={14} className="text-signal" aria-hidden="true" />
            <span>{t.toolsPage.rulesLastVerified}</span>
            <time dateTime={tool.lastVerified} className="text-foreground font-mono">
              {dateFmt.format(new Date(`${tool.lastVerified}T00:00:00`))}
            </time>
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight mb-4">
          {tool.fullTitle ? tool.fullTitle[lang] : tool.title[lang]}
        </h1>
        <p className="text-muted text-base sm:text-lg leading-relaxed max-w-[48rem]">
          {lede}
        </p>
      </header>

      <p className="privacy-promise inline-flex items-center gap-2.5 my-5 rounded-full border border-signal/45 bg-signal/10 px-4 py-2 text-sm text-foreground">
        <Lock size={18} className="text-signal shrink-0" aria-hidden="true" />
        <span>{privacyPromiseText ?? t.toolsPage.privacyPromise}</span>
      </p>

      <div className="workbench grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <section
          className="workbench-panel relative rounded-2xl border border-line bg-surface p-5 sm:p-8 shadow-sm"
          aria-labelledby="workbench-input-title"
        >
          <h2
            id="workbench-input-title"
            className="panel-title flex items-center gap-3 text-xl sm:text-2xl font-normal mb-6"
          >
            <span
              className="grid place-items-center h-9 w-9 rounded-full bg-accent/15 text-accent font-mono text-xs shrink-0"
              aria-hidden="true"
            >
              {inputStepNumber}
            </span>
            <span>{inputTitle}</span>
          </h2>
          {inputPanel}
        </section>

        <section
          className="workbench-panel output-panel relative rounded-2xl border border-line bg-surface p-5 sm:p-8 shadow-sm"
          aria-labelledby="workbench-output-title"
        >
          <h2
            id="workbench-output-title"
            className="panel-title flex items-center gap-3 text-xl sm:text-2xl font-normal mb-6"
          >
            <span
              className="grid place-items-center h-9 w-9 rounded-full bg-accent/15 text-accent font-mono text-xs shrink-0"
              aria-hidden="true"
            >
              {outputStepNumber}
            </span>
            <span>{outputTitle}</span>
          </h2>
          {outputPanel}
        </section>
      </div>

      {children}

      {catalogSlot ? (
        <div className="mt-12">
          {catalogSlot}
        </div>
      ) : null}
    </div>
  );
}

/** LocalToolShell alias for backwards compatibility and task contract */
export const LocalToolShell = ToolWorkspaceTemplate;
