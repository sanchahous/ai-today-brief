import { describe, expect, it } from 'vitest';

import {
  buildSettings,
  mergeSettings,
  validateBuilderState,
  validateEffortLevel,
  validatePermissionRule,
  type BuilderState,
} from './settings-builder';
import {
  GRAMMAR_REFERENCE,
  HOOK_RECIPES,
  PERMISSION_MODES,
  PERMISSION_TEMPLATES,
  SCOPE_HIERARCHY,
  getRecipe,
  getTemplate,
} from './settings-builder-rules';

const baseState: BuilderState = {
  scope: 'project',
  mode: 'acceptEdits',
  permissions: {
    allow: ['Bash(npm run test *)', 'Read(./src/**)'],
    deny: ['Bash(rm -rf *)'],
    ask: ['WebFetch(domain:github.com)'],
  },
  additionalDirectories: ['../shared', '../shared'],
  hooks: [{ event: 'PostToolUse', matcher: 'Edit|Write', recipeId: 'format-on-write-prettier' }],
  scalars: { model: 'sonnet', defaultShell: 'bash', effortLevel: 'xhigh' },
};

describe('settings-builder rules-as-data catalog', () => {
  it('covers permission modes, starter templates, hook recipes, grammar, and scope hierarchy with citations', () => {
    expect(PERMISSION_MODES).toEqual([
      'default',
      'acceptEdits',
      'plan',
      'auto',
      'dontAsk',
      'bypassPermissions',
    ]);
    expect(PERMISSION_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(HOOK_RECIPES.length).toBeGreaterThanOrEqual(6);
    expect(GRAMMAR_REFERENCE.length).toBeGreaterThanOrEqual(7);
    expect(SCOPE_HIERARCHY.map((row) => row.precedence)).toEqual([1, 2, 3, 4, 5]);

    const allCitationGroups = [
      ...PERMISSION_TEMPLATES.map((item) => item.citations),
      ...HOOK_RECIPES.map((item) => item.citations),
      ...GRAMMAR_REFERENCE.map((item) => item.citations),
      ...SCOPE_HIERARCHY.map((item) => item.citations),
    ];

    for (const citations of allCitationGroups) {
      expect(citations.length).toBeGreaterThan(0);
      for (const citation of citations) {
        expect(citation.url).toMatch(/^https:\/\/(code\.claude\.com|docs\.anthropic\.com)\//u);
        expect(citation.quote.en).toBeTruthy();
        expect(citation.quote.uk).toBeTruthy();
      }
    }
  });

  it('looks up templates and recipes by id', () => {
    expect(getTemplate('deny-rm-rf')?.rule).toBe('Bash(rm -rf *)');
    expect(getRecipe('format-on-write-prettier')?.event).toBe('PostToolUse');
    expect(getRecipe('missing')).toBeUndefined();
  });
});

describe('settings-builder validation and generation', () => {
  it('emits defaultMode nested under permissions and never as legacy top-level/mode keys', () => {
    const settings = buildSettings(baseState);

    expect(settings).not.toHaveProperty('defaultMode');
    expect(settings.permissions).toMatchObject({
      defaultMode: 'acceptEdits',
      allow: ['Bash(npm run test *)', 'Read(./src/**)'],
      deny: ['Bash(rm -rf *)'],
      ask: ['WebFetch(domain:github.com)'],
      additionalDirectories: ['../shared'],
    });
    expect(settings.permissions).not.toHaveProperty('mode');
    expect(settings.effortLevel).toBe('xhigh');
  });

  it('accepts only persisted effortLevel schema values and rejects max', () => {
    expect(validateEffortLevel('low')).toEqual({ value: 'low', ok: true });
    expect(validateEffortLevel('medium')).toEqual({ value: 'medium', ok: true });
    expect(validateEffortLevel('high')).toEqual({ value: 'high', ok: true });
    expect(validateEffortLevel('xhigh')).toEqual({ value: 'xhigh', ok: true });
    expect(validateEffortLevel('max')).toEqual({ value: 'max', ok: false, reasonId: 'invalid-effort-level' });
  });

  it('validates supported permission rule grammar without leaking rule text in reason ids', () => {
    expect(validatePermissionRule('Bash(npm run lint)')).toMatchObject({ ok: true, tool: 'Bash' });
    expect(validatePermissionRule('Read(./src/**)')).toMatchObject({ ok: true, tool: 'Read' });
    expect(validatePermissionRule('WebFetch(domain:github.com)')).toMatchObject({ ok: true, tool: 'WebFetch' });
    expect(validatePermissionRule('mcp__github__create_issue')).toMatchObject({ ok: true, tool: 'MCP' });
    expect(validatePermissionRule('Unknown(foo)')).toEqual({
      rule: 'Unknown(foo)',
      ok: false,
      reasonId: 'unknown-tool',
    });
  });

  it('validates builder state invariants for cleanup and generated hooks', () => {
    expect(validateBuilderState({ ...baseState, scalars: { cleanupPeriodDays: 0 } })).toContainEqual({
      field: 'cleanupPeriodDays',
      ok: false,
      reasonId: 'cleanup-period-too-low',
    });
    expect(validateBuilderState(baseState)).toEqual([]);

    expect(buildSettings(baseState).hooks).toEqual({
      PostToolUse: [
        {
          matcher: 'Edit|Write',
          hooks: [{ type: 'command', command: 'npx prettier --write "$CLAUDE_FILE_PATH"' }],
        },
      ],
    });
  });

  it('deep-merges arrays and hook recipes without silently overwriting scalar conflicts', () => {
    const generated = buildSettings(baseState);
    const { merged, conflicts } = mergeSettings(
      {
        permissions: {
          allow: ['Bash(git status)'],
          additionalDirectories: ['../legacy'],
          defaultMode: 'plan',
        },
        hooks: {
          PostToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'npm test' }] }],
        },
        model: 'opus',
      },
      generated,
    );

    expect(conflicts).toContain('permissions.defaultMode');
    expect(conflicts).toContain('model');
    expect(merged.permissions).toMatchObject({
      allow: ['Bash(git status)', 'Bash(npm run test *)', 'Read(./src/**)'],
      additionalDirectories: ['../legacy', '../shared'],
      defaultMode: 'plan',
    });
    expect((merged.hooks as Record<string, unknown[]>).PostToolUse).toHaveLength(2);
  });
});
