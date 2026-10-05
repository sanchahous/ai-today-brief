import { expect, test } from '@playwright/test';
import { PROMPT_LINT_RULES } from '../src/lib/prompt-lint-rules';
import { HOOK_RECIPES } from '../src/lib/settings-builder-rules';

const ANALYTICS_HOSTS = ['www.google-analytics.com', 'www.googletagmanager.com', 'region1.google-analytics.com'];

function isThirdPartyRequest(url: string, baseHost: string): boolean {
  try {
    const host = new URL(url).hostname;
    if (host === baseHost || host.endsWith(`.${baseHost}`)) return false;
    return !ANALYTICS_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function requestContainsUserText(url: string, postData: string | null, secret: string): boolean {
  const haystack = `${url}\n${postData ?? ''}`;
  return haystack.includes(secret);
}

test.describe('Tool workspaces privacy and catalogs', () => {
  test('prompt optimizer sends no user text and no third-party requests during lint', async ({
    page,
    baseURL,
  }) => {
    const secret = `e2e-prompt-secret-${Date.now()}`;
    const baseHost = new URL(baseURL ?? 'http://127.0.0.1:3000').hostname;
    let thirdPartyCalls = 0;
    let leakedTextCalls = 0;

    page.on('request', (request) => {
      const url = request.url();
      const postData = request.postData();
      if (requestContainsUserText(url, postData, secret)) leakedTextCalls++;
      if (isThirdPartyRequest(url, baseHost)) thirdPartyCalls++;
    });

    await page.goto('/en/tools/prompt-optimizer');
    await page.getByLabel('Prompt to lint').fill(secret);
    await page.getByRole('button', { name: 'Run local lint' }).click();
    await expect(page.getByText(/issue|suggestion|info/i)).toBeVisible();

    expect(leakedTextCalls, 'user prompt must not leave the page').toBe(0);
    expect(thirdPartyCalls, 'no unexpected third-party requests').toBe(0);
  });

  test('settings builder sends no user text and no third-party requests during build', async ({
    page,
    baseURL,
  }) => {
    const baseHost = new URL(baseURL ?? 'http://127.0.0.1:3000').hostname;
    let thirdPartyCalls = 0;

    page.on('request', (request) => {
      if (isThirdPartyRequest(request.url(), baseHost)) thirdPartyCalls++;
    });

    await page.goto('/en/tools/settings-builder');
    await page.getByRole('button', { name: 'Build settings.json' }).click();
    await expect(page.getByRole('code')).toContainText('permissions');

    expect(thirdPartyCalls, 'no unexpected third-party requests').toBe(0);
  });

  test('claude-md generator sends no user text and no third-party requests during generate', async ({
    page,
    baseURL,
  }) => {
    const secret = `e2e-project-${Date.now()}`;
    const baseHost = new URL(baseURL ?? 'http://127.0.0.1:3000').hostname;
    let thirdPartyCalls = 0;
    let leakedTextCalls = 0;

    page.on('request', (request) => {
      const url = request.url();
      const postData = request.postData();
      if (requestContainsUserText(url, postData, secret)) leakedTextCalls++;
      if (isThirdPartyRequest(url, baseHost)) thirdPartyCalls++;
    });

    await page.goto('/en/tools/claude-md-generator');
    await page.getByLabel('Project name').fill(secret);
    await page.getByRole('button', { name: 'Generate docs' }).click();
    await expect(page.getByRole('code')).toContainText(secret);

    expect(leakedTextCalls, 'project name must not leave the page').toBe(0);
    expect(thirdPartyCalls, 'no unexpected third-party requests').toBe(0);
  });

  test('rule catalogs are present in HTML without JavaScript', async ({ request }) => {
    const promptHtml = await (await request.get('/en/tools/prompt-optimizer')).text();
    expect(promptHtml).toContain('id="prompt-rules"');
    expect(promptHtml).toContain(PROMPT_LINT_RULES[0].id);

    const settingsHtml = await (await request.get('/en/tools/settings-builder')).text();
    expect(settingsHtml).toContain('id="settings-catalog"');
    expect(settingsHtml).toContain(HOOK_RECIPES[0].id);
  });

  test('invalid prompt focuses first invalid field with aria-describedby error', async ({ page }) => {
    await page.goto('/en/tools/prompt-optimizer');
    await page.getByRole('button', { name: 'Run local lint' }).click();
    const textarea = page.getByLabel('Prompt to lint');
    await expect(textarea).toBeFocused();
    await expect(textarea).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText('Paste a prompt first');
  });
});
