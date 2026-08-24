import 'server-only';

const REPO_OWNER = 'sanchahous';
const REPO_NAME = 'ai-today-brief';
const WORKFLOW_FILE = 'daily-visual-finalizer.yml';
const TRANSIENT_DISPATCH_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const DISPATCH_RETRY_DELAYS_MS = [300, 900] as const;
const DISPATCH_MAX_ATTEMPTS = 3;

function validEditorialDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * A retry may target an older closed daily. Dispatch its exact frozen date
 * instead of waiting for the normal “previous day” cron window, which would
 * otherwise leave a safe queued recovery with no worker to claim it.
 */
export async function dispatchDailyVisualFinalizer(options: {
  editorialDate: string;
  ref?: string;
  fetchFn?: typeof fetch;
  waitFn?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  if (!validEditorialDate(options.editorialDate)) {
    throw new Error('Daily visual dispatch requires an ISO editorial date.');
  }
  const token = process.env.GH_ACTIONS_DISPATCH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'GH_ACTIONS_DISPATCH_TOKEN is not set. The recovery was queued safely; dispatch the daily visual finalizer manually after configuring the token.',
    );
  }
  const fetchFn = options.fetchFn ?? fetch;
  const waitFn =
    options.waitFn ??
    ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  for (let attempt = 1; attempt <= DISPATCH_MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetchFn(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: options.ref ?? 'main',
            inputs: { date: options.editorialDate },
          }),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown network error';
      if (attempt === DISPATCH_MAX_ATTEMPTS) {
        throw new Error(`[daily-visual-dispatch] network dispatch failed: ${message}`);
      }
      await waitFn(DISPATCH_RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }
    if (response.ok) return;
    const raw = await response.text();
    const error = new Error(
      `[daily-visual-dispatch] workflow dispatch failed: HTTP ${response.status}: ${raw.slice(0, 500)}`,
    );
    if (!TRANSIENT_DISPATCH_STATUS.has(response.status) || attempt === DISPATCH_MAX_ATTEMPTS) {
      throw error;
    }
    await waitFn(DISPATCH_RETRY_DELAYS_MS[attempt - 1]!);
  }
}
