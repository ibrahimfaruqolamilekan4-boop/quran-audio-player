# Nooraya Closed-App & Offline Adhan — Architecture, Testing & Store Release Checklist

This document accompanies **PR 1 (`feat/phase1-pwa-closed-app-push`)** and **PR 2 (`feat/phase2-native-offline-adhan`)**.

---

## 1. Platform Capabilities & Architecture Decision

| Scenario | PWA on iPhone (iOS 16.4+) | PWA on Android (Chrome) | Native Capacitor App (iOS) | Native Capacitor App (Android) |
| :--- | :--- | :--- | :--- | :--- |
| **App closed + ONLINE** | Works **only after "Add to Home Screen"** via W3C Web Push (APNs). OS default sound only. | Works via W3C Web Push (FCM). OS default sound only. | Works offline & online via local `UNUserNotificationCenter`. | Works offline & online via `AlarmManager` + Foreground Service. |
| **App closed + OFFLINE (Airplane Mode)** | **Impossible in PWA.** Push arrives late when back online. | **Impossible in PWA.** Push arrives late when back online. | **Guaranteed** for rolling 10-day window (≤60 pending). | **Guaranteed** indefinitely (survives reboot & Doze). |
| **Real Adhan Voice while Closed** | **Impossible in PWA** (OS alert sound only; tap opens app for full Adhan). | **Impossible in PWA** (OS alert sound only; tap opens app for full Adhan). | **Real ≤28s bundled `.wav`/`.caf` clip** on lock screen + full Adhan on tap. | **Full 3–4 min real Muezzin MP3** via `AdhanPlaybackForegroundService` with Stop button. |
| **Late Delivery Guard** | Implemented in `public/push-sw.js` (>10 min late → shows true prayer time, **no late Adhan**). | Implemented in `public/push-sw.js` (>10 min late → shows true prayer time, **no late Adhan**). | Local alarm fires on device clock (never waits for network). | Local `setAlarmClock` fires on device clock (never waits for network). |

---

## 2. Accounts, Cost & Store Billing Rules (Flutterwave vs. Apple/Google IAP)

### Required Developer Accounts & Infrastructure Costs
1. **Apple Developer Program**: **$99 / year** (required for App Store, TestFlight, Push/Time Sensitive entitlements, and signing `ios/App`). Requires macOS + Xcode for signing/upload (or CI such as Codemagic / EAS / GitHub Actions macOS runners).
2. **Google Play Console**: **$25 one-time** registration fee (personal accounts created after Nov 2023 require 12 testers opted-in for 14 continuous days of closed testing before production rollout).
3. **Server Scheduler Costs (Phase 1 Web Push)**:
   - **Vercel Hobby ($0)**: Cron Jobs are restricted to **once per day** with loose ±59 min precision — **unsuitable** for per-minute prayer alerts.
   - **Supabase Free ($0)**: Supports `pg_cron` (`* * * * *`) + `pg_net` + 500k Edge Function invocations/month, **but auto-pauses after 7 days of inactivity** (which stops cron until manually resumed).
   - **Recommended Production Scheduler**: **Supabase Pro ($25/mo)** with `pg_cron` (`* * * * *`) invoking `public.invoke_nooraya_push_dispatch()` (reads URL & `CRON_SECRET` from Supabase Vault — zero hardcoded secrets) OR **Vercel Pro ($20/mo)** per-minute cron.

