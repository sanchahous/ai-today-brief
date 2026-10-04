import { expect, test, type Locator, type Page } from '@playwright/test';
import { getStrings } from '../src/lib/i18n';
import { gotoNewsPage, NEWS_DESKTOP_VIEWPORT } from './helpers/news-page';

async function hydrated(page: Page) {
  await expect(page.getByTestId('news-feed')).toHaveAttribute('data-hydrated', 'true', {
    timeout: 30_000,
  });
}

async function results(page: Page) {
  return page
    .getByTestId('story-card')
    .locator('h3 a, h2 a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
}

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 100; step += 1) {
    if (await target.evaluate((node) => node === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

// D12 replaces moderated sessions with automation, not evidence of human task completion.
// These eight tasks use the site's published data, never intercepted fixture responses.
for (const lang of ['en', 'uk'] as const) {
  for (const theme of ['dark', 'light'] as const) {
    test.describe(`News slice acceptance ${lang} ${theme} (G4/G14)`, () => {
      const t = getStrings(lang).news;

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
      });

      test('1: filter and sort are on the first screen at 360–1440px', async ({ page }) => {
        test.setTimeout(90_000);
        for (const width of [360, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await gotoNewsPage(page, lang);
          await expect(page.locator('#news-sort-top')).toBeInViewport();
          const filters =
            width < 960
              ? page.getByRole('button', { name: new RegExp(t.filters) })
              : page.getByTestId('news-sidebar').getByRole('checkbox').first();
          await expect(filters).toBeInViewport();
        }
      });

      test('2: Agents & MCP within seven days, with Back and Forward', async ({ page }) => {
        await gotoNewsPage(page, lang);
        const sidebar = page.getByTestId('news-sidebar');
        const agents = sidebar.getByRole('checkbox', { name: /Agents.*MCP|Агенти.*MCP/i });
        await agents.check();
        const categoryUrl = page.url();
        await sidebar.getByRole('button', { name: t.dateWeek, exact: true }).click();
        await expect(page).toHaveURL(/categories=agents-and-mcp.*date=week/);
        const weekUrl = page.url();
        const links = await results(page);
        // An empty week is valid for real data; the state must still be explicit and restorable.
        await expect(page.getByTestId('active-filter-chips')).toContainText(t.dateWeek);
        for (const href of links) expect(href).toContain('/news/agents-and-mcp/');
        const dates = await page
          .getByTestId('story-card')
          .locator('time')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''));
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        for (const date of dates) expect(date >= cutoff.toISOString().slice(0, 10)).toBe(true);
        await page.goBack();
        await expect(page).toHaveURL(categoryUrl);
        await expect(agents).toBeChecked();
        await expect(sidebar.getByRole('button', { name: t.dateAll, exact: true })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await page.goForward();
        await expect(page).toHaveURL(weekUrl);
        await expect(
          sidebar.getByRole('button', { name: t.dateWeek, exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => results(page)).toEqual(links);
      });

      test('3: topic AND category, with OR within the topics facet', async ({ page }) => {
        await gotoNewsPage(page, lang);
        const sidebar = page.getByTestId('news-sidebar');
        await sidebar.getByRole('checkbox', { name: /Agents.*MCP|Агенти.*MCP/i }).check();
        const topics = sidebar
          .locator('section')
          .filter({ has: page.getByRole('heading', { name: t.filterTopics, exact: true }) });
        const topic = topics.getByRole('checkbox').first();
        await expect(topic).toBeVisible();
        await topic.check();
        await expect(page).toHaveURL(/categories=agents-and-mcp.*topics=/);
        await expect(topic).toBeChecked();
        await expect(topics).toContainText(t.facetLogicNote);
        await expect(
          page
            .getByTestId('active-filter-chips')
            .getByRole('button', { name: /Remove topic|Прибрати тему/i }),
        ).toHaveCount(2);
        const firstTopicResults = await results(page);
        expect(firstTopicResults.length).toBeGreaterThan(0);
        for (const href of firstTopicResults) expect(href).toContain('/news/agents-and-mcp/');
        // Selected topics stay available when another topic is added.
        const secondTopic = topics.getByRole('checkbox').nth(1);
        await expect(secondTopic).toBeVisible();
        await secondTopic.check();
        await expect(topic).toBeChecked();
        await expect(secondTopic).toBeChecked();
        expect(new URL(page.url()).searchParams.get('topics')?.split(',')).toHaveLength(2);
        for (const href of await results(page)) expect(href).toContain('/news/agents-and-mcp/');
      });

      test('4: remove one chip, then Reset all', async ({ page }) => {
        await gotoNewsPage(page, lang);
        const baseline = await results(page);
        const sidebar = page.getByTestId('news-sidebar');
        await sidebar.getByRole('checkbox', { name: /Agents.*MCP|Агенти.*MCP/i }).check();
        const topic = sidebar
          .locator('section')
          .filter({ has: page.getByRole('heading', { name: t.filterTopics, exact: true }) })
          .getByRole('checkbox')
          .first();
        await topic.check();
        await sidebar.getByRole('button', { name: t.dateMonth, exact: true }).click();
        await page
          .getByTestId('active-filter-chips')
          .getByRole('button', { name: /Remove topic month|Прибрати тему month/i })
          .click();
        await expect(page).not.toHaveURL(/date=/);
        await expect(page).toHaveURL(/categories=agents-and-mcp.*topics=/);
        await expect(topic).toBeChecked();
        await page
          .getByTestId('active-filter-chips')
          .getByRole('button', { name: t.filterReset, exact: true })
          .click();
        await expect(page).toHaveURL(new RegExp(`/${lang}/news$`));
        await expect(page.getByTestId('active-filter-chips')).toHaveCount(0);
        await expect(sidebar.getByRole('checkbox', { checked: true })).toHaveCount(0);
        await expect(page.locator('#news-sort-top')).toHaveValue('newest');
        await expect.poll(() => results(page)).toEqual(baseline);
      });

      test('5: page 2 → article → Back restores filters, sort and stories', async ({ page }) => {
        await gotoNewsPage(page, lang);
        await page
          .getByTestId('news-sidebar')
          .getByRole('checkbox', { name: /Agents.*MCP|Агенти.*MCP/i })
          .check();
        await page.locator('#news-sort-top').selectOption('oldest');
        const pagination = page.getByTestId('pagination');
        const page2 = pagination.getByRole('link', { name: '2', exact: true });
        await expect(page2).toHaveAttribute(
          'href',
          /categories=agents-and-mcp.*sort=oldest.*page=2/,
        );
        await page2.click();
        await expect(page2).toHaveAttribute('aria-current', 'page');
        const url = page.url();
        const stories = await results(page);
        expect(stories.length).toBeGreaterThan(0);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await hydrated(page);
        await expect(page).toHaveURL(url);
        await expect(page2).toHaveAttribute('aria-current', 'page');
        await expect.poll(() => results(page)).toEqual(stories);
        const article = page.getByTestId('story-card').locator('h3 a, h2 a').first();
        const href = await article.getAttribute('href');
        await article.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.goBack();
        await hydrated(page);
        await expect(page).toHaveURL(url);
        await expect(page.locator('#news-sort-top')).toHaveValue('oldest');
        await expect(page2).toHaveAttribute('aria-current', 'page');
        await expect.poll(() => results(page)).toEqual(stories);
      });

      test('6: reload and a copied URL preserve the combined result set', async ({
        page,
        context,
      }) => {
        await gotoNewsPage(page, lang);
        const sidebar = page.getByTestId('news-sidebar');
        await sidebar.getByRole('checkbox', { name: /Agents.*MCP|Агенти.*MCP/i }).check();
        await sidebar
          .locator('section')
          .filter({ has: page.getByRole('heading', { name: t.filterTopics, exact: true }) })
          .getByRole('checkbox')
          .first()
          .check();
        await sidebar.getByRole('button', { name: t.dateMonth, exact: true }).click();
        await page.locator('#news-sort-top').selectOption('oldest');
        const url = page.url();
        const stories = await results(page);
        const status = await page.getByRole('status').textContent();
        const chips = await page.getByTestId('active-filter-chips').textContent();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await hydrated(page);
        await expect(page).toHaveURL(url);
        await expect.poll(() => results(page)).toEqual(stories);
        await expect(page.getByRole('status')).toHaveText(status ?? '');
        await expect(page.getByTestId('active-filter-chips')).toHaveText(chips ?? '');
        await expect(page.locator('#news-sort-top')).toHaveValue('oldest');
        const copied = await context.newPage();
        try {
          await copied.setViewportSize(NEWS_DESKTOP_VIEWPORT);
          await copied.addInitScript((value) => localStorage.setItem('theme', value), theme);
          await copied.goto(url, { waitUntil: 'domcontentloaded' });
          await hydrated(copied);
          await expect.poll(() => results(copied)).toEqual(stories);
          await expect(copied.getByRole('status')).toHaveText(status ?? '');
          await expect(copied.getByTestId('active-filter-chips')).toHaveText(chips ?? '');
          await expect(copied.locator('#news-sort-top')).toHaveValue('oldest');
        } finally {
          await copied.close();
        }
      });

      test('7: Newest orders dates; Relevance belongs to search; no engagement sort', async ({
        page,
      }) => {
        await gotoNewsPage(page, lang);
        const sort = page.locator('#news-sort-top');
        await expect(sort).toHaveValue('newest');
        expect(
          await sort
            .locator('option')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('value'))),
        ).toEqual(['newest', 'oldest']);
        await page.goto(`/${lang}/news/search?q=mcp`, { waitUntil: 'domcontentloaded' });
        await hydrated(page);
        await expect(sort).toHaveValue('relevance');
        expect(
          await sort
            .locator('option')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('value'))),
        ).toEqual(['relevance', 'newest', 'oldest']);
        const relevance = await results(page);
        expect(relevance.length).toBeGreaterThan(0);
        await sort.selectOption('newest');
        await expect(page).toHaveURL(/q=mcp.*sort=newest/);
        const dates = await page
          .getByTestId('story-card')
          .locator('time')
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime') ?? ''));
        expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
        await page.goBack();
        await expect(sort).toHaveValue('relevance');
        await expect.poll(() => results(page)).toEqual(relevance);
      });

      test('8: mobile drawer keyboard-only selection, focus trap and restoration', async ({
        page,
      }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoNewsPage(page, lang);
        const trigger = page.getByRole('button', { name: new RegExp(t.filters) });
        await tabTo(page, trigger);
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: t.filters, exact: true });
        await expect(dialog).toBeVisible();
        const agents = dialog.getByRole('checkbox', { name: /Agents.*MCP|Агенти.*MCP/i });
        await tabTo(page, agents);
        await page.keyboard.press('Space');
        await expect(agents).toBeChecked();
        const topic = dialog
          .locator('section')
          .filter({ has: page.getByRole('heading', { name: t.filterTopics, exact: true }) })
          .getByRole('checkbox')
          .first();
        await tabTo(page, topic);
        await page.keyboard.press('Space');
        await expect(topic).toBeChecked();
        const week = dialog.getByRole('button', { name: t.dateWeek, exact: true });
        await tabTo(page, week);
        await page.keyboard.press('Space');
        await expect(week).toHaveAttribute('aria-pressed', 'true');
        const done = dialog.getByRole('button', { name: /Done|Apply|Готово|Застосувати/i });
        await tabTo(page, done);
        await page.keyboard.press('Tab');
        await expect(
          dialog.getByRole('button', { name: /Close filters|Закрити фільтри/i }),
        ).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(done).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        await expect(page).toHaveURL(/categories=agents-and-mcp.*topics=.*date=week/);
        await page.keyboard.press('Enter');
        await expect(agents).toBeChecked();
        await expect(week).toHaveAttribute('aria-pressed', 'true');
        const reset = dialog.getByRole('button', { name: t.filterReset, exact: true });
        await tabTo(page, reset);
        await page.keyboard.press('Enter');
        await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`/${lang}/news$`));
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
      });
    });
  }
}

test('pagination boundaries clamp invalid pages and reset to page 1 on filtering', async ({
  page,
}) => {
  await page.setViewportSize(NEWS_DESKTOP_VIEWPORT);
  await page.goto('/en/news?page=999999', { waitUntil: 'domcontentloaded' });
  await hydrated(page);
  const pagination = page.getByTestId('pagination');
  await expect(pagination.locator('[aria-current="page"]')).toBeVisible();
  await expect(pagination.locator('a[rel="next"]')).toHaveCount(0);
  expect((await results(page)).length).toBeGreaterThan(0);
  await page.locator('#news-sort-top').selectOption('oldest');
  await expect(page).not.toHaveURL(/page=/);
  await expect(pagination.getByRole('link', { name: '1', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(pagination.locator('a[rel="prev"]')).toHaveCount(0);
  for (const value of ['0', '-1', 'invalid']) {
    await page.goto(`/en/news?page=${value}`, { waitUntil: 'domcontentloaded' });
    await hydrated(page);
    await expect(pagination.getByRole('link', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});
