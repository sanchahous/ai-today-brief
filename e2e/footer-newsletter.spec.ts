import { expect, test, type Locator, type Page } from '@playwright/test';

import { VIEWPORTS } from './helpers/viewports';

// Home page carries both the newsletter band and the site footer.
const HOME = '/en';
const SUBSCRIBE_PAGE = '/en/subscribe';

const MOBILE_VIEWPORTS = [VIEWPORTS.phone320, VIEWPORTS.phone390] as const;

/** Wait until the client NewsletterForm is hydrated (noValidate blocks native GET ?email= submits). */
async function readyNewsletterForm(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.scrollIntoViewIfNeeded();
  await expect(emailInput).toBeVisible({ timeout: 10_000 });
  const form = page.locator('form').filter({ has: emailInput }).first();
  await expect(form).toHaveAttribute('novalidate', '');
  return {
    emailInput,
    form,
    submitBtn: form.locator('button[type="submit"]'),
  };
}

/** Controlled checkbox — custom mark intercepts pointer events; keyboard matches fields.spec.ts. */
async function toggleConsent(form: Locator, page: Page) {
  const consent = form.getByRole('checkbox', { name: /agree to the privacy policy/i });
  await consent.focus();
  await page.keyboard.press('Space');
  await expect(consent).toBeChecked();
}

/** Controlled SegmentedControl radios — keyboard, not .check({ force }), under parallel workers. */
async function selectEdition(form: Locator, page: Page, label: string) {
  const edition = form.getByRole('radiogroup', { name: /edition language/i });
  const target = edition.getByRole('radio', { name: label, exact: true });
  if (label === 'Українська') {
    await edition.getByRole('radio', { name: 'English', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
  } else {
    await target.focus();
    await page.keyboard.press('Space');
  }
  await expect(target).toBeChecked();
}

async function getDataLayerEvents(page: Page, eventName: string) {
  return page.evaluate((name) => {
    const dl = (window as unknown as { dataLayer?: Array<{ event?: string; [key: string]: unknown }> }).dataLayer ?? [];
    return dl.filter((entry) => entry.event === name);
  }, eventName);
}

test.describe('Footer and newsletter band layout', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test(`newsletter email input and submit button fit within ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('header').first()).toBeVisible({ timeout: 30_000 });

      // The NewsletterBand is wrapped in a <Reveal> that may defer rendering until
      // the element enters the viewport — scroll it into view before asserting.
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.scrollIntoViewIfNeeded();
      await expect(emailInput).toBeVisible({ timeout: 10_000 });

      const form = page
        .locator('form')
        .filter({ has: page.locator('input[type="email"]') })
        .first();
      const submitBtn = form.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();

      const btnBox = await submitBtn.boundingBox();
      expect(btnBox, 'submit button has no bounding box').not.toBeNull();
      // Button must be fully within the viewport — not clipped on the right.
      expect(btnBox!.x, 'button starts left of viewport').toBeGreaterThanOrEqual(0);
      expect(
        btnBox!.x + btnBox!.width,
        'submit button is clipped on the right edge',
      ).toBeLessThanOrEqual(vp.width + 1);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1);
    });

    test(`footer nav link tap targets are >= 40px tall at ${vp.width}px`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });

      const footerNav = page.locator('footer').getByRole('navigation', { name: /footer/i });
      await expect(footerNav).toBeVisible({ timeout: 30_000 });

      const links = footerNav.getByRole('link');
      const count = await links.count();
      expect(count, 'no links found in footer navigation').toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const box = await link.boundingBox();
        expect(box, `footer link #${i} has no bounding box`).not.toBeNull();
        const label = (await link.textContent())?.trim() ?? `link #${i}`;
        expect(
          box!.height,
          `"${label}" tap target height ${box!.height}px is below the 40px minimum`,
        ).toBeGreaterThanOrEqual(40);
      }
    });
  }

  test('footer renders columns side-by-side at 1280px without overflow', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop1280);
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('footer').first()).toBeVisible({ timeout: 30_000 });

    const colMetrics = await page.locator('footer').evaluate((footer) => {
      const contentDiv = footer.children[0] as Element | undefined;
      if (!contentDiv) return [];
      const flexRow = contentDiv.children[0] as Element | undefined;
      if (!flexRow) return [];
      return Array.from(flexRow.children).map((el) => ({
        left: Math.round(el.getBoundingClientRect().left),
      }));
    });

    expect(
      colMetrics.length,
      'footer flex row has fewer than 2 column blocks',
    ).toBeGreaterThanOrEqual(2);

    const lefts = colMetrics.map((c) => c.left);
    const spread = Math.max(...lefts) - Math.min(...lefts);
    expect(
      spread,
      `footer columns are stacked, not side-by-side (horizontal spread: ${spread}px)`,
    ).toBeGreaterThan(40);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow at 1280px').toBeLessThanOrEqual(1);
  });
});