### Current Apple App Store & Google Play Billing Rules (Impact on Flutterwave Premium)
- **Digital features unlocked inside native apps** (Premium Muezzin Adhan voices, offline Surah downloads, HD atmospheric video backgrounds) are classified as **digital goods/services**.
- **Apple App Store Guideline 3.1.1 & Google Play Payments Policy**:
  - Outside specific narrow regional mandates (US/EU/South Korea link-out rules with commission/entitlement requirements), native store binaries **cannot route digital subscriptions directly to Flutterwave checkout** inside the app — doing so triggers immediate App Review / Play Console rejection.
  - **Recommended Compliant Architecture**:
    1. Keep **Flutterwave (NGN / local cards & bank transfer)** active on the **Web / PWA (`https://quran-audio-player-delta.vercel.app`)** — zero store fee.
    2. Inside the **iOS & Android native apps**, use **StoreKit 2 (Apple In-App Purchase)** and **Google Play Billing** (eligible for **15% fee** under the Apple App Store Small Business Program & Google Play 15% first-$1M tier), and sync purchase receipts to the same `public.profiles.is_premium` flag so a user who subscribes on Web or Mobile unlocks Premium everywhere.
    3. **Temporary Launch Option (Fastest Ship)**: Hide in-app upgrade checkout inside native store builds until IAP is wired (free users still get full prayer notifications + default Madinah & Alafasy voices; existing web subscribers sign in and immediately unlock their synced Premium status).

---

## 3. Native Build & Packaging Steps

```bash
# 1. Build web bundle + verify <=28s real Adhan WAV clips
npm run build
node scripts/build-native-adhan-clips.mjs

# 2. Initialize native Capacitor shells (once, on a build machine with Android Studio / Xcode)
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# 3. Copy Nooraya native plugins & manifests
# Android:
#   - Copy native/android/*.kt -> android/app/src/main/java/com/nooraya/quranaudio/adhan/
#   - Merge native/android/AndroidManifest.adhan.xml into android/app/src/main/AndroidManifest.xml
#   - Register NoorayaAdhanPlugin in MainActivity.java/kt
# iOS:
#   - Copy native/ios/NoorayaAdhanPlugin.swift -> ios/App/App/
#   - Merge native/ios/Info.adhan.plist into ios/App/App/Info.plist
#   - Enable Push Notifications + Time Sensitive Notifications capability in Xcode

# 4. Sync web bundle & real 28s WAV clips into native projects
node scripts/build-native-adhan-clips.mjs
npx cap sync
```

---

## 4. Phase 3 — Real-Device Verification Matrix (NO FABRICATED RESULTS)

> **HONESTY NOTICE**: Automated unit tests (`vitest`) and headless browser E2E tests (`playwright`) are executed in CI/sandbox, **not** on physical cellular handsets. Every physical-device cell below is explicitly marked **`PENDING REAL-DEVICE RUN`** until executed on physical hardware and logged.

| Scenario | Recent iPhone (iOS 17/18) — PWA | Recent iPhone (iOS 17/18) — Native | Recent Android (Pixel/Samsung Android 14/15) — Native | Battery-Aggressive Android (Tecno/Infinix/Xiaomi) — Native |
| :--- | :--- | :--- | :--- | :--- |
| 1. App killed + Online + Locked (5+ min wait) | `PENDING REAL-DEVICE RUN` (Web Push OS sound; tap opens full Adhan) | `PENDING REAL-DEVICE RUN` (28s clip; tap opens full Adhan) | `PENDING REAL-DEVICE RUN` (Full Adhan FGS + Stop button) | `PENDING REAL-DEVICE RUN` (Verify after Reliability Check) |
| 2. App killed + **Airplane Mode** + Locked | **NOT SUPPORTED BY PLATFORM** (PWA push requires internet; late delivery shows true time, no late Adhan) | `PENDING REAL-DEVICE RUN` (Local `UNUserNotificationCenter` 28s clip) | `PENDING REAL-DEVICE RUN` (`setAlarmClock` + local MP3 FGS) | `PENDING REAL-DEVICE RUN` (`setAlarmClock` + OEM Autostart) |
| 3. Late delivery after 20 min offline (PWA) | `PENDING REAL-DEVICE RUN` (Expect `"Dhuhr was at 12:35"`, no auto-play) | N/A (fires on time offline) | N/A (fires on time offline) | N/A (fires on time offline) |
| 4. Device Reboot while Offline | N/A | `PENDING REAL-DEVICE RUN` (iOS preserves `UNUserNotificationCenter` across reboot) | `PENDING REAL-DEVICE RUN` (`BootAndTimeChangeReceiver` re-arms alarms) | `PENDING REAL-DEVICE RUN` (`BOOT_COMPLETED` + Autostart) |
| 5. Timezone / DST Change while Offline | N/A | `PENDING REAL-DEVICE RUN` (App open / `BGAppRefreshTask` recalculates) | `PENDING REAL-DEVICE RUN` (`TIMEZONE_CHANGED` triggers reschedule) | `PENDING REAL-DEVICE RUN` (`TIMEZONE_CHANGED` triggers reschedule) |
| 6. Quran playing when Adhan fires | `PENDING REAL-DEVICE RUN` (In-app ducks & resumes) | `PENDING REAL-DEVICE RUN` (AudioSession ducks/interrupts) | `PENDING REAL-DEVICE RUN` (`AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE` ducks & resumes) | `PENDING REAL-DEVICE RUN` |
| 7. Active phone call when Adhan fires | N/A | iOS routes notification gently during calls | `PENDING REAL-DEVICE RUN` (`AudioManager.mode` silences Adhan, posts text alert) | `PENDING REAL-DEVICE RUN` |
| 8. Missing audio file (zero synthetic fallback) | Verified in unit tests (no oscillator) | `PENDING REAL-DEVICE RUN` (`content.sound = nil` + diagnostic error) | `PENDING REAL-DEVICE RUN` (silent text alert + diagnostic error) | `PENDING REAL-DEVICE RUN` |
| 9. 10s closed-app test button | `PENDING REAL-DEVICE RUN` (`POST /api/push/test` `delaySeconds: 10`) | `PENDING REAL-DEVICE RUN` (`testNativeAdhanIn10Seconds`) | `PENDING REAL-DEVICE RUN` (`testNativeAdhanIn10Seconds`) | `PENDING REAL-DEVICE RUN` |

