# Design Doc — Quran Audio Player

_Rev 2 (reconstructed after a sandbox rollback lost rev 1 before its commit — lesson applied: push early). Source of truth for the feature build-out._

## 1. Product

**What this is:** A premium mobile-first web app for full Quran recitation by name, with ambient soundscapes/video backgrounds, an admin-managed global sheikh directory, and (planned) spiritual tools. Audience: general Muslims. Tone: reverent, warm, cinematic.

**Non-negotiable constraints:**
- Vercel Hobby: at most 12 serverless functions — only 3 aliased entries under `api/`; routes go in `backend/index.ts`, never new `api/` files.
- Serverless functions have a 4.5 MB body cap — uploads go client-side to Vercel Blob with short-lived server-issued client tokens (pass 3).
- Audio mirrors (mp3quran.net) publish **one file per surah**. "Per-ayah" playback is only possible via the Quran.com ayah CDN (limited reciter set) → dual-mode design, §4.
- No PWA; app-tab only. Destructive actions require confirmation dialogs.

## 2. Design language (as-is tokens)

- Colors: page `#030712`, panels `#0F172A`/`#131722`, borders `slate-800/60`; teal-400/500 primary accent, gold `#E2B753` for the player progress, blue-400 for ambient. Text white / slate-400 / slate-500.
- Type: `font-serif` display for surah names, default sans for UI, `font-arabic` (Amiri) for Arabic. Micro-labels: uppercase, tracking-widest, text-[10px].
- Shape: rounded-3xl cards, 2xl buttons, full pills for chips; generous tracking on headings.
- Motion: Framer Motion (`motion/react`), spring slide-ups, `useReducedMotion()` respected; ambient cards scale on play.
- Copy voice: warm-devotional, terse ("Begin listening", "Stitch a verse into today").
- A11y: aria-labels on all icon-only buttons, labeled sliders, visible focus (default outline), confirmations for deletes.

## 3. Core flows

Listen: pick sheikh → surah → full-screen player, auto-advance to next surah seamlessly (existing). Ambient: track + background video layer. Auth → per-account reciters/settings sync. Admin: global reciters (Neon `global_reciters`), ambient sound→video mapping (`ambient_videos`), roles.

## 4. Decisions log

| # | Date | Decision | Options rejected | Why | Result |
|---|---|---|---|---|---|
| D1 | 2026-06-14 | Dual-mode playback: surah mode default; ayah mode on supported reciters via Quran.com CDN | surah-only; per-ayah mirrors | Mirrors ship full-surah files; per-ayah exists only for CDN reciters | Pending pass 1/2 |
| D2 | 2026-06-14 | **Vercel Blob** for uploads | Cloudinary; stay localforage | Already on Vercel; makes admin uploads visible to all users (today: device-local IndexedDB blobs — the gap) | Pending pass 3 |
| D3 | 2026-06-14 | Aladhan API | adhan npm lib | No new deps; 15+ calc methods; weekly view; CORS-open | Pending pass 7 |
| D4 | 2026-06-14 | Full-screen overlay owns mixer+background picker; mini bar slimmed to h-28 | keep 28rem expand sheet | One canonical player surface (spec) | Pending pass 1 |
| D5 | 2026-06-14 | Shared `src/lib/backgrounds.ts` resolver; auto-open overlay from `playChapter` only (not auto-advance) | duplicate id→URL logic | Drift risk removed | Pending pass 1 |
| A1 | 2026-06-14 | Candidate: double-tap prev-restarts current surah | — | Spec detail not yet wired | Pending pass 1/2 |

## 5. Pass status (builds happen in this order, one audited section per pass)

- [ ] **1** Full-screen player (surah mode) + in-player background strip + D4/D5 fixes + `App.tsx` StrictMode init-race fix — IN PROGRESS
- [ ] 2 Ayah mode (CDN reciters, ayah counter, mode toggle; silent fallback rules)
- [ ] 3 Blob foundation + reciter photo uploads (token endpoint, client helper)
- [ ] 4 Ambient video uploads (cloud, admin-managed)
- [ ] 5 Recitation audio uploads + playback integration
- [ ] 6 Qibla tab (bearing math + device-orientation compass + manual fallback)
- [ ] 7 Prayer times tab (Aladhan, countdown, notifications, week view)

## 6. Verification per pass

`npm run lint` (tsc) + `npm run build`, then agent-browser on the dev server at 390px and desktop widths: the section's golden path, an error/empty/loading state, Escape/focus behavior, console clean. `api/` artifact untouched by frontend passes (it is generated).
