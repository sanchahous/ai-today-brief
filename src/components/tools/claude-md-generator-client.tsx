'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { BreadcrumbItem } from '@/components/breadcrumbs';
import { trackEvent } from '@/lib/analytics-client';
import { generateClaudeMdDocuments, type ProjectStack } from '@/lib/claude-md-generator';
import type { ToolWorkspaceTool } from '@/components/tools/tool-workspace';
import { getStrings } from '@/lib/i18n';
import { TOOL_EVENTS, toolTelemetryParams } from '@/lib/tool-telemetry';
import type { Lang } from '@/lib/site';
import { copyToolOutput, deriveToolOutputState, type ToolCopyPhase } from '@/lib/ui/tool-workspace';
import { Button, Checkbox, Radio, RadioGroup, Tabs, TextInput } from '@/components/ui';
import { focusFirstInvalid } from '@/components/ui/field';
import { ToolWorkspaceOutput } from '@/components/tools/tool-workspace-output';
import { ToolWorkspaceTemplate } from '@/components/tools/tool-workspace';

const STACKS: readonly ProjectStack[] = ['typescript', 'python', 'generic'];

export interface ClaudeMdGeneratorClientProps {
  lang: Lang;
  tool: ToolWorkspaceTool;
  breadcrumbs: BreadcrumbItem[];
  catalogSlot?: ReactNode;
}

export function ClaudeMdGeneratorClient({
  lang,
  tool,
  breadcrumbs,
  catalogSlot,
}: ClaudeMdGeneratorClientProps) {
  const strings = getStrings(lang);
  const t = strings.claudeMdGenerator;
  const formRef = useRef<HTMLFormElement>(null);
  const [projectName, setProjectName] = useState('');
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [stack, setStack] = useState<ProjectStack>('typescript');
  const [includePlanMode, setIncludePlanMode] = useState(true);
  const [includeTests, setIncludeTests] = useState(true);
  const [includeLint, setIncludeLint] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'claude'>('agents');
  const [agentsCopyPhase, setAgentsCopyPhase] = useState<ToolCopyPhase>('idle');
  const [claudeCopyPhase, setClaudeCopyPhase] = useState<ToolCopyPhase>('idle');

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

  const agentsOutputState = deriveToolOutputState(generated, agentsCopyPhase);
  const claudeOutputState = deriveToolOutputState(generated, claudeCopyPhase);

  useEffect(() => {
    if (!projectNameError || !formRef.current) return;
    focusFirstInvalid(formRef.current);
  }, [projectNameError]);

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectName.trim()) {
      setProjectNameError(t.projectNameRequired);
      setGenerated(false);
      return;
    }

    setProjectNameError(null);
    setGenerated(true);
    setAgentsCopyPhase('idle');
    setClaudeCopyPhase('idle');
    trackEvent(
      TOOL_EVENTS.claudeMdGenerate,
      toolTelemetryParams('claude-md-generator', { stack, tests: includeTests, lint: includeLint }),
    );
  }

  async function copyAgentsDocument() {
    if (!generated) return;
    await copyToolOutput(docs.agentsMd, setAgentsCopyPhase);
    trackEvent(
      TOOL_EVENTS.claudeMdCopy,
      toolTelemetryParams('claude-md-generator', { file: 'agents' }),
    );
  }

  async function copyClaudeDocument() {
    if (!generated) return;
    await copyToolOutput(docs.claudeMd, setClaudeCopyPhase);
    trackEvent(
      TOOL_EVENTS.claudeMdCopy,
      toolTelemetryParams('claude-md-generator', { file: 'claude' }),
    );
  }

  return (
    <ToolWorkspaceTemplate
      tool={tool}
      lang={lang}
      breadcrumbs={breadcrumbs}
      lede={tool.lede[lang]}
      inputTitle={t.inputTitle}
      inputPanel={
        <form ref={formRef} className="grid gap-4" onSubmit={handleGenerate} noValidate>
          <TextInput
            label={t.projectNameLabel}
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder={t.projectNamePlaceholder}
            error={projectNameError ?? undefined}
          />

          <RadioGroup label={t.stackLabel} name="claude-md-stack">
            {STACKS.map((item) => (
              <Radio
                key={item}
                name="claude-md-stack"
                value={item}
                checked={stack === item}
                onChange={() => setStack(item)}
                label={t.stackOptions[item]}
              />
            ))}
          </RadioGroup>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">{t.includeLabel}</legend>
            <div className="grid gap-2">
              <Checkbox
                name="include-plan"
                checked={includePlanMode}
                onChange={(event) => setIncludePlanMode(event.target.checked)}
                label={t.includePlanMode}
              />
              <Checkbox
                name="include-tests"
                checked={includeTests}
                onChange={(event) => setIncludeTests(event.target.checked)}
                label={t.includeTests}
              />
              <Checkbox
                name="include-lint"
                checked={includeLint}
                onChange={(event) => setIncludeLint(event.target.checked)}
                label={t.includeLint}
              />
            </div>
          </fieldset>

          <Button type="submit" variant="primary" className="w-fit min-h-[44px]">
            {t.generateDocs}
          </Button>
        </form>
      }
      outputTitle={tool.output[lang]}
      outputPanel={
        <div className="grid gap-4">
          <Tabs
            ariaLabel={tool.output[lang]}
            activeTabId={activeTab}
            onTabChange={(id) => setActiveTab(id as 'agents' | 'claude')}
            tabs={[
              {
                id: 'agents',
                label: 'AGENTS.md',
                content: (
                  <ToolWorkspaceOutput
                    state={agentsOutputState}
                    draftMessage={t.outputDraftAgents}
                    exportErrorMessage={strings.toolWorkspace.exportError}
                    showCopy
                    copyLabel={t.copyAgentsMd}
                    copiedLabel={t.copied}
                    onCopy={() => void copyAgentsDocument()}
                    footnote={
                      <a
                        className="text-accent underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current"
                        href="https://code.claude.com/docs/en/memory"
                      >
                        {t.referenceLink}
                      </a>
                    }
                  >
                    <pre
                      className="border-border bg-surface-2 max-h-[390px] overflow-auto rounded-lg border p-3 text-xs leading-relaxed"
                      tabIndex={0}
                      aria-readonly="true"
                    >
                      <code>{docs.agentsMd}</code>
                    </pre>
                  </ToolWorkspaceOutput>
                ),
              },
              {
                id: 'claude',
                label: 'CLAUDE.md',
                content: (
                  <ToolWorkspaceOutput
                    state={claudeOutputState}
                    draftMessage={t.outputDraftClaude}
                    exportErrorMessage={strings.toolWorkspace.exportError}
                    showCopy
                    copyLabel={t.copyClaudeMd}
                    copiedLabel={t.copied}
                    onCopy={() => void copyClaudeDocument()}
                    footnote={
                      <a
                        className="text-accent underline decoration-[color:var(--border)] underline-offset-2 hover:decoration-current"
                        href="https://code.claude.com/docs/en/memory"
                      >
                        {t.referenceLink}
                      </a>
                    }
                  >
                    <pre
                      className="border-border bg-surface-2 max-h-[390px] overflow-auto rounded-lg border p-3 text-xs leading-relaxed"
                      tabIndex={0}
                      aria-readonly="true"
                    >
                      <code>{docs.claudeMd}</code>
                    </pre>
                  </ToolWorkspaceOutput>
                ),
              },
            ]}
          />
        </div>
      }
      catalogSlot={catalogSlot}
    />
  );
}
