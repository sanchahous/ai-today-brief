'use client';

import { useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import { generateClaudeMdDocuments, type ProjectStack } from '@/lib/claude-md-generator';
import { getStrings } from '@/lib/i18n';
import { TOOL_EVENTS, toolTelemetryParams } from '@/lib/tool-telemetry';
import type { Lang } from '@/lib/site';

const STACKS: readonly ProjectStack[] = ['typescript', 'python', 'generic'];

export function ClaudeMdGeneratorClient({ lang }: { lang: Lang }) {
  const t = getStrings(lang).claudeMdGenerator;
  const [projectName, setProjectName] = useState('');
  const [stack, setStack] = useState<ProjectStack>('typescript');
  const [includePlanMode, setIncludePlanMode] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);
  const [includeLint, setIncludeLint] = useState(true);
  const [copied, setCopied] = useState<'agents' | 'claude' | null>(null);

  const docs = useMemo(
    () =>
      generateClaudeMdDocuments({
        projectName,
        stack,
        includePlanMode,
        includeTests,
        includeLint,
      }),
    [includeLint, includePlanMode, includeTests, projectName, stack],
  );

  function trackGeneration() {
    trackEvent(
      TOOL_EVENTS.claudeMdGenerate,
      toolTelemetryParams('claude-md-generator', { stack, tests: includeTests, lint: includeLint }),
    );
  }

  async function copy(kind: 'agents' | 'claude') {
    try {
      await navigator.clipboard.writeText(kind === 'agents' ? docs.agentsMd : docs.claudeMd);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
    trackEvent(
      TOOL_EVENTS.claudeMdCopy,
      toolTelemetryParams('claude-md-generator', { file: kind }),
    );
  }

  return (
    <section
      className="rounded-card border-border bg-surface mt-8 border p-5"
      aria-label={t.generateDocs}
    >
      <div className="rounded-card border-border bg-surface-2 border p-4">
        <p className="m-0 font-semibold">{t.privacyPromise}</p>
        <p className="text-muted m-0 mt-2 text-sm leading-relaxed">{t.heuristicDisclaimer}</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            {t.projectNameLabel}
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder={t.projectNamePlaceholder}
              className="border-border bg-bg rounded-lg border px-3 py-2 font-normal"
            />
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">{t.stackLabel}</legend>
            <div className="grid gap-2">
              {STACKS.map((item) => (
                <label
                  key={item}
                  className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="claude-md-stack"
                    checked={stack === item}
                    onChange={() => setStack(item)}
                  />
                  {t.stackOptions[item]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">{t.includeLabel}</legend>
            <div className="grid gap-2 text-sm">
              <label className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={includePlanMode}
                  onChange={(event) => setIncludePlanMode(event.target.checked)}
                />
                {t.includePlanMode}
              </label>
              <label className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={includeTests}
                  onChange={(event) => setIncludeTests(event.target.checked)}
                />
                {t.includeTests}
              </label>
              <label className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={includeLint}
                  onChange={(event) => setIncludeLint(event.target.checked)}
                />
                {t.includeLint}
              </label>
            </div>
          </fieldset>
          <button
            type="button"
            onClick={trackGeneration}
            className="rounded-pill bg-accent text-on-accent w-fit px-5 py-2.5 font-semibold transition-opacity hover:opacity-90"
          >
            {t.generateDocs}
          </button>
          <a
            className="text-accent text-sm hover:underline"
            href="https://code.claude.com/docs/en/memory"
          >
            {t.referenceLink}
          </a>
        </div>

        <div className="grid gap-4">
          <DocumentOutput
            title="AGENTS.md"
            value={docs.agentsMd}
            copied={copied === 'agents'}
            copyLabel={t.copyAgentsMd}
            copiedLabel={t.copied}
            onCopy={() => void copy('agents')}
          />
          <DocumentOutput
            title="CLAUDE.md"
            value={docs.claudeMd}
            copied={copied === 'claude'}
            copyLabel={t.copyClaudeMd}
            copiedLabel={t.copied}
            onCopy={() => void copy('claude')}
          />
        </div>
      </div>
    </section>
  );
}

function DocumentOutput({
  title,
  value,
  copied,
  copyLabel,
  copiedLabel,
  onCopy,
}: {
  title: string;
  value: string;
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
  onCopy: () => void;
}) {
  return (
    <section className="rounded-card border-border bg-bg border p-4" aria-label={title}>
      <h2 className="m-0 text-lg">{title}</h2>
      <pre className="border-border bg-surface-2 mt-3 max-h-[390px] overflow-auto rounded-lg border p-3 text-xs leading-relaxed">
        <code>{value}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-pill bg-accent text-on-accent mt-3 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </section>
  );
}
