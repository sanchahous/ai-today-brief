'use client';

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { BreadcrumbItem } from '@/components/breadcrumbs';
import { trackEvent } from '@/lib/analytics-client';
import type { ToolWorkspaceTool } from '@/components/tools/tool-workspace';
import { getStrings } from '@/lib/i18n';
import { buildSettings, type BuilderState, type PermissionMode } from '@/lib/settings-builder';
import {
  HOOK_RECIPES,
  PERMISSION_MODES,
  PERMISSION_TEMPLATES,
  type PermissionTemplate,
} from '@/lib/settings-builder-rules';
import { TOOL_EVENTS, toolTelemetryParams } from '@/lib/tool-telemetry';
import type { Lang } from '@/lib/site';
import { copyToolOutput, deriveToolOutputState, type ToolCopyPhase } from '@/lib/ui/tool-workspace';
import { Button, Checkbox, Radio, RadioGroup } from '@/components/ui';
import { ToolWorkspaceOutput } from '@/components/tools/tool-workspace-output';
import { ToolWorkspaceTemplate } from '@/components/tools/tool-workspace';

const INITIAL_TEMPLATE_IDS = ['deny-rm-rf', 'protect-env-read', 'protect-env-edit'] as const;
const INITIAL_RECIPE_IDS = ['format-on-write-prettier'] as const;

export interface SettingsBuilderClientProps {
  lang: Lang;
  tool: ToolWorkspaceTool;
  breadcrumbs: BreadcrumbItem[];
  catalogSlot?: ReactNode;
}

