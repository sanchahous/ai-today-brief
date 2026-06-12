'use client';

import { useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics-client';
import { getStrings } from '@/lib/i18n';
import {
  estimatePromptTokenRange,
  lintPrompt,
  type PromptFinding,
  type PromptLintResult,
} from '@/lib/prompt-lint';
import {
  getPromptLintRule,
  OFFICIAL_PROMPT_SNIPPETS,
  type PromptModel,
  type PromptPlacement,
  type PromptSeverity,
  type PromptSurface,
} from '@/lib/prompt-lint-rules';
import type { Lang } from '@/lib/site';

const SURFACES: readonly PromptSurface[] = ['api', 'claude-code', 'claude-ai'];
const MODELS: readonly PromptModel[] = ['haiku-4-5', 'sonnet-4-6', 'fable-5', 'opus-4-8'];
const SEVERITIES: readonly PromptSeverity[] = ['issue', 'suggestion', 'info'];

export function PromptOptimizerClient({ lang }: { lang: Lang }) {
  const t = getStrings(lang).promptOptimizer;
  const [surface, setSurface] = useState<PromptSurface>('api');
  const [model, setModel] = useState<PromptModel>('fable-5');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<PromptLintResult | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const tokenRange = useMemo(() => estimatePromptTokenRange(prompt), [prompt]);

  function runLint() {
    const next = lintPrompt({ prompt, surface, model });
    setResult(next);
    trackEvent('tool_lint_run', {
      tool_slug: 'prompt-optimizer',
      surface,
      model,
      issues: next.counts.issue,
      suggestions: next.counts.suggestion,
      infos: next.counts.info,
    });
    for (const finding of next.findings) {
      trackEvent('tool_lint_rule_triggered', {
        tool_slug: 'prompt-optimizer',
        surface,
        model,
        rule_id: finding.ruleId,
        severity: finding.severity,
      });
    }
  }

  async function copySnippet(snippet: { id: string; snippet: string; placement: PromptPlacement }) {
    try {
      await navigator.clipboard.writeText(snippet.snippet);
      setCopiedSnippet(snippet.id);
      window.setTimeout(() => setCopiedSnippet(null), 1800);
    } catch {
      setCopiedSnippet(null);
    }
    trackEvent('tool_snippet_copy', {
      tool_slug: 'prompt-optimizer',
      snippet_id: snippet.id,
      placement: snippet.placement,
    });
  }

  const summary = result
    ? `${result.counts.issue} ${t.severitySingular.issue}, ${result.counts.suggestion} ${t.severitySingular.suggestion}, ${result.counts.info} ${t.severitySingular.info}`
    : t.summaryEmpty;

  return (
    <section
      className="rounded-card border-border bg-surface mt-8 border p-5"
      aria-label={t.runButton}
    >
      <div className="rounded-card border-border bg-surface-2 border p-4">
        <p className="m-0 font-semibold">{t.privacyPromise}</p>
        <p className="text-muted m-0 mt-2 text-sm leading-relaxed">
          {t.heuristicDisclaimer} {t.futureModeNote}
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 font-semibold">{t.surfaceLabel}</legend>
          <p className="text-muted m-0 mb-3 text-sm">{t.surfaceHelp}</p>
          <div className="grid gap-2">
            {SURFACES.map((item) => (
              <label
                key={item}
                className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="prompt-surface"
                  value={item}
                  checked={surface === item}
                  onChange={() => setSurface(item)}
                />
                {t.surfaces[item]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-2 font-semibold">{t.modelLabel}</legend>
          <div className="grid gap-2">
            {MODELS.map((item) => (
              <label
                key={item}
                className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="prompt-model"
                  value={item}
                  checked={model === item}
                  onChange={() => setModel(item)}
                />
                {t.models[item]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-5">
        <label htmlFor="prompt-optimizer-input" className="font-semibold">
          {t.textareaLabel}
        </label>
        <textarea
          id="prompt-optimizer-input"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t.textareaPlaceholder}
          className="border-border bg-bg text-text mt-2 min-h-[220px] w-full rounded-lg border p-3 font-mono text-sm leading-relaxed"
        />
        <p className="text-faint m-0 mt-2 text-sm">
          {t.tokenRange}: {tokenRange.min}–{tokenRange.max}
        </p>
      </div>

      <button
        type="button"
        onClick={runLint}
        className="rounded-pill bg-accent text-on-accent mt-4 px-5 py-2.5 font-semibold transition-opacity hover:opacity-90"
      >
        {t.runButton}
      </button>

      <div className="mt-6" aria-live="polite">
        <p className="m-0 text-lg font-semibold">{summary}</p>
        {result ? <ModelRecommendation result={result} modelLabels={t.models} labels={t} /> : null}
        {result ? <Findings findings={result.findings} lang={lang} /> : null}
      </div>

      <section className="mt-8" aria-labelledby="snippet-library">
        <h3 id="snippet-library" className="text-xl">
          {t.snippetsTitle}
        </h3>
        <p className="text-muted m-0 mt-1 text-sm leading-relaxed">{t.snippetsLede}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {OFFICIAL_PROMPT_SNIPPETS.map((snippet) => (
            <article key={snippet.id} className="border-border bg-bg rounded-lg border p-4">
              <p className="text-faint m-0 text-[0.72rem] tracking-[0.12em] uppercase">
                {t.placementLabels[snippet.placement]}
              </p>
              <h4 className="m-0 mt-1">{snippet.title[lang]}</h4>
              <p className="text-muted m-0 mt-2 text-sm leading-relaxed">{snippet.purpose[lang]}</p>
              <pre className="border-border bg-surface-2 mt-3 overflow-x-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                <code>{snippet.snippet}</code>
              </pre>
              <ul className="m-0 mt-3 grid list-none gap-1 p-0 text-sm">
                {snippet.citations.map((citation) => (
                  <li key={citation.url}>
                    <a className="text-accent hover:underline" href={citation.url}>
                      {citation.label}
                    </a>
                    {citation.quote[lang] ? (
                      <span className="text-muted"> — {citation.quote[lang]}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                aria-label={`${t.copySnippet}: ${snippet.title[lang]}`}
                onClick={() => void copySnippet(snippet)}
                className="text-accent mt-3 border-0 bg-transparent p-0 text-sm font-semibold hover:underline"
              >
                {copiedSnippet === snippet.id ? t.copied : t.copySnippet}
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ModelRecommendation({
  result,
  modelLabels,
  labels,
}: {
  result: PromptLintResult;
  modelLabels: Record<PromptModel, string>;
  labels: ReturnType<typeof getStrings>['promptOptimizer'];
}) {
  return (
    <article className="border-border bg-bg mt-4 rounded-lg border p-4">
      <h3 className="m-0 text-lg">{labels.modelRecommendation}</h3>
      <p className="m-0 mt-2 text-sm">
        <strong>{labels.recommendedModel}:</strong> {modelLabels[result.recommendation.model]}
        {result.recommendation.effort ? (
          <>
            {' '}
            · <strong>{labels.effort}:</strong> {result.recommendation.effort}
          </>
        ) : null}
      </p>
      <p className="text-muted m-0 mt-2 text-sm">
        {labels.reasonIds}: {result.recommendation.reasonIds.join(', ')}
      </p>
    </article>
  );
}

function Findings({ findings, lang }: { findings: readonly PromptFinding[]; lang: Lang }) {
  const t = getStrings(lang).promptOptimizer;
  if (findings.length === 0) return <p className="text-muted mt-4">{t.noFindings}</p>;

  return (
    <div className="mt-5 grid gap-5">
      {SEVERITIES.map((severity) => {
        const items = findings.filter((finding) => finding.severity === severity);
        if (items.length === 0) return null;
        return (
          <section key={severity} aria-labelledby={`findings-${severity}`}>
            <h3 id={`findings-${severity}`} className="text-lg">
              {t.severityLabels[severity]}
            </h3>
            <div className="mt-3 grid gap-3">
              {items.map((finding) => (
                <FindingCard key={finding.ruleId} finding={finding} lang={lang} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FindingCard({ finding, lang }: { finding: PromptFinding; lang: Lang }) {
  const t = getStrings(lang).promptOptimizer;
  const rule = getPromptLintRule(finding.ruleId);
  if (!rule) return null;

  return (
    <article className="border-border bg-bg rounded-lg border p-4">
      <p className="text-faint m-0 font-mono text-[0.72rem]">{finding.ruleId}</p>
      <h4 className="m-0 mt-1">{rule.title[lang]}</h4>
      <p className="text-muted m-0 mt-2 text-sm leading-relaxed">{rule.recommendation[lang]}</p>
      {finding.evidence ? (
        <p className="text-faint m-0 mt-2 text-sm">
          {finding.evidence.count !== undefined
            ? `${t.evidenceCount}: ${finding.evidence.count}`
            : null}
          {finding.evidence.count !== undefined && finding.evidence.approximatePosition
            ? ' · '
            : null}
          {finding.evidence.approximatePosition
            ? `${t.evidencePosition}: ${finding.evidence.approximatePosition}`
            : null}
        </p>
      ) : null}
      <ul className="m-0 mt-3 grid list-none gap-1 p-0 text-sm">
        {rule.citations.map((citation) => (
          <li key={citation.url}>
            <a className="text-accent hover:underline" href={citation.url}>
              {citation.label}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
