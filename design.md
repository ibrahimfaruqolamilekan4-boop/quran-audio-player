# Design Doc — Quran Audio Player

_Rev 3 (2026-09-25): passes 1-7 all shipped; D2 replaced by D6 (localforage device
uploads instead of Vercel Blob — no `BLOB_READ_WRITE_TOKEN` exists on the project
and a device-local upload beats a broken cross-device one; absolute http(s)
links still publish globally through the existing admin endpoints)._

## 1. Product

**What this is:** A premium mobile-first web app for full Quran recitation by name, with ambient soundscapes/video backgrounds, an admin-managed global sheikh directory, and (now shipped) spiritual tools: prayer times and Qibla. Audience: general Muslims. Tone: reverent, warm, cinematic.

**Non-negotiable constraints:**
- Vercel Hobby: at most 12 serverless functions — only 3 aliased entries under `api/`; routes go in `backend/index.ts`, never new `api/` files.
- Serverless functions have a 4.5 MB body cap → uploads go **client-side** (see D6); the API only carries small JSON.
- Audio mirrors (mp3quran.net) publish **one file per surah**. "Per-ayah" playback is only possible via the Quran.com ayah CDN (limited reciter set) — dual-mode design, ayah mode on curated CDN reciters.
- No PWA; app-tab only. Destructive actions require confirmation dialogs.

## 2. Design language (as-is tokens)

- Colors: page `#030712`, panels `#0F172A`/`#131722`, borders `slate-800/60`; teal-400/500 primary accent, gold `#E2B753` for the player progress, blue-400 for ambient. Text white / slate-400 / slate-500.
- Type: `font-serif` display for surah names, default sans for UI, `font-arabic` (Amiri) for Arabic. Micro-labels: uppercase, tracking-widest, text-[10px].
- Shape: rounded-3xl cards, 2xl buttons, full pills for chips; generous tracking on headings.
- Motion: Framer Motion (`motion/react`), spring slide-ups, `useReducedMotion()` respected; ambient cards scale on play.
- Copy voice: warm-devotional, terse ("Begin listening", "Stitch a verse into today").
- A11y: aria-labels on all icon-only buttons, labeled sliders, visible focus (default outline), confirmations for deletes.

## 3. Core flows

Listen: pick sheikh → surah → full-screen player, auto-advance to the next surah seamlessly (existing). Ambient: track + background video layer. Auth → per-account reciters/settings sync. Admin: global reciters (Neon `global_reciters`), ambient sound→video mapping (`ambient_sounds`), roles.

## 4. Decisions log

| # | Date | Decision | Options rejected | Why | Result |
|---|------|----------|------------------|-----|--------|
| D1 | 2026-06-14 | Dual-mode playback: surah mode default; ayah mode on supported reciters via Quran.com CDN | surah-only; per-ayah mirrors | Mirrors ship full-surah files; per-ayah exists only for CDN reciters | Shipped (pass 1+2) |
| D2 | 2026-06-14 | **Vercel Blob** for uploads | Cloudinary; stay localforage | Already on Vercel; makes admin uploads visible to all users | **Superseded by D6** |
| D3 | 2026-06-14 | AlAdhan API | adhan npm lib | No new deps; 15+ calc methods; weekly view; CORS-open | **Superseded in code:** `adhan` (dependency) computes locally in `src/lib/prayer.ts` — no network needed. Shipped pass 7 |
| D4 | 2026-06-14 | Full-screen overlay owns mixer+background picker; mini bar slimmed to h-28 | keep 28rem expand sheet | One canonical player surface (spec) | Shipped (pass 1) |
| D5 | 2026-06-14 | Shared `src/lib/backgrounds.ts` resolver; auto-open overlay from `playChapter` only (not auto-advance) | duplicate id→URL logic | Drift risk removed | Shipped (pass 1) |
| A1 | 2026-06-14 | Double-tap prev re-restarts current surah | — | Spec detail not yet wired | **Shipped** (NowPlayingOverlay `handlePreviousTap`) |
| D6 | 2026-09-25 | Uploads = localforage media store + resized data URLs (client-side), same-origin only; absolute http(s) photo links still publish to the global catalog via `/admin/reciters` | Vercel Blob client-token flow (needs `BLOB_READ_WRITE_TOKEN`, which the project does not have); server-proxied uploads (4.5 MB body cap kills full surahs) | An upload that works on the owner's device beats a global upload path that 500s. Recitations outrank mirror URLs in the player; backgrounds flow into the shared resolver | Shipped (admin portal: reciters, recitations, backgrounds) |

## 5. Pass status (builds happen in this order, one audited section per pass)

- [x] **1** Full-screen player (surah mode) + in-player background strip + D4/D5 fixes + `App.tsx` StrictMode init-race fix — SHIPPED
- [x] 2 Ayah mode (CDN reciters, ayah counter, mode toggle; silent fallback rules) — SHIPPED
- [x] 3 Blob foundation + reciter photo uploads — SHIPPED as D6 (device-local media store)
- [x] 4 Ambient video uploads (cloud, admin-managed) — SHIPPED as D6 (admin Backgrounds tab)
- [x] 5 Recitation audio uploads + playback integration — SHIPPED (`src/lib/recitations.ts`, admin Recitations tab, `startChapter` prioritises uploads)
- [x] 6 Qibla tab (bearing math + device-orientation compass + manual fallback) — SHIPPED
- [x] 7 Prayer times tab (adhan, countdown, notifications, weekly view) — SHIPPED

## 6. Verification per pass

`npm run lint` (tsc) + `npm run build`, then agent-browser on the dev server at 390px and desktop widths: the section's golden path, an error/empty/loading state, Escape/focus behavior, console clean. `api/` artefact untouched by frontend passes (it is generated).