export function SettingsBuilderClient({
  lang,
  tool,
  breadcrumbs,
  catalogSlot,
}: SettingsBuilderClientProps) {
  const strings = getStrings(lang);
  const t = strings.settingsBuilder;
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<PermissionMode>('acceptEdits');
  const [templateIds, setTemplateIds] = useState<string[]>([...INITIAL_TEMPLATE_IDS]);
  const [recipeIds, setRecipeIds] = useState<string[]>([...INITIAL_RECIPE_IDS]);
  const [built, setBuilt] = useState(false);
  const [copyPhase, setCopyPhase] = useState<ToolCopyPhase>('idle');

  const selectedTemplates = useMemo(
    () => PERMISSION_TEMPLATES.filter((template) => templateIds.includes(template.id)),
    [templateIds],
  );
  const selectedRecipes = useMemo(
    () => HOOK_RECIPES.filter((recipe) => recipeIds.includes(recipe.id)),
    [recipeIds],
  );

  const state = useMemo<BuilderState>(() => {
    const byEffect = groupTemplatesByEffect(selectedTemplates);
    return {
      scope: 'project',
      mode,
      permissions: byEffect,
      additionalDirectories: [],
      hooks: selectedRecipes.map((recipe) => ({
        event: recipe.event,
        matcher: recipe.matcher,
        recipeId: recipe.id,
      })),
      scalars: { effortLevel: 'high' },
    };
  }, [mode, selectedRecipes, selectedTemplates]);

  const settingsJson = useMemo(() => JSON.stringify(buildSettings(state), null, 2), [state]);
  const outputState = deriveToolOutputState(built, copyPhase);

  function toggleTemplate(template: PermissionTemplate) {
    const exists = templateIds.includes(template.id);
    setTemplateIds((current) =>
      exists ? current.filter((id) => id !== template.id) : [...current, template.id],
    );
    if (!exists) {
      trackEvent(
        TOOL_EVENTS.settingsRuleTriggered,
        toolTelemetryParams('settings-builder', { effect: template.effect, tool: template.tool }),
      );
    }
  }

  function toggleRecipe(recipeId: string) {
    const exists = recipeIds.includes(recipeId);
    setRecipeIds((current) =>
      exists ? current.filter((id) => id !== recipeId) : [...current, recipeId],
    );
  }

  function changeMode(nextMode: PermissionMode) {
    setMode(nextMode);
    trackEvent(TOOL_EVENTS.settingsBuild, toolTelemetryParams('settings-builder', { mode: nextMode }));
  }

  function handleBuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBuilt(true);
    setCopyPhase('idle');
    trackEvent(
      TOOL_EVENTS.settingsBuild,
      toolTelemetryParams('settings-builder', {
        mode,
        recipe_count: selectedRecipes.length,
        allow_count: state.permissions.allow.length,
        deny_count: state.permissions.deny.length,
        ask_count: state.permissions.ask.length,
      }),
    );
  }

  async function copySettings() {
    if (!built) return;
    await copyToolOutput(settingsJson, setCopyPhase);
    trackEvent(
      TOOL_EVENTS.settingsCopy,
      toolTelemetryParams('settings-builder', {
        scope: 'project',
        recipe_count: selectedRecipes.length,
        allow_count: state.permissions.allow.length,
        deny_count: state.permissions.deny.length,
        ask_count: state.permissions.ask.length,
      }),
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
        <form ref={formRef} className="grid gap-5" onSubmit={handleBuild}>
          <RadioGroup label={t.defaultModeLabel} name="settings-default-mode" hint={t.defaultModeHelp}>
            {PERMISSION_MODES.map((item) => (
              <Radio
                key={item}
                name="settings-default-mode"
                value={item}
                checked={mode === item}
                onChange={() => changeMode(item)}
                label={t.permissionModes[item]}
              />
            ))}
          </RadioGroup>

          <section aria-labelledby="permission-presets">
            <h3 id="permission-presets" className="m-0 text-lg">
              {t.permissionTemplatesTitle}
            </h3>
            <div className="mt-3 grid gap-2">
              {PERMISSION_TEMPLATES.map((template) => (
                <Checkbox
                  key={template.id}
                  name={template.id}
                  checked={templateIds.includes(template.id)}
                  onChange={() => toggleTemplate(template)}
                  label={template.title[lang]}
                  description={template.rule}
                  hint={template.rationale[lang]}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="hook-recipes">
            <h3 id="hook-recipes" className="m-0 text-lg">
              {t.hookRecipesTitle}
            </h3>
            <div className="mt-3 grid gap-2">
              {HOOK_RECIPES.map((recipe) => (
                <Checkbox
                  key={recipe.id}
                  name={recipe.id}
                  checked={recipeIds.includes(recipe.id)}
                  onChange={() => toggleRecipe(recipe.id)}
                  label={recipe.title[lang]}
                  description={`${recipe.event} · ${recipe.matcher || t.anyMatcher}`}
                  hint={recipe.useCase[lang]}
                />
              ))}
            </div>
          </section>

          <Button type="submit" variant="primary" className="w-fit min-h-[44px]">
            {t.buildSettings}
          </Button>
        </form>
      }
      outputTitle={t.outputTitle}
      outputPanel={
        <ToolWorkspaceOutput
          state={outputState}
          draftMessage={t.outputDraft}
          exportErrorMessage={strings.toolWorkspace.exportError}
          showCopy
          copyLabel={t.copySettings}
          copiedLabel={t.copied}
          onCopy={() => void copySettings()}
          footnote={t.outputHelp}
        >
          <pre
            className="border-line bg-raised max-h-[620px] overflow-auto rounded-lg border p-3 text-xs leading-relaxed"
            tabIndex={0}
            aria-readonly="true"
          >
            <code>{settingsJson}</code>
          </pre>
        </ToolWorkspaceOutput>
      }
      catalogSlot={catalogSlot}
    />
  );
}

function groupTemplatesByEffect(templates: readonly PermissionTemplate[]): BuilderState['permissions'] {
  const grouped: BuilderState['permissions'] = { allow: [], deny: [], ask: [] };
  for (const template of templates) {
    grouped[template.effect] = [...grouped[template.effect], template.rule];
  }
  return grouped;
}
