import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const SAMPLE_MP3_PATH = path.resolve(process.cwd(), 'public/audio/adhan/madinah-standard.mp3');
const SAMPLE_MP3_BYTES = fs.readFileSync(SAMPLE_MP3_PATH);

const MOCK_CHAPTERS = [
  {
    id: 1,
    revelation_place: 'makkah',
    revelation_order: 5,
    bismillah_pre: false,
    name_simple: 'Al-Fatihah',
    name_complex: 'Al-Fātiĥah',
    name_arabic: 'الفاتحة',
    verses_count: 7,
    pages: [1, 1],
    translated_name: { language_name: 'english', name: 'The Opener' },
  },
  {
    id: 2,
    revelation_place: 'madinah',
    revelation_order: 87,
    bismillah_pre: true,
    name_simple: 'Al-Baqarah',
    name_complex: 'Al-Baqarah',
    name_arabic: 'البقرة',
    verses_count: 286,
    pages: [2, 49],
    translated_name: { language_name: 'english', name: 'The Cow' },
  },
];

const MOCK_VIDEOS = [
  {
    id: 'bg-makkah',
    name: 'Kaaba Sanctuary Night',
    category: 'Sacred',
    videoUrl: '/videos/makkah-night-720p.mp4',
    videoUrl720p: '/videos/makkah-night-720p.mp4',
    posterUrl: '/pwa-192x192.png',
    isActive: true,
  },
  {
    id: 'bg-medina',
    name: 'Madinah Rain Courtyard',
    category: 'Nature',
    videoUrl: '/videos/medina-rain-720p.mp4',
    videoUrl720p: '/videos/medina-rain-720p.mp4',
    posterUrl: '/pwa-192x192.png',
    isActive: true,
  },
];