test.describe('NewsletterForm state machine and interaction contract (AH-3.4)', () => {
  test('reproduces invalid state on empty or malformed email without network call', async ({ page }) => {
    let networkCalls = 0;
    await page.route('/api/subscribe', async (route) => {
      networkCalls++;
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    const { emailInput, form, submitBtn } = await readyNewsletterForm(page, HOME);

    // 1. Submit with empty email
    await submitBtn.click();
    await expect(form.locator('[role="alert"]')).toBeVisible();
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(networkCalls, 'no network call on invalid input').toBe(0);

    // 2. Submit with malformed email
    await emailInput.fill('invalid-email-address');
    await submitBtn.click();
    await expect(form.locator('[role="alert"]')).toBeVisible();
    expect(networkCalls, 'no network call on malformed email').toBe(0);

    // Analytics verify newsletter_submit_error was emitted with invalid_email
    const errorEvents = await getDataLayerEvents(page, 'newsletter_submit_error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0]).toMatchObject({
      reason: 'invalid_email',
    });
  });

  test('reproduces pending state and guarantees double click sends only 1 request', async ({ page }) => {
    let requestsReceived = 0;
    await page.route('/api/subscribe', async (route) => {
      requestsReceived++;
      // Delay response to inspect pending state
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    const { emailInput, form, submitBtn } = await readyNewsletterForm(page, HOME);

    await emailInput.fill('builder@example.com');

    // Double click rapidly
    await Promise.all([
      submitBtn.click({ clickCount: 2 }),
    ]);

    // During pending state, button must have aria-busy="true" and be disabled
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    await expect(form).toHaveAttribute('aria-busy', 'true');

    // Wait for resolution
    await expect(page.locator('[role="status"]').first()).toBeVisible({ timeout: 10_000 });
    expect(requestsReceived, 'double click must result in exactly 1 network request').toBe(1);
  });

  test('reproduces success state on 2xx response with confirmation copy', async ({ page }) => {
    await page.route('/api/subscribe', async (route) => {
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    const { emailInput, submitBtn } = await readyNewsletterForm(page, HOME);

    await emailInput.fill('new-reader@example.com');
    await submitBtn.click();

    const statusEl = page.locator('[role="status"]').first();
    await expect(statusEl).toBeVisible({ timeout: 10_000 });
    await expect(statusEl).toContainText(/confirm|inbox|підтверд/i);

    const subscribeEvents = await getDataLayerEvents(page, 'newsletter_subscribe');
    expect(subscribeEvents.length).toBe(1);
  });

  test('never shows success state on non-2xx backend error and preserves typed email', async ({ page }) => {
    await page.route('/api/subscribe', async (route) => {
      await route.fulfill({ status: 502, json: { error: 'provider_failed' } });
    });

    const { emailInput, form, submitBtn } = await readyNewsletterForm(page, HOME);

    const enteredEmail = 'keep-this-email@example.com';
    await emailInput.fill(enteredEmail);
    await submitBtn.click();

    // Must show error alert
    await expect(form.locator('[role="alert"]')).toBeVisible();

    // Success must NOT be shown
    const statusEl = page.locator('[role="status"]');
    await expect(statusEl).toHaveCount(0);

    // Email input must stay visible with preserved value
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveValue(enteredEmail);

    const errorEvents = await getDataLayerEvents(page, 'newsletter_submit_error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0]).toMatchObject({
      reason: 'provider_failed',
      http_status: 502,
    });
  });

  test('reproduces already-subscribed state without leaking user data', async ({ page }) => {
    await page.route('/api/subscribe', async (route) => {
      await route.fulfill({ status: 200, json: { ok: true, already: true } });
    });

    const { emailInput, submitBtn } = await readyNewsletterForm(page, HOME);

    await emailInput.fill('already-member@example.com');
    await submitBtn.click();

    const statusEl = page.locator('[role="status"]').first();
    await expect(statusEl).toBeVisible({ timeout: 10_000 });
    await expect(statusEl).toContainText(/already subscribed|вже підписані/i);
    // Does not leak user details or arbitrary info
    await expect(statusEl).not.toContainText('already-member@example.com');
  });

  test('reproduces network error and preserves typed input', async ({ page }) => {
    await page.route('/api/subscribe', async (route) => {
      await route.abort('failed');
    });

    const { emailInput, form, submitBtn } = await readyNewsletterForm(page, HOME);

    const testEmail = 'offline-user@example.com';
    await emailInput.fill(testEmail);
    await submitBtn.click();

    await expect(form.locator('[role="alert"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(emailInput).toHaveValue(testEmail);

    const errorEvents = await getDataLayerEvents(page, 'newsletter_submit_error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents[0]).toMatchObject({
      reason: 'network_error',
    });
  });

  test('fires newsletter_impression and newsletter_form_start funnels', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.scrollIntoViewIfNeeded();

    // Impression event
    const impressions = await getDataLayerEvents(page, 'newsletter_impression');
    expect(impressions.length).toBeGreaterThanOrEqual(1);

    // Form start event on interaction
    await emailInput.focus();
    const starts = await getDataLayerEvents(page, 'newsletter_form_start');
    expect(starts.length).toBeGreaterThanOrEqual(1);
  });

  test('full variant on subscribe page validates consent and language edition', async ({ page }) => {
    let requestPayload: unknown = null;
    await page.route('/api/subscribe', async (route) => {
      requestPayload = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { ok: true } });
    });

    const { emailInput, form, submitBtn } = await readyNewsletterForm(page, SUBSCRIBE_PAGE);

    // 1. Submit without consent
    await emailInput.fill('subscriber@example.com');
    await submitBtn.click();
    await expect(form.locator('[role="alert"]').first()).toBeVisible({ timeout: 10_000 });
    expect(requestPayload).toBeNull();

    // 2. Check consent and select Ukrainian edition (keyboard — custom mark blocks pointer clicks)
    await form.scrollIntoViewIfNeeded();
    await toggleConsent(form, page);
    await selectEdition(form, page, 'Українська');

    await submitBtn.click();
    const statusEl = page.locator('[role="status"]').first();
    await expect(statusEl).toBeVisible({ timeout: 10_000 });

    expect(requestPayload).toMatchObject({
      email: 'subscriber@example.com',
      lang: 'uk',
      placement: 'subscribe-page',
    });
  });
});

test.describe('After Hours Footer layout, links and contracts (AH-3.5)', () => {
  test('renders all 4 policy links, company links (about, author, subscribe, advertise), and explore links', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible({ timeout: 30_000 });

    const footerNav = footer.getByRole('navigation', { name: /footer/i });
    await expect(footerNav).toBeVisible();

    // 4 policies accessible from footer
    await expect(footerNav.locator('a[href$="/editorial-policy"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/ai-disclosure"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/privacy"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/terms"]')).toBeVisible();

    // Company links: about, author, subscribe, advertise
    await expect(footerNav.locator('a[href$="/about"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/author"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/subscribe"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/advertise"]')).toBeVisible();

    // Explore links
    await expect(footerNav.locator('a[href$="/news"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/digests"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/concepts"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/guides"]')).toBeVisible();
    await expect(footerNav.locator('a[href$="/tools"]')).toBeVisible();

    // Cookie settings button
    await expect(footerNav.getByRole('button', { name: /cookie settings/i })).toBeVisible();
  });

  test('social links have opens in new tab aria-labels and touch floor >= 40px', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible({ timeout: 30_000 });

    const socialLinks = footer.locator('ul a');
    const count = await socialLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < count; i++) {
      const link = socialLinks.nth(i);
      const target = await link.getAttribute('target');
      const ariaLabel = await link.getAttribute('aria-label');
      if (target === '_blank') {
        expect(ariaLabel).toMatch(/opens in a new tab/i);
      }
      const box = await link.boundingBox();
      expect(box, `social link #${i} bounding box`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(40);
    }
  });

  test('brand block links to home and contains BrandMark', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });
    const footer = page.locator('footer').first();
    const brandLink = footer.locator('a[aria-label="AI Today Brief"]');
    await expect(brandLink).toBeVisible();
    await expect(brandLink.locator('svg.brand-mark')).toBeVisible();
  });
});

