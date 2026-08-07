import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CODEX_CLI_CONFIG, parseCodexExecEnvelope } from './codex';

describe('parseCodexExecEnvelope', () => {
  it('extracts the text of the last agent_message item.completed event', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'hello' } }),
      JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } }),
    ].join('\n');
    expect(parseCodexExecEnvelope(stdout)).toEqual({ text: 'hello', model: 'codex-cli', costUsd: 0 });
  });

  it('ignores non-agent_message item.completed events (e.g. reasoning)', () => {
    const stdout = [
      JSON.stringify({ type: 'item.completed', item: { type: 'reasoning', text: 'thinking...' } }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'final answer' } }),
    ].join('\n');
    expect(parseCodexExecEnvelope(stdout).text).toBe('final answer');
  });

  it('takes the last agent_message when more than one appears', () => {
    const stdout = [
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'first' } }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'second' } }),
    ].join('\n');
    expect(parseCodexExecEnvelope(stdout).text).toBe('second');
  });

  it('skips stray non-JSON lines instead of throwing', () => {
    const stdout = [
      'not json at all',
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'hi' } }),
    ].join('\n');
    expect(parseCodexExecEnvelope(stdout).text).toBe('hi');
  });

  it('throws a clear error when no agent_message event is present', () => {
    const stdout = JSON.stringify({ type: 'thread.started', thread_id: 't1' });
    expect(() => parseCodexExecEnvelope(stdout)).toThrow(/no agent_message/);
  });

  it('always reports costUsd 0 -- Codex exec JSONL never carries a dollar figure', () => {
    const stdout = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'x' } });
    expect(parseCodexExecEnvelope(stdout).costUsd).toBe(0);
  });
});

describe('CODEX_CLI_CONFIG', () => {
  it('is wired for the codex binary under CODEX_API_KEY', () => {
    expect(CODEX_CLI_CONFIG.binary).toBe('codex');
    expect(CODEX_CLI_CONFIG.authEnvVar).toBe('CODEX_API_KEY');
  });

  it('buildArgs runs exec in read-only sandbox, skipping the git-repo check, prompt last', () => {
    const args = CODEX_CLI_CONFIG.buildArgs('summarize this', {});
    expect(args).toEqual(['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only', 'summarize this']);
  });

  it('buildArgs appends --output-schema pointing at a real file containing the schema when jsonSchema is given', () => {
    const schema = { type: 'object', properties: { greeting: { type: 'string' } } };
    const args = CODEX_CLI_CONFIG.buildArgs('summarize this', { jsonSchema: schema });
    expect(args.slice(0, 5)).toEqual(['exec', '--json', '--skip-git-repo-check', '--sandbox', 'read-only']);
    expect(args[5]).toBe('--output-schema');
    const schemaPath = args[6]!;
    expect(schemaPath).toMatch(/schema\.json$/);
    expect(JSON.parse(readFileSync(schemaPath, 'utf8'))).toEqual(schema);
    expect(args[7]).toBe('summarize this');
  });
});