---

## 5. Phase 4 — Store Submission, Staged Rollout & Rollback Plan

### Google Play Console Requirements
- **Exact Alarms Declaration**: Declare `SCHEDULE_EXACT_ALARM` (and strip `USE_EXACT_ALARM` via `tools:node="remove"`). Provide justification video showing the in-app **Adhan Reliability Check** prompting the user for Exact Alarms specifically for time-sensitive Islamic prayer times (Fajr–Isha).
- **Foreground Service Declaration**: Declare `FOREGROUND_SERVICE_MEDIA_PLAYBACK` with a short demo video showing the ongoing Adhan playback notification and **Stop Adhan** control.
- **Data Safety Form**:
  - Approximate/Precise Location: Optional, **stays on device** for offline prayer/Qibla calculation; sent to server **only** if user explicitly enables Web Push notifications (and deleted immediately upon opting out).
  - Push Token / Device ID: Collected only for opted-in Web Push alerts; encrypted in transit (HTTPS + RFC 8291 `aes128gcm`).
  - Account email & payment status: Used strictly for authentication and synced Premium entitlements.

### Apple App Store Review Requirements
- **Privacy Nutrition Labels**: Location = "Not Linked to You / On-Device Only" (for native offline calculation). Diagnostics = Optional opt-in only (`/diag`).
- **Time Sensitive Notifications Review Note**: Explain in App Review Notes that Islamic daily prayer times (Fajr, Dhuhr, Asr, Maghrib, Isha) occur at exact astronomical minutes and users explicitly opt in to receive timely alerts via `.timeSensitive` (explicitly noting that the app does **not** request Critical Alerts).
- **Silent Switch & 64-Notification Cap**: Clearly disclosed in the in-app **Adhan Reliability Check** panel.

### Staged Rollout & Rollback Plan
- **Feature Flags (`src/lib/featureFlags.ts`)**:
  - `closedAppWebPushEngine` (PR 1): Rollout `Admin -> 10% -> 100%`. Rollback: toggle off flag in `/diag`, run `SELECT cron.unschedule('nooraya-prayer-push-every-minute');` in Supabase SQL Editor, or revert PR 1.
  - `nativeOfflineAdhanEngine` (PR 2): Rollout `Internal Testing / TestFlight -> 10% Staged Rollout -> 100%`. Rollback: halt staged rollout in Play Console / App Store Connect, toggle off `nativeOfflineAdhanEngine`, or revert PR 2.
