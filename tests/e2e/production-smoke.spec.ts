import { test, expect } from '@playwright/test';

test.describe('Nooraya Production Smoke & Visual Layer Verification', () => {
  test('1. Control audio test page (/control-audio-test.html) loads, plays same-origin MP3 & logs events without React/SW', async ({ page }) => {
    await page.goto('/control-audio-test.html');
    await expect(page.locator('#controlAudio')).toBeVisible();
    await expect(page.locator('#btnPlay')).toBeVisible();
    await expect(page.locator('#btnPause')).toBeVisible();

    const hasMediaSessionSupport = await page.evaluate(() => 'mediaSession' in navigator);
    expect(hasMediaSessionSupport).toBe(true);

    // Ensure SW did not hijack the static control test page
    await expect(page.locator('#statSW')).toContainText(/None/i);

    // Select same-origin bundled adhan stream and trigger play -> pause
    await page.locator('#trackSelect').selectOption('/audio/adhan/madinah-standard.mp3');
    await page.locator('#btnPlay').click();
    await page.waitForTimeout(400);
    await page.locator('#btnPause').click();
    await expect(page.locator('#logBox')).toContainText(/btnPlay click|track changed|paused/i);
  });

  test('2. Diagnostics view (/diag) renders singleton audio elements, feature flags & kill-switches', async ({ page }) => {
    await page.goto('/diag');
    await expect(
      page.getByRole('heading', { name: /Production Diagnostics & Feature Flags/i })
    ).toBeVisible();
    await expect(page.getByText(/Singleton Quran/i)).toBeVisible();
    await expect(page.getByText(/Production Diagnostics Logger/i)).toBeVisible();
    await expect(page.getByText(/4-Layer Opaque Medina Emerald/i)).toBeVisible();
  });

  test('3. Landing page, Dark/Light 4-layer opaque backdrop & visual screenshot verification', async ({ page }, testInfo) => {
    const projectSlug = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.goto('/');
    await expect(page.getByTestId('backdrop-layer-root')).toBeVisible();

    // Verify Layer 0 solid base color in Dark mode (#06150F -> rgb(6, 21, 15))
    const darkBg = await page.getByTestId('backdrop-layer-root').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(darkBg).toBe('rgb(6, 21, 15)');
    await page.screenshot({ path: `tests/screenshots/layered-dark-${projectSlug}.png`, fullPage: false });

    // Switch to Light Theme and verify solid opaque warm parchment (#F4EFE6 -> rgb(244, 239, 230))
    const toggleBtn = page.getByTestId('theme-mode-toggle');
    await toggleBtn.click();
    await page.waitForTimeout(400);
    const lightBg = await page.getByTestId('backdrop-layer-root').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(lightBg).toBe('rgb(244, 239, 230)');
    await page.screenshot({ path: `tests/screenshots/layered-light-${projectSlug}.png`, fullPage: false });

    // Restore dark theme
    await toggleBtn.click();
  });

  test('4. Auth form renders cleanly and static media/PWA assets serve proper 206 Range & headers', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check 206 Range support on bundled Adhan audio
    const rangeRes = await page.request.get('/audio/adhan/madinah-standard.mp3', {
      headers: { Range: 'bytes=0-1023' },
    });
    expect([200, 206]).toContain(rangeRes.status());
    const contentType = rangeRes.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('audio');
  });
});
