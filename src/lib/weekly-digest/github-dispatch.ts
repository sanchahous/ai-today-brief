/**
 * Triggers the weekly-master-cli-worker GitHub Actions workflow on demand.
 * That workflow runs on a real GitHub Actions runner, the only place the
 * `claude` binary and CLAUDE_CODE_OAUTH_TOKEN are available — Vercel's
 * serverless functions can never run it directly (see pipeline/claude-cli.ts).
 */
import 'server-only';

const REPO_OWNER = 'sanchahous';
const REPO_NAME = 'ai-today-brief';
const WORKFLOW_FILE = 'weekly-master-cli-worker.yml';

export async function dispatchWeeklyMasterCliWorker(
  options: { ref?: string; fetchFn?: typeof fetch } = {},
): Promise<void> {
  const token = process.env.GH_ACTIONS_DISPATCH_TOKEN?.trim();
  if (!token) {
    throw new Error('GH_ACTIONS_DISPATCH_TOKEN is not set. Add it in Vercel to enable this action.');
  }
  const fetchFn = options.fetchFn ?? fetch;
  const response = await fetchFn(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: options.ref ?? 'main' }),
    },
  );
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `[github-dispatch] workflow dispatch failed: HTTP ${response.status}: ${raw.slice(0, 500)}`,
    );
  }
}
