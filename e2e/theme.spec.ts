import { expect, test, type Page } from '@playwright/test';
import { gotoNewsPage, NEWS_DESKTOP_VIEWPORT } from './helpers/news-page';
import AxeBuilder from '@axe-core/playwright';

async function expectTheme(page: Page, theme: 'light' | 'dark') {
  const day = theme === 'light';
  await expect(page.locator('html')).toHaveAttribute('data-theme', day ? 'day' : 'night');
  if (day) await expect(page.locator('html')).toHaveClass(/theme-light/);
  else await expect(page.locator('html')).not.toHaveClass(/theme-light/);
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).colorScheme)).toBe(theme);
  await expect(page.locator('meta[name="theme-color"][media="all"]')).toHaveAttribute(
    'content',
    day ? '#efe8da' : '#171918',
  );
}

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    await gotoNewsPage(page);
  });

  function themeToggle(page: Page) {
    return page.getByRole('navigation', { name: 'Primary' }).getByTestId('theme-toggle');
  }

  test('toggles light theme class on html', async ({ page }) => {
    const toggle = themeToggle(page);
    await expect(toggle).toBeEnabled();

    const html = page.locator('html');
    const wasLight = await html.evaluate((el) => el.classList.contains('theme-light'));

    await toggle.click();
    await expectTheme(page, wasLight ? 'dark' : 'light');
    if (wasLight) {
      await expect(html).not.toHaveClass(/theme-light/);
    } else {
      await expect(html).toHaveClass(/theme-light/);
    }

    await toggle.click();
    await expectTheme(page, wasLight ? 'light' : 'dark');
    if (wasLight) {
      await expect(html).toHaveClass(/theme-light/);
    } else {
      await expect(html).not.toHaveClass(/theme-light/);
    }
  });

  test('persists theme preference after reload', async ({ page }) => {
    const toggle = themeToggle(page);
    await expect(toggle).toBeEnabled();

    const html = page.locator('html');
    const isLight = await html.evaluate((el) => el.classList.contains('theme-light'));

    if (isLight) {
      await toggle.click();
      await expect(html).not.toHaveClass(/theme-light/);
    }
    await toggle.click();
    await expect(html).toHaveClass(/theme-light/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(themeToggle(page)).toBeEnabled();
    await expect(html).toHaveClass(/theme-light/);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('light');
    await expectTheme(page, 'light');
  });

  test('keeps analytics values light/dark and respects opt-out', async ({ page }) => {
    test.skip(
      await page.evaluate(() => typeof window.gtag !== 'function'),
      'GA4 is not configured in this build; analytics-client unit tests cover the transport',
    );
    const calls: unknown[][] = [];
    await page.exposeFunction('captureThemeGtag', (...args: unknown[]) => calls.push(args));
    await page.evaluate(() => {
      // Playwright sets navigator.webdriver; analytics-client blocks all sends when it is true.
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true,
      });
      // Test transport: prevent network writes while capturing the actual client calls.
      window.gtag = (...args: unknown[]) => {
        // The exposed binding exists only in this test page.
        const capture = Reflect.get(window, 'captureThemeGtag');
        void capture(...args);
      };
      localStorage.setItem(
        'atb-consent-v1',
        JSON.stringify({ analytics: true, ads: false, updatedAt: '2026-09-30' }),
      );
    });
    const wasLight = await page
      .locator('html')
      .evaluate((el) => el.classList.contains('theme-light'));
    for (const toTheme of [wasLight ? 'dark' : 'light', wasLight ? 'light' : 'dark']) {
      await themeToggle(page).click();
      await expect
        .poll(() => calls.filter((call) => call[1] === 'theme_toggle').length)
        .toBeGreaterThan(0);
      expect(calls).toContainEqual(['set', 'user_properties', { theme: toTheme }]);
      const event = calls.find(
        (call) => call[1] === 'theme_toggle' && JSON.stringify(call[2]).includes(toTheme),
      );
      expect(event?.[2]).toMatchObject({ to_theme: toTheme });
    }
    const before = calls.length;
    await page.evaluate(() =>
      localStorage.setItem(
        'atb-consent-v1',
        JSON.stringify({ analytics: false, ads: false, updatedAt: '2026-09-30' }),
      ),
    );
    await themeToggle(page).click();
    expect(calls.length).toBe(before);
  });

  test('keeps hidden and visible controls in sync after resizing and soft navigation', async ({
    page,
  }) => {
    await themeToggle(page).click();
    const name = await themeToggle(page).getAttribute('aria-label');
    for (const button of await page.getByTestId('theme-toggle').all()) {
      await expect(button).toHaveAttribute('aria-label', name!);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = page.getByTestId('theme-toggle').filter({ visible: true });
    await expect(mobile).toHaveAttribute('aria-label', name!);
    await mobile.click();
    await expect(mobile).not.toHaveAttribute('aria-label', name!);
    await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
    const theme = await page.locator('html').getAttribute('data-theme');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /digests|дайджести/i })
      .click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
    await expectTheme(page, theme === 'day' ? 'light' : 'dark');
  });
});

