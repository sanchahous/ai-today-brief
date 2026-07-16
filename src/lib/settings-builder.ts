import {
  EFFORT_LEVELS,
  HOOK_RECIPES,
  PERMISSION_MODES,
  type EffortLevel,
  type HookEvent,
  type HookRecipe,
  type PermissionMode,
  type RuleTool,
  type SettingsScope,
} from './settings-builder-rules';

export type { EffortLevel, HookEvent, PermissionMode, SettingsScope } from './settings-builder-rules';

export interface BuilderState {
  scope: SettingsScope;
  mode?: PermissionMode;
  permissions: { allow: string[]; deny: string[]; ask: string[] };
  additionalDirectories: string[];
  hooks: { event: HookEvent; matcher: string; recipeId: string }[];
  scalars?: {
    model?: string;
    defaultShell?: 'bash' | 'powershell';
    effortLevel?: EffortLevel | string;
    cleanupPeriodDays?: number;
  };
}

export interface RuleValidation {
  rule: string;
  ok: boolean;
  tool?: RuleTool;
  reasonId?:
    | 'empty-rule'
    | 'unknown-tool'
    | 'invalid-rule-syntax'
    | 'invalid-webfetch-domain'
    | 'invalid-mcp-tool'
    | 'invalid-agent-name';
}

export interface ScalarValidation {
  field: string;
  ok: boolean;
  reasonId:
    | 'invalid-permission-mode'
    | 'invalid-effort-level'
    | 'cleanup-period-too-low'
    | 'unknown-hook-recipe'
    | 'hook-event-mismatch'
    | 'invalid-permission-rule';
}

export interface EffortValidation {
  value: string;
  ok: boolean;
  reasonId?: 'invalid-effort-level';
}

export interface MergeResult {
  merged: Record<string, unknown>;
  conflicts: string[];
}

interface CommandHook {
  type: 'command';
  command: string;
}

interface HookMatcherEntry {
  matcher: string;
  hooks: CommandHook[];
}

const TOOL_NAMES: readonly RuleTool[] = ['Bash', 'Read', 'Edit', 'Write', 'WebFetch', 'Agent'];
const WRAPPED_RULE = /^([A-Za-z][A-Za-z0-9_]*)(?:\((.*)\))?$/u;
const MCP_RULE = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+(?:\(.*\))?$/u;
const WEBFETCH_DOMAIN = /^domain:[A-Za-z0-9.-]+(?::\*)?$/u;
const AGENT_NAME = /^[A-Za-z0-9_. -]+$/u;

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getHookRecipe(id: string): HookRecipe | undefined {
  return HOOK_RECIPES.find((recipe) => recipe.id === id);
}

export function validatePermissionRule(rule: string): RuleValidation {
  const trimmed = rule.trim();
  if (!trimmed) return { rule, ok: false, reasonId: 'empty-rule' };
  if (MCP_RULE.test(trimmed)) return { rule, ok: true, tool: 'MCP' };

  const match = WRAPPED_RULE.exec(trimmed);
  if (!match) return { rule, ok: false, reasonId: 'invalid-rule-syntax' };

  const tool = match[1] as RuleTool;
  const body = match[2];
  if (!TOOL_NAMES.includes(tool)) return { rule, ok: false, reasonId: 'unknown-tool' };
  if (body === '') return { rule, ok: false, reasonId: 'invalid-rule-syntax' };
  if (tool === 'WebFetch' && body !== undefined && !WEBFETCH_DOMAIN.test(body)) {
    return { rule, ok: false, reasonId: 'invalid-webfetch-domain' };
  }
  if (tool === 'Agent' && body !== undefined && !AGENT_NAME.test(body)) {
    return { rule, ok: false, reasonId: 'invalid-agent-name' };
  }

  return { rule, ok: true, tool };
}

export function validateEffortLevel(value: string): EffortValidation {
  return (EFFORT_LEVELS as readonly string[]).includes(value)
    ? { value, ok: true }
    : { value, ok: false, reasonId: 'invalid-effort-level' };
}

export function validateBuilderState(state: BuilderState): ScalarValidation[] {
  const issues: ScalarValidation[] = [];

  if (state.mode && !(PERMISSION_MODES as readonly string[]).includes(state.mode)) {
    issues.push({ field: 'permissions.defaultMode', ok: false, reasonId: 'invalid-permission-mode' });
  }

  if (state.scalars?.effortLevel) {
    const effort = validateEffortLevel(state.scalars.effortLevel);
    if (!effort.ok) issues.push({ field: 'effortLevel', ok: false, reasonId: 'invalid-effort-level' });
  }

  if (
    state.scalars?.cleanupPeriodDays !== undefined &&
    (!Number.isInteger(state.scalars.cleanupPeriodDays) || state.scalars.cleanupPeriodDays < 1)
  ) {
    issues.push({ field: 'cleanupPeriodDays', ok: false, reasonId: 'cleanup-period-too-low' });
  }

  for (const effect of ['allow', 'deny', 'ask'] as const) {
    for (const rule of state.permissions[effect]) {
      if (!validatePermissionRule(rule).ok) {
        issues.push({ field: `permissions.${effect}`, ok: false, reasonId: 'invalid-permission-rule' });
      }
    }
  }

  for (const hook of state.hooks) {
    const recipe = getHookRecipe(hook.recipeId);
    if (!recipe) {
      issues.push({ field: 'hooks', ok: false, reasonId: 'unknown-hook-recipe' });
    } else if (recipe.event !== hook.event) {
      issues.push({ field: 'hooks', ok: false, reasonId: 'hook-event-mismatch' });
    }
  }

  return issues;
}

