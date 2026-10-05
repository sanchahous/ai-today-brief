'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { BreadcrumbItem } from '@/components/breadcrumbs';
import { trackEvent } from '@/lib/analytics-client';
import type { ToolWorkspaceTool } from '@/components/tools/tool-workspace';
import { getStrings } from '@/lib/i18n';
import { TOOL_EVENTS, toolTelemetryParams } from '@/lib/tool-telemetry';
import {
  estimatePromptTokenRange,
  lintPrompt,
  type PromptFinding,
  type PromptLintResult,
} from '@/lib/prompt-lint';
import {
  getPromptLintRule,
  type PromptModel,
  type PromptSeverity,
  type PromptSurface,
} from '@/lib/prompt-lint-rules';
import type { Lang } from '@/lib/site';
import { Button, Radio, RadioGroup, SegmentedControl, Textarea } from '@/components/ui';
import { focusFirstInvalid } from '@/components/ui/field';
import { ToolWorkspaceOutput } from '@/components/tools/tool-workspace-output';
import { ToolWorkspaceTemplate } from '@/components/tools/tool-workspace';

const SURFACES: readonly PromptSurface[] = ['api', 'claude-code', 'claude-ai'];
const MODELS: readonly PromptModel[] = ['haiku-4-5', 'sonnet-4-6', 'fable-5', 'opus-4-8'];
const SEVERITIES: readonly PromptSeverity[] = ['issue', 'suggestion', 'info'];

export interface PromptOptimizerClientProps {
  lang: Lang;
  tool: ToolWorkspaceTool;
  breadcrumbs: BreadcrumbItem[];
  catalogSlot?: ReactNode;
}

export function PromptOptimizerClient({
  lang,
  tool,
  breadcrumbs,
  catalogSlot,
}: PromptOptimizerClientProps) {
  const strings = getStrings(lang);
  const t = strings.promptOptimizer;
  const formRef = useRef<HTMLFormElement>(null);
  const [surface, setSurface] = useState<PromptSurface>('api');
  const [model, setModel] = useState<PromptModel>('fable-5');
  const [prompt, setPrompt] = useState('');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [result, setResult] = useState<PromptLintResult | null>(null);

  const tokenRange = useMemo(() => estimatePromptTokenRange(prompt), [prompt]);
  const outputState = result ? 'ready' : 'draft';

  useEffect(() => {
    if (!promptError || !formRef.current) return;
    focusFirstInvalid(formRef.current);
  }, [promptError]);

  function runLint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      setPromptError(t.promptRequired);
      setResult(null);
      return;
    }

    setPromptError(null);
    const next = lintPrompt({ prompt, surface, model });
    setResult(next);
    trackEvent(
      TOOL_EVENTS.lintRun,
      toolTelemetryParams('prompt-optimizer', {
        surface,
        model,
        issues: next.counts.issue,
        suggestions: next.counts.suggestion,
        infos: next.counts.info,
      }),
    );
    for (const finding of next.findings) {
      trackEvent(
        TOOL_EVENTS.lintRuleTriggered,
        toolTelemetryParams('prompt-optimizer', {
          surface,
          model,
          rule_id: finding.ruleId,
          severity: finding.severity,
        }),
      );
    }
  }

  const summary = result
    ? `${result.counts.issue} ${t.severitySingular.issue}, ${result.counts.suggestion} ${t.severitySingular.suggestion}, ${result.counts.info} ${t.severitySingular.info}`
    : t.summaryEmpty;

  return (
    <ToolWorkspaceTemplate
      tool={tool}
      lang={lang}
      breadcrumbs={breadcrumbs}
      lede={tool.lede[lang]}
      inputTitle={t.inputTitle}
      inputPanel={
        <form ref={formRef} className="grid gap-5" onSubmit={runLint} noValidate>
          <SegmentedControl
            label={t.surfaceLabel}
            name="prompt-surface"
            hint={t.surfaceHelp}
            value={surface}
            onValueChange={(value) => setSurface(value as PromptSurface)}
            options={SURFACES.map((item) => ({ value: item, label: t.surfaces[item] }))}
          />

          <RadioGroup label={t.modelLabel} name="prompt-model">
            {MODELS.map((item) => (
              <Radio
                key={item}
                name="prompt-model"
                value={item}
                checked={model === item}
                onChange={() => setModel(item)}
                label={t.models[item]}
              />
            ))}
          </RadioGroup>

          <Textarea
            label={t.textareaLabel}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t.textareaPlaceholder}
            error={promptError ?? undefined}
            hint={`${t.tokenRange}: ${tokenRange.min}–${tokenRange.max}`}
            rows={9}
            className="font-mono text-sm"
          />

          <Button type="submit" variant="primary" className="w-fit min-h-[44px]">
            {t.runButton}
          </Button>
        </form>
      }
      outputTitle={tool.output[lang]}
      outputPanel={
        <ToolWorkspaceOutput
          state={outputState}
          draftMessage={t.summaryEmpty}
          footnote={strings.toolWorkspace.heuristicNote}
        >
          <div className="grid gap-5">
            <p className="m-0 text-lg font-semibold">{summary}</p>
            {result ? (
              <ModelRecommendation result={result} modelLabels={t.models} labels={t} />
            ) : null}
            {result ? <Findings findings={result.findings} lang={lang} /> : null}
          </div>
        </ToolWorkspaceOutput>
      }
      catalogSlot={catalogSlot}
    />
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
    <article className="rounded-lg border border-line bg-bg p-4">
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
  if (findings.length === 0) return <p className="text-muted">{t.noFindings}</p>;

  return (
    <div className="grid gap-5">
      {SEVERITIES.map((severity) => {
        const items = findings.filter((finding) => finding.severity === severity);
        if (items.length === 0) return null;
        return (
          <section key={severity} aria-labelledby={`findings-${severity}`}>
            <h3 id={`findings-${severity}`} className="text-lg">
              {t.severityLabels[severity]} ({items.length})
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
    <article className="rounded-lg border border-line bg-bg p-4">
      <p className="text-faint m-0 font-mono text-2xs">{finding.ruleId}</p>
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
            <a
              className="text-accent underline decoration-[color:var(--line)] underline-offset-2 hover:decoration-current"
              href={citation.url}
            >
              {citation.label}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}
