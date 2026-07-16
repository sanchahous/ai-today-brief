export type ProjectStack = 'typescript' | 'python' | 'generic';

export interface ClaudeMdInput {
  projectName: string;
  stack: ProjectStack;
  includePlanMode: boolean;
  includeTests: boolean;
  includeLint: boolean;
}

export interface ClaudeMdDocuments {
  agentsMd: string;
  claudeMd: string;
}

const STACK_COMMANDS: Record<ProjectStack, { build: string; test: string; lint: string }> = {
  typescript: { build: 'npm run build', test: 'npm test', lint: 'npm run lint' },
  python: { build: 'python -m build', test: 'pytest', lint: 'ruff check .' },
  generic: {
    build: '<project build command>',
    test: '<project test command>',
    lint: '<project lint command>',
  },
};

function safeProjectName(value: string): string {
  const trimmed = value.trim().replace(/\s+/gu, ' ');
  return trimmed || 'This project';
}

export function generateClaudeMdDocuments(input: ClaudeMdInput): ClaudeMdDocuments {
  const projectName = safeProjectName(input.projectName);
  const commands = STACK_COMMANDS[input.stack];
  const verification = [
    input.includeLint ? `- Run \`${commands.lint}\` after relevant code changes.` : null,
    input.includeTests ? `- Run \`${commands.test}\` for changed behavior.` : null,
    `- Run \`${commands.build}\` before handing off a release-sensitive change.`,
  ].filter(Boolean);

  const agentsMd = [
    `# ${projectName} — Agent Instructions`,
    '',
    '## Working agreement',
    '- Read nearby code and existing conventions before editing.',
    '- Keep changes focused; do not rewrite unrelated files.',
    '- Explain assumptions and flag decisions that need product-owner approval.',
    '',
    '## Code quality',
    '- Prefer the project’s existing libraries and patterns over introducing new dependencies.',
    '- Add or update focused tests when behavior changes.',
    '- Do not expose credentials, tokens, or private user data in code, logs, or commits.',
    '',
    '## Verification',
    ...verification,
    '',
    '## Git hygiene',
    '- Preserve unrelated local changes.',
    '- Use descriptive commits and do not force-push shared branches without approval.',
    '',
  ].join('\n');

  const claudeRules = [
    input.includePlanMode
      ? '- Use plan mode before multi-file changes, migrations, dependency updates, or external side effects.'
      : '- State a short implementation plan before changes that touch multiple files.',
    '- Treat AGENTS.md as the shared source of truth for repository conventions.',
    '- Keep CLAUDE.md concise; move detailed, on-demand procedures into `.claude/skills/` or docs.',
  ];

  const claudeMd = ['@AGENTS.md', '', '## Claude Code', ...claudeRules, ''].join('\n');

  return { agentsMd, claudeMd };
}
