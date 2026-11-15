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
  {
    id: 18,
    revelation_place: 'makkah',
    revelation_order: 69,
    bismillah_pre: true,
    name_simple: 'Al-Kahf',
    name_complex: 'Al-Kahf',
    name_arabic: 'الكهف',
    verses_count: 110,
    pages: [293, 304],
    translated_name: { language_name: 'english', name: 'The Cave' },
  },
];

async function setupAudioTestHarness(page: Page) {
  const requestedAudioUrls: string[] = [];

  // Track the singleton Quran HTMLAudioElement instances created by persistentAudio.ts
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const trackedAudios: HTMLAudioElement[] = [];
    (window as any).__trackedAudios = trackedAudios;
    (window as any).Audio = function (...args: any[]) {
      const el = new NativeAudio(...(args as [string?]));
      trackedAudios.push(el);
      return el;
    } as any;
    (window as any).Audio.prototype = NativeAudio.prototype;
  });

  // Mock authenticated listener session so /dashboard/* mounts cleanly
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          uid: 'playwright-e2e-user',
          email: 'e2e@nooraya.app',
          displayName: 'E2E Listener',
          photoURL: null,
          role: 'user',
          is_premium: true,
          subscription_plan: 'yearly',
        },
      }),
    });
  });

  // Deterministic lightweight /api bootstrap calls
  await page.route('**/api/me/preferences', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ theme: 'midnight-scholar', activeBackgroundVideoId: null, ambientVideoMapping: {} }),
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ videos: [] }) });
  });
  await page.route('**/api/ambient', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tracks: [] }) });
  });
  await page.route('**/api/media', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });

  // Canonical chapters catalog (avoids external network dependency in CI)
  await page.route('https://api.quran.com/api/v4/chapters**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chapters: MOCK_CHAPTERS }),
    });
  });

  // Serve real MP3 bytes (supports HTTP 206 Range requests) for external recitation CDNs
  await page.route(/^https:\/\/(cdn\.mp3quran\.net|server\d+\.mp3quran\.net|archive\.org)\/.+\.(mp3|mp4)(\?.*)?$/i, async (route) => {
    const url = route.request().url();
    requestedAudioUrls.push(url);

    const rangeHeader = route.request().headers()['range'];
    const total = SAMPLE_MP3_BYTES.length;
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = Math.max(0, parseInt(startStr, 10) || 0);
      const end = endStr ? Math.min(total - 1, parseInt(endStr, 10)) : total - 1;
      const chunk = SAMPLE_MP3_BYTES.subarray(start, end + 1);
      await route.fulfill({
        status: 206,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Content-Length': String(chunk.length),
        },
        body: chunk,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(total),
      },
      body: SAMPLE_MP3_BYTES,
    });
  });

  return { requestedAudioUrls };
}

