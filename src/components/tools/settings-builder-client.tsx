'use client';

import { useMemo, useState } from 'react';
import { trackEvent } from '@/lib/analytics-client';
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

const INITIAL_TEMPLATE_IDS = ['deny-rm-rf', 'protect-env-read', 'protect-env-edit'] as const;
const INITIAL_RECIPE_IDS = ['format-on-write-prettier'] as const;

export function SettingsBuilderClient({ lang }: { lang: Lang }) {
  const t = getStrings(lang).settingsBuilder;
  const [mode, setMode] = useState<PermissionMode>('acceptEdits');
  const [templateIds, setTemplateIds] = useState<string[]>([...INITIAL_TEMPLATE_IDS]);
  const [recipeIds, setRecipeIds] = useState<string[]>([...INITIAL_RECIPE_IDS]);
  const [copied, setCopied] = useState(false);

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

  async function copySettings() {
    try {
      await navigator.clipboard.writeText(settingsJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
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
    <section
      className="rounded-card border-border bg-surface mt-8 border p-5"
      aria-label={t.buildSettings}
    >
      <div className="rounded-card border-border bg-surface-2 border p-4">
        <p className="m-0 font-semibold">{t.privacyPromise}</p>
        <p className="text-muted m-0 mt-2 text-sm leading-relaxed">
          {t.heuristicDisclaimer} {t.schemaWarning}
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-5">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 font-semibold">{t.defaultModeLabel}</legend>
            <p className="text-muted m-0 mb-3 text-sm leading-relaxed">{t.defaultModeHelp}</p>
            <div className="grid gap-2 md:grid-cols-2">
              {PERMISSION_MODES.map((item) => (
                <label
                  key={item}
                  className="border-border bg-bg flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="settings-default-mode"
                    value={item}
                    checked={mode === item}
                    onChange={() => changeMode(item)}
                  />
                  {t.permissionModes[item]}
                </label>
              ))}
            </div>
          </fieldset>

          <section aria-labelledby="permission-presets">
            <h3 id="permission-presets" className="m-0 text-lg">
              {t.permissionTemplatesTitle}
            </h3>
            <div className="mt-3 grid gap-3">
              {PERMISSION_TEMPLATES.map((template) => (
                <label
                  key={template.id}
                  className="border-border bg-bg flex cursor-pointer gap-3 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={templateIds.includes(template.id)}
                    onChange={() => toggleTemplate(template)}
                  />
                  <span>
                    <span className="block font-semibold">{template.title[lang]}</span>
                    <code className="mt-1 inline-block rounded bg-surface-2 px-2 py-1 text-xs">
                      {template.rule}
                    </code>
                    <span className="text-muted mt-2 block leading-relaxed">
                      {template.rationale[lang]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="hook-recipes">
            <h3 id="hook-recipes" className="m-0 text-lg">
              {t.hookRecipesTitle}
            </h3>
            <div className="mt-3 grid gap-3">
              {HOOK_RECIPES.map((recipe) => (
                <label
                  key={recipe.id}
                  className="border-border bg-bg flex cursor-pointer gap-3 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={recipeIds.includes(recipe.id)}
                    onChange={() => toggleRecipe(recipe.id)}
                  />
                  <span>
                    <span className="block font-semibold">{recipe.title[lang]}</span>
                    <span className="text-faint mt-1 block font-mono text-xs">
                      {recipe.event} · {recipe.matcher || t.anyMatcher}
                    </span>
                    <span className="text-muted mt-2 block leading-relaxed">
                      {recipe.useCase[lang]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className="rounded-card border-border bg-bg border p-4" aria-labelledby="settings-output">
          <h3 id="settings-output" className="m-0 text-lg">
            {t.outputTitle}
          </h3>
          <p className="text-muted m-0 mt-2 text-sm leading-relaxed">{t.outputHelp}</p>
          <pre className="border-border bg-surface-2 mt-4 max-h-[620px] overflow-auto rounded-lg border p-3 text-xs leading-relaxed">
            <code>{settingsJson}</code>
          </pre>
          <button
            type="button"
            onClick={() => void copySettings()}
            className="rounded-pill bg-accent text-on-accent mt-4 px-5 py-2.5 font-semibold transition-opacity hover:opacity-90"
          >
            {copied ? t.copied : t.copySettings}
          </button>
        </aside>
      </div>
    </section>
  );
}

function groupTemplatesByEffect(templates: readonly PermissionTemplate[]): BuilderState['permissions'] {
  return templates.reduce<BuilderState['permissions']>(
    (grouped, template) => ({
      ...grouped,
      [template.effect]: [...grouped[template.effect], template.rule],
    }),
    { allow: [], deny: [], ask: [] },
  );
}
