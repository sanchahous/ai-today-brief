import { describe, expect, it } from 'vitest';

import { generateClaudeMdDocuments } from './claude-md-generator';

describe('generateClaudeMdDocuments', () => {
  it('keeps shared guidance in AGENTS.md and imports it from CLAUDE.md', () => {
    const docs = generateClaudeMdDocuments({
      projectName: 'AI Today Brief',
      stack: 'typescript',
      includePlanMode: true,
      includeTests: true,
      includeLint: true,
    });

    expect(docs.agentsMd).toContain('# AI Today Brief — Agent Instructions');
    expect(docs.agentsMd).toContain('`npm run lint`');
    expect(docs.agentsMd).toContain('`npm test`');
    expect(docs.claudeMd).toMatch(/^@AGENTS\.md/u);
    expect(docs.claudeMd).toContain('Use plan mode');
  });

  it('uses safe placeholders for generic projects and a fallback project name', () => {
    const docs = generateClaudeMdDocuments({
      projectName: '   ',
      stack: 'generic',
      includePlanMode: false,
      includeTests: false,
      includeLint: false,
    });

    expect(docs.agentsMd).toContain('# This project — Agent Instructions');
    expect(docs.agentsMd).toContain('`<project build command>`');
    expect(docs.agentsMd).not.toContain('<project test command>');
    expect(docs.claudeMd).toContain('State a short implementation plan');
  });
});