export function buildSettings(state: BuilderState): Record<string, unknown> {
  const permissions: Record<string, unknown> = {};
  const allow = unique(state.permissions.allow.map((rule) => rule.trim()).filter(Boolean));
  const deny = unique(state.permissions.deny.map((rule) => rule.trim()).filter(Boolean));
  const ask = unique(state.permissions.ask.map((rule) => rule.trim()).filter(Boolean));
  const additionalDirectories = unique(
    state.additionalDirectories.map((directory) => directory.trim()).filter(Boolean),
  );

  if (state.mode) permissions.defaultMode = state.mode;
  if (allow.length > 0) permissions.allow = allow;
  if (deny.length > 0) permissions.deny = deny;
  if (ask.length > 0) permissions.ask = ask;
  if (additionalDirectories.length > 0) permissions.additionalDirectories = additionalDirectories;

  const settings: Record<string, unknown> = {
    $schema: 'https://json.schemastore.org/claude-code-settings.json',
  };
  if (Object.keys(permissions).length > 0) settings.permissions = permissions;
  if (state.scalars?.model) settings.model = state.scalars.model;
  if (state.scalars?.defaultShell) settings.defaultShell = state.scalars.defaultShell;
  if (state.scalars?.effortLevel && validateEffortLevel(state.scalars.effortLevel).ok) {
    settings.effortLevel = state.scalars.effortLevel;
  }
  if (state.scalars?.cleanupPeriodDays !== undefined && state.scalars.cleanupPeriodDays >= 1) {
    settings.cleanupPeriodDays = state.scalars.cleanupPeriodDays;
  }

  const hooks = buildHooks(state.hooks);
  if (Object.keys(hooks).length > 0) settings.hooks = hooks;

  return settings;
}

function buildHooks(hooks: BuilderState['hooks']): Record<string, HookMatcherEntry[]> {
  const byEvent: Record<string, HookMatcherEntry[]> = {};

  for (const selected of hooks) {
    const recipe = getHookRecipe(selected.recipeId);
    if (!recipe || recipe.event !== selected.event || recipe.hookType !== 'command' || !recipe.command) {
      continue;
    }

    const entry = {
      matcher: selected.matcher || recipe.matcher,
      hooks: [{ type: 'command' as const, command: recipe.command }],
    };
    const eventEntries = byEvent[selected.event] ?? [];
    const duplicate = eventEntries.some(
      (candidate) =>
        candidate.matcher === entry.matcher && candidate.hooks[0]?.command === entry.hooks[0]?.command,
    );
    if (!duplicate) byEvent[selected.event] = [...eventEntries, entry];
  }

  return byEvent;
}

export function mergeSettings(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): MergeResult {
  const merged = structuredClone(existing) as Record<string, unknown>;
  const conflicts: string[] = [];

  mergePermissions(merged, generated, conflicts);
  mergeHooks(merged, generated);

  for (const key of Object.keys(generated)) {
    if (key === '$schema' || key === 'permissions' || key === 'hooks') continue;
    const nextValue = generated[key];
    if (nextValue === undefined) continue;
    if (!(key in merged)) {
      merged[key] = nextValue;
    } else if (JSON.stringify(merged[key]) !== JSON.stringify(nextValue)) {
      conflicts.push(key);
    }
  }

  if (!('$schema' in merged) && '$schema' in generated) merged.$schema = generated.$schema;
  return { merged, conflicts };
}

function mergePermissions(
  merged: Record<string, unknown>,
  generated: Record<string, unknown>,
  conflicts: string[],
) {
  const generatedPermissions = generated.permissions;
  if (!isPlainRecord(generatedPermissions)) return;
  const existingPermissions = isPlainRecord(merged.permissions) ? merged.permissions : {};
  const nextPermissions: Record<string, unknown> = { ...existingPermissions };

  for (const key of ['allow', 'deny', 'ask', 'additionalDirectories']) {
    const existingArray = Array.isArray(existingPermissions[key]) ? existingPermissions[key] : [];
    const generatedArray = Array.isArray(generatedPermissions[key]) ? generatedPermissions[key] : [];
    const combined = unique([...existingArray, ...generatedArray].filter((item) => typeof item === 'string'));
    if (combined.length > 0) nextPermissions[key] = combined;
  }

  for (const [key, value] of Object.entries(generatedPermissions)) {
    if (['allow', 'deny', 'ask', 'additionalDirectories'].includes(key)) continue;
    if (!(key in nextPermissions)) {
      nextPermissions[key] = value;
    } else if (JSON.stringify(nextPermissions[key]) !== JSON.stringify(value)) {
      conflicts.push(`permissions.${key}`);
    }
  }

  merged.permissions = nextPermissions;
}

function mergeHooks(merged: Record<string, unknown>, generated: Record<string, unknown>) {
  if (!isPlainRecord(generated.hooks)) return;
  const existingHooks = isPlainRecord(merged.hooks) ? merged.hooks : {};
  const nextHooks: Record<string, unknown> = { ...existingHooks };

  for (const [event, generatedEntries] of Object.entries(generated.hooks)) {
    const existingEntries = Array.isArray(existingHooks[event]) ? existingHooks[event] : [];
    const entries = Array.isArray(generatedEntries) ? generatedEntries : [];
    const seen = new Set(existingEntries.map((entry) => JSON.stringify(entry)));
    const mergedEntries = [...existingEntries];
    for (const entry of entries) {
      const key = JSON.stringify(entry);
      if (!seen.has(key)) {
        seen.add(key);
        mergedEntries.push(entry);
      }
    }
    nextHooks[event] = mergedEntries;
  }

  merged.hooks = nextHooks;
}
