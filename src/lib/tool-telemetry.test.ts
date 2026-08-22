import { describe, expect, it } from 'vitest';

import { TOOL_EVENTS, toolTelemetryParams } from './tool-telemetry';

describe('tool telemetry scaffolding', () => {
  it('centralizes Wave 1 tool event names', () => {
    expect(TOOL_EVENTS).toEqual({
      lintRun: 'tool_lint_run',
      lintRuleTriggered: 'tool_lint_rule_triggered',
      snippetCopy: 'tool_snippet_copy',
      settingsBuild: 'tool_settings_build',
      settingsCopy: 'tool_settings_copy',
      settingsRuleTriggered: 'tool_settings_rule_triggered',
      claudeMdGenerate: 'tool_claude_md_generate',
      claudeMdCopy: 'tool_claude_md_copy',
    });
  });

  it('attaches only scalar params accepted by trackEvent', () => {
    expect(
      toolTelemetryParams('settings-builder', {
        rules: 3,
        has_hooks: true,
        preset: 'strict',
        raw_text: undefined,
      }),
    ).toEqual({
      tool_slug: 'settings-builder',
      rules: 3,
      has_hooks: true,
      preset: 'strict',
      raw_text: undefined,
    });
  });
});
