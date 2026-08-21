import type { Params } from '@/lib/analytics-client';
import type { ToolSlug } from '@/content/tools';

export const TOOL_EVENTS = {
  lintRun: 'tool_lint_run',
  lintRuleTriggered: 'tool_lint_rule_triggered',
  snippetCopy: 'tool_snippet_copy',
  settingsBuild: 'tool_settings_build',
  settingsCopy: 'tool_settings_copy',
  settingsRuleTriggered: 'tool_settings_rule_triggered',
  claudeMdGenerate: 'tool_claude_md_generate',
  claudeMdCopy: 'tool_claude_md_copy',
} as const;

export type ToolEventName = (typeof TOOL_EVENTS)[keyof typeof TOOL_EVENTS];

export type ToolTelemetryParams = Params & {
  tool_slug: ToolSlug;
};

export function toolTelemetryParams<T extends Params>(
  toolSlug: ToolSlug,
  params: T = {} as T,
): ToolTelemetryParams & T {
  return { tool_slug: toolSlug, ...params };
}