test.describe('Theme before hydration', () => {
  for (const scenario of [
    { stored: 'dark', system: 'light', theme: 'dark' },
    { stored: 'light', system: 'dark', theme: 'light' },
    { stored: null, system: 'light', theme: 'light' },
    { stored: null, system: 'dark', theme: 'dark' },
    { stored: 'invalid', system: 'light', theme: 'light' },
    { stored: 'blocked', system: 'light', theme: 'light' },
  ] as const) {
    test(`first body frame: ${scenario.stored} / system ${scenario.system}`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme: scenario.system });
      await page.route('**/_next/**/*.js*', (route) => route.abort());
      await page.addInitScript(
        ({ stored }) => {
          if (stored === 'blocked') {
            Object.defineProperty(window, 'localStorage', {
              get() {
                throw new Error('Storage blocked');
              },
            });
          } else if (stored) localStorage.setItem('theme', stored);
          else localStorage.removeItem('theme');
          const frame = () => {
            const body = document.body;
            if (!body || !body.textContent?.trim()) {
              requestAnimationFrame(frame);
              return;
            }
            const root = document.documentElement;
            root.dataset.firstBodyFrame = JSON.stringify({
              theme: root.dataset.theme,
              light: root.classList.contains('theme-light'),
              scheme: getComputedStyle(root).colorScheme,
              bg: getComputedStyle(body).backgroundColor,
              color: document
                .querySelector('meta[name="theme-color"][media="all"]')
                ?.getAttribute('content'),
            });
          };
          requestAnimationFrame(frame);
        },
        { stored: scenario.stored },
      );
      await page.goto('/uk/news', { waitUntil: 'load' });
      await expect(page.locator('html')).toHaveAttribute('data-first-body-frame', /./);
      const day = scenario.theme === 'light';
      const frame = JSON.parse((await page.locator('html').getAttribute('data-first-body-frame'))!);
      expect(frame).toEqual({
        theme: day ? 'day' : 'night',
        light: day,
        scheme: scenario.theme,
        bg: day ? 'rgb(239, 232, 218)' : 'rgb(23, 25, 24)',
        color: day ? '#efe8da' : '#171918',
      });
      await expect(page.getByTestId('theme-toggle').filter({ visible: true })).toBeDisabled();
      await expectTheme(page, scenario.theme);
      await testInfo.attach('first-body-frame', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    });
  }

  for (const lang of ['en', 'uk'] as const) {
    test(`Night with JavaScript disabled: ${lang}`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'light' });
      try {
        const page = await context.newPage();
        await page.goto(`/${lang}/news`);
        await expectTheme(page, 'dark');
        // The existing locale Suspense shell needs JS to reveal streamed content;
        // the server-rendered chrome still demonstrates readable no-JS theme text.
        await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
        await expect(
          page
            .getByRole('navigation', { name: 'Primary' })
            .getByRole('link', { name: lang === 'en' ? 'News' : 'Новини', exact: true }),
        ).toBeVisible();
        expect(await page.locator('body').evaluate((el) => getComputedStyle(el).color)).toBe(
          'rgb(240, 233, 220)',
        );
      } finally {
        await context.close();
      }
    });
  }

  test('manifest uses the Night token for splash and chrome', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({
      background_color: '#171918',
      theme_color: '#171918',
      start_url: '/en',
    });
  });
});

test.describe('Theme control accessibility matrix', () => {
  for (const lang of ['en', 'uk'] as const)
    for (const theme of ['dark', 'light'] as const)
      for (const width of [360, 390, 768, 1024, 1440, 320, 1280]) {
        test(`${lang} ${theme} ${width}${width === 1280 ? ' text-200' : ''}`, async ({
          page,
          browserName,
          context,
        }) => {
          test.skip(
            width === 1280 && browserName !== 'chromium',
            'Browser font emulation requires CDP',
          );
          await page.setViewportSize({ width, height: 900 });
          if (width === 1280) {
            const cdp = await context.newCDPSession(page);
            await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
          }
          await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
          const errors: string[] = [];
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => {
            // Firefox reports the image CDN's rejected Cloudflare cookie as an error;
            // it is external to the theme and remains visible in the full page QA report.
            const cdnCookie =
              browserName === 'firefox' &&
              message.text().includes('Cookie “__cf_bm” has been rejected for invalid domain.');
            if (message.type() === 'error' && !cdnCookie) errors.push(message.text());
          });
          await gotoNewsPage(page, lang);
          const toggle = page.getByTestId('theme-toggle').filter({ visible: true });
          await expect(toggle).toBeEnabled();
          await expectTheme(page, theme);
          const labels =
            lang === 'en'
              ? { dark: 'Switch to day theme', light: 'Switch to night theme' }
              : { dark: 'Увімкнути денну тему', light: 'Увімкнути нічну тему' };
          await expect(toggle).toHaveAccessibleName(labels[theme]);
          const rect = await toggle.boundingBox();
          // Firefox may report 43.999969px for a computed 44px control.
          expect(Number(rect?.width.toFixed(2))).toBeGreaterThanOrEqual(44);
          expect(Number(rect?.height.toFixed(2))).toBeGreaterThanOrEqual(44);
          expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(width);
          if (width === 1280)
            expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe(
              '32px',
            );
          const axe = await new AxeBuilder({ page })
            .include('[data-testid="theme-toggle"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(axe.violations).toEqual([]);
          await toggle.focus();
          await expect(toggle).toBeFocused();
          await page.keyboard.press('Enter');
          await expectTheme(page, theme === 'dark' ? 'light' : 'dark');
          expect(errors).toEqual([]);
        });
      }
});