test.describe('Core Audio Playback & Reciter Switching Smoke Tests', () => {
  test('1. Surah can be played, paused, and resumed in Now Playing & Bottom Player', async ({ page }) => {
    const { requestedAudioUrls } = await setupAudioTestHarness(page);

    await page.goto('/dashboard/library');
    await expect(page.getByRole('heading', { name: 'Surah Library' })).toBeVisible();

    // Start playing Surah Al-Fatihah
    const fatihahRow = page.getByText('Al-Fatihah', { exact: true }).first();
    await expect(fatihahRow).toBeVisible();
    await fatihahRow.click();

    // Full-screen Now Playing overlay opens in playing state
    const overlay = page.getByRole('dialog', { name: 'Now playing' });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('heading', { name: 'Al-Fatihah' })).toBeVisible();
    await expect(overlay.getByText('Noreen Muhammad Siddiq')).toBeVisible();

    const overlayPauseBtn = overlay.getByRole('button', { name: 'Pause', exact: true });
    await expect(overlayPauseBtn).toBeVisible();

    // Underlying singleton <audio> element must be loaded & playing
    await expect
      .poll(async () => {
        return await page.evaluate(() => {
          const list: HTMLAudioElement[] = (window as any).__trackedAudios || [];
          const quranEl = list[0];
          return quranEl ? { src: quranEl.src, paused: quranEl.paused } : null;
        });
      })
      .toMatchObject({ paused: false });
    expect(requestedAudioUrls.some((u) => u.includes('001.mp3'))).toBe(true);

    // PAUSE from Now Playing overlay
    await overlayPauseBtn.click();
    const overlayPlayBtn = overlay.getByRole('button', { name: 'Play', exact: true });
    await expect(overlayPlayBtn).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => Boolean(((window as any).__trackedAudios || [])[0]?.paused))
      )
      .toBe(true);

    // RESUME from Now Playing overlay
    await overlayPlayBtn.click();
    await expect(overlay.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => Boolean(((window as any).__trackedAudios || [])[0]?.paused))
      )
      .toBe(false);

    // Minimize overlay and verify Pause/Resume via BottomPlayer mini bar
    const minBtn = overlay.getByRole('button', { name: 'Minimize player', exact: true });
    await expect(minBtn).toBeVisible();
    await page.waitForTimeout(350);
    await minBtn.click();
    await expect(overlay).toBeHidden();

    const miniPauseBtn = page.getByRole('button', { name: 'Pause', exact: true }).first();
    await expect(miniPauseBtn).toBeVisible();
    await miniPauseBtn.click();

    const miniPlayBtn = page.getByRole('button', { name: 'Play', exact: true }).first();
    await expect(miniPlayBtn).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => Boolean(((window as any).__trackedAudios || [])[0]?.paused))
      )
      .toBe(true);

    await miniPlayBtn.click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true }).first()).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate(() => Boolean(((window as any).__trackedAudios || [])[0]?.paused))
      )
      .toBe(false);
  });

  test('2. Switching reciters updates active reciter UI state and audio stream URL', async ({ page }) => {
    const { requestedAudioUrls } = await setupAudioTestHarness(page);

    await page.goto('/dashboard/home');
    await expect(page.getByText(/Reciting by/i)).toContainText('Noreen Muhammad Siddiq');

    // Start playing Surah Al-Fatihah via "Your Favorites" quick card on Home
    await page.getByText('Your Favorites').click();
    const overlay = page.getByRole('dialog', { name: 'Now playing' });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('heading', { name: 'Al-Fatihah' })).toBeVisible();
    await expect(overlay.getByText('Noreen Muhammad Siddiq')).toBeVisible();

    await expect
      .poll(async () =>
        page.evaluate(() => ((window as any).__trackedAudios || [])[0]?.src || '')
      )
      .toContain('noreen-siddiq/r1/001.mp3');

    // Minimize full-screen overlay to expose Home featured reciters
    const minBtn = overlay.getByRole('button', { name: 'Minimize player', exact: true });
    await expect(minBtn).toBeVisible();
    await page.waitForTimeout(350);
    await minBtn.click();
    await expect(overlay).toBeHidden();

    // Switch reciter to Mishary Rashid Alafasy
    const alafasyBtn = page.getByRole('button', { name: /Mishary Rashid Alafasy/i }).first();
    await alafasyBtn.scrollIntoViewIfNeeded();
    await expect(alafasyBtn).toBeVisible();
    await alafasyBtn.click();

    // Home header & BottomPlayer must immediately reflect Mishary Rashid Alafasy
    await expect(page.getByText(/Reciting by/i)).toContainText('Mishary Rashid Alafasy');
    await expect(page.getByText('Mishary Rashid Alafasy').last()).toBeVisible();

    // Underlying <audio>.src must switch cleanly to Alafasy's 001.mp3 stream while preserving Surah
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const el: HTMLAudioElement | undefined = ((window as any).__trackedAudios || [])[0];
          return el ? { src: el.src, paused: el.paused } : { src: '', paused: true };
        })
      )
      .toEqual({
        src: expect.stringContaining('mishary-alafasy/r1/001.mp3'),
        paused: false,
      });

    expect(requestedAudioUrls.some((u) => u.includes('mishary-alafasy/r1/001.mp3'))).toBe(true);

    // Re-open full-screen Now Playing overlay via mini-player card and verify updated reciter state matches
    await page.getByText('Al-Fatihah', { exact: true }).last().click();
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole('heading', { name: 'Al-Fatihah' })).toBeVisible();
    await expect(overlay.getByText('Mishary Rashid Alafasy')).toBeVisible();
  });
});
