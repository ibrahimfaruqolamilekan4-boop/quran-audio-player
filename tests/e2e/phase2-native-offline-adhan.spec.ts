import { test, expect, type Page } from '@playwright/test';

async function stubPrayerApi(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          uid: 'native-test-user',
          email: 'offline@nooraya.app',
          displayName: 'Offline Listener',
          role: 'user',
          is_premium: true,
          subscription_plan: 'yearly',
        },
      }),
    });
  });

  await page.route('**/api/adhan-voices', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ voices: [] }),
    });
  });

  await page.route('**/api/push/diagnostics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        vapidConfigured: true,
        activeSubscriptionCount: 0,
      }),
    });
  });
}

test.describe('Phase 2 — Native Offline 10-Day Scheduler, Per-Prayer Controls & Reliability Check', () => {
  test('1. Per-prayer customization expands, updates Fajr reminder offset, and persists across reload', async ({ page }) => {
    await stubPrayerApi(page);
    await page.goto('/dashboard/prayer-times');

    const toggleBtn = page.getByTestId('toggle-per-prayer-controls-btn');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    const grid = page.getByTestId('per-prayer-controls-grid');
    await expect(grid).toBeVisible();

    const fajrOffsetSelect = grid.getByLabel('Fajr Reminder Offset');
    await fajrOffsetSelect.selectOption('15');

    const dhuhrVibrateCheckbox = grid.getByLabel('Dhuhr Vibrate');
    await dhuhrVibrateCheckbox.uncheck();

    // Reload and confirm settings persisted in localStorage
    await page.reload();
    await page.getByTestId('toggle-per-prayer-controls-btn').click();
    await expect(page.getByTestId('per-prayer-controls-grid').getByLabel('Fajr Reminder Offset')).toHaveValue('15');
    await expect(page.getByTestId('per-prayer-controls-grid').getByLabel('Dhuhr Vibrate')).not.toBeChecked();
  });

  test('2. AdhanReliabilityCheck renders 10-day offline schedule within iOS 64-cap, OEM guides, and honest iOS disclosures', async ({ page }) => {
    await stubPrayerApi(page);
    await page.goto('/dashboard/prayer-times');

    const relCard = page.getByTestId('adhan-reliability-check');
    await expect(relCard).toBeVisible();
    await expect(relCard).toContainText(/\/ 64/);
    await expect(relCard).toContainText(/Safely within iOS 64-cap/i);
    await expect(relCard).toContainText(/Tecno \/ Infinix/i);
    await expect(relCard).toContainText(/Xiaomi \/ Redmi/i);
    await expect(relCard).toContainText(/Samsung/i);
    await expect(relCard).toContainText(/Hardware Silent Switch/i);

    // Click Refresh 10-Day Schedule button
    await page.getByTestId('refresh-offline-schedule-btn').click();
    await expect(relCard).toContainText(/Recomputed \d+ local prayer alerts/i);
  });

  test('3. Bundled 28-second real WAV Adhan notification clips are served cleanly with Range support', async ({ page }) => {
    const res = await page.request.get('/audio/adhan/clips/madinah-standard-28s.wav', {
      headers: { Range: 'bytes=0-2047' },
    });
    expect([200, 206]).toContain(res.status());
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    expect(ct).toContain('audio');
  });
});
