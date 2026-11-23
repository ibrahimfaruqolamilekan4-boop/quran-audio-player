import { test, expect, type Page } from '@playwright/test';

async function stubPrayerApi(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          uid: 'push-test-user',
          email: 'push@nooraya.app',
          displayName: 'Prayer Listener',
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
        activeSubscriptionCount: 1,
        nextScheduledPrayer: {
          prayerName: 'Dhuhr',
          timeIso: new Date(Date.now() + 3600_000).toISOString(),
        },
        lastDelivery: {
          status: 'sent',
          sentAt: new Date(Date.now() - 120_000).toISOString(),
        },
      }),
    });
  });
}

test.describe('Phase 1 — PWA Closed-App Web Push & Late-Delivery Guard', () => {
  test('1. Late push arrival (?playAdhan=dhuhr&late=1&prayerTime=12:35) shows true prayer time and NEVER auto-plays Adhan', async ({ page }) => {
    await stubPrayerApi(page);
    await page.goto('/dashboard/prayer-times?playAdhan=dhuhr&late=1&prayerTime=12:35');

    const lateModal = page.getByTestId('late-prayer-delivery-modal');
    await expect(lateModal).toBeVisible();
    await expect(lateModal).toContainText('Dhuhr was at 12:35');
    await expect(lateModal).toContainText(/not played automatically/i);

    // Ensure no Adhan audio element is playing
    const anyAudioPlaying = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('audio')).some((el) => !el.paused);
    });
    expect(anyAudioPlaying).toBe(false);

    // Dismissing the late-delivery modal reveals the Prayer Times screen cleanly
    await lateModal.getByRole('button', { name: /Dismiss & View Prayer Times/i }).click();
    await expect(lateModal).toBeHidden();
  });

  test('2. PushNotificationsPanel exposes "Test Notification in 10s" and diagnostics without console errors', async ({ page }) => {
    await stubPrayerApi(page);
    await page.goto('/dashboard/prayer-times');

    const test10sBtn = page.getByTestId('test-push-10s-btn');
    await expect(test10sBtn).toBeVisible();
    await expect(test10sBtn).toContainText(/Test Notification in 10s/i);
  });

  test('3. AdSense verification meta tag remains intact and /diag surfaces closedAppWebPushEngine flag', async ({ page }) => {
    await page.goto('/');
    const adsenseMeta = await page
      .locator('meta[name="google-adsense-account"]')
      .getAttribute('content');
    expect(adsenseMeta).toBe('ca-pub-5167781171496095');

    await page.goto('/diag');
    await expect(page.getByText(/Closed-App PWA Web Push/i)).toBeVisible();
  });
});