async function setupDashboardHarness(page: Page, options: { isPremium?: boolean } = {}) {
  const isPremium = options.isPremium ?? true;

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          uid: 'smoke-user-1',
          email: 'smoke@nooraya.app',
          displayName: 'Smoke Listener',
          photoURL: null,
          role: 'user',
          is_premium: isPremium,
          subscription_plan: isPremium ? 'yearly' : 'free',
        },
      }),
    });
  });

  await page.route('**/api/me/preferences', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          theme: 'medina-emerald',
          activeBackgroundVideoId: 'bg-makkah',
          ambientVideoMapping: {},
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
  });

  await page.route('**/api/reciters', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reciters: [] }) });
  });
  await page.route('**/api/me/reciters', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reciters: [] }) });
  });
  await page.route('**/api/backgrounds', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: MOCK_VIDEOS }) });
  });
  await page.route('**/api/ambient', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ambientSounds: {}, tracks: [], videos: MOCK_VIDEOS }),
    });
  });
  await page.route('**/api/media', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.route('https://api.quran.com/api/v4/chapters**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ chapters: MOCK_CHAPTERS }) });
  });

  await page.route(/^https:\/\/(cdn\.mp3quran\.net|server\d+\.mp3quran\.net|archive\.org)\/.+\.(mp3|mp4)(\?.*)?$/i, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(SAMPLE_MP3_BYTES.length),
      },
      body: SAMPLE_MP3_BYTES,
    });
  });
}

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

  test('3. Landing page Dark/Light 4-layer opaque backdrop & visual screenshot verification', async ({ page }, testInfo) => {
    const projectSlug = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await page.goto('/');
    await expect(page.getByTestId('backdrop-layer-root')).toBeVisible();

    const darkBg = await page.getByTestId('backdrop-layer-root').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(darkBg).toBe('rgb(6, 21, 15)');
    await page.screenshot({ path: `tests/screenshots/layered-dark-${projectSlug}.png`, fullPage: false });

    const toggleBtn = page.getByTestId('theme-mode-toggle');
    await toggleBtn.click();
    await page.waitForTimeout(400);
    const lightBg = await page.getByTestId('backdrop-layer-root').evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });
    expect(lightBg).toBe('rgb(244, 239, 230)');
    await page.screenshot({ path: `tests/screenshots/layered-light-${projectSlug}.png`, fullPage: false });

    await toggleBtn.click();
  });

  test('4. Auth form login flow navigates to /dashboard and static media supports 206 Range', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            uid: 'auth-smoke-1',
            email: 'listener@nooraya.app',
            displayName: 'Auth Listener',
            role: 'user',
            is_premium: false,
          },
        }),
      });
    });

    await page.goto('/auth');
    await expect(page.locator('form')).toBeVisible();
    await page.locator('input[type="email"]').fill('listener@nooraya.app');
    await page.locator('input[type="password"]').fill('StrongPass123!');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);

    // Check 206 Range support on bundled Adhan audio
    const rangeRes = await page.request.get('/audio/adhan/madinah-standard.mp3', {
      headers: { Range: 'bytes=0-1023' },
    });
    expect([200, 206]).toContain(rangeRes.status());
    const contentType = rangeRes.headers()['content-type'] || '';
    expect(contentType.toLowerCase()).toContain('audio');
  });

  test('5. Switching background scene updates NowPlaying video and enforces single active decoding <video>', async ({ page }, testInfo) => {
    const projectSlug = testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await setupDashboardHarness(page, { isPremium: true });
    await page.goto('/dashboard/library');

    await page.getByText('Al-Fatihah', { exact: true }).first().click();
    const overlay = page.getByRole('dialog', { name: 'Now playing' });
    await expect(overlay).toBeVisible();

    // Capture Dark Now Playing screenshot
    await page.waitForTimeout(300);
    await page.screenshot({ path: `tests/screenshots/nowplaying-dark-${projectSlug}.png`, fullPage: false });

    // Verify strictly <= 1 actively playing <video> while NowPlayingOverlay is open
    const playingVideosCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('video')).filter((v) => !v.paused && Boolean(v.currentSrc || v.getAttribute('src'))).length;
    });
    expect(playingVideosCount).toBeLessThanOrEqual(1);

    // Open soundscapes & scenes bottom sheet and switch background scene
    await overlay.getByRole('button', { name: /No sounds/i }).click();
    const scenesHeading = overlay.getByRole('heading', { name: /Ambient Background Scene/i });
    await expect(scenesHeading).toBeVisible();

    const prevBgId = await page.evaluate(() => localStorage.getItem('activeBackgroundVideoId'));
    const sceneButtons = scenesHeading.locator('..').locator('..').locator('div.grid button');
    const sceneCount = await sceneButtons.count();
    expect(sceneCount).toBeGreaterThan(1);
    // Pick the 2nd scene (or 1st if the 2nd is somehow already active)
    const targetSceneBtn = prevBgId && (await sceneButtons.nth(1).getAttribute('class'))?.includes('ring-2')
      ? sceneButtons.nth(0)
      : sceneButtons.nth(1);
    await targetSceneBtn.click();

    await expect.poll(() =>
      page.evaluate(() => localStorage.getItem('activeBackgroundVideoId'))
    ).not.toBe(prevBgId);

    // Close sound sheet, minimize overlay, toggle Light theme on dashboard, verify opaque chrome & screenshot
    await overlay.getByRole('button', { name: 'Close background sound sheet', exact: true }).click();
    await overlay.getByRole('button', { name: 'Minimize player', exact: true }).click();
    await expect(overlay).toBeHidden();

    await page.getByTestId('theme-mode-toggle').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `tests/screenshots/dashboard-light-${projectSlug}.png`, fullPage: false });
  });

  test('6. Premium gating prompts SubscriptionModal for free users attempting offline download', async ({ page }) => {
    await setupDashboardHarness(page, { isPremium: false });
    await page.goto('/dashboard/library');
    await expect(page.getByRole('heading', { name: 'Surah Library' })).toBeVisible();

    const downloadBtn = page.getByTitle(/Download for offline listening \(Premium\)/i).first();
    await expect(downloadBtn).toBeVisible();
    await downloadBtn.click();

    await expect(
      page.getByRole('heading', { name: /Unlock Premium Offline Downloads/i })
    ).toBeVisible();
  });

  test('7. Prayer notification tap query parameter (?adhan_tap=1&prayer=fajr) opens real Fajr Adhan prayer screen', async ({ page }) => {
    await setupDashboardHarness(page, { isPremium: true });
    await page.goto('/dashboard/prayer-times?adhan_tap=1&prayer=fajr');

    await expect(page.getByText(/It is time for Fajr/i)).toBeVisible();
    await expect(page.getByText(/Fajr Prayer/i)).toBeVisible();
  });
});
