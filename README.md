# Nooraya

Quran audio app: surah and ayah playback, reciters, prayer times, qibla, adhan, and premium backgrounds.

## Run locally

1. Install dependencies with `npm install`.
2. Copy the variables below into `.env.local`.
3. Start the app with `npm run dev` (Vite on port 3000).

`npm run build` builds the client and regenerates the API functions under `api/`.

## Required environment

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Accounts. Sign-in and sign-up fail closed when this database is down. |
| `AUTH_SECRET` | Signs the session cookie. At least 16 characters. The server will not start sessions without it. |
| `ADMIN_EMAIL` | Optional. This address is created as admin on sign-up. Admin access otherwise comes from `users.role`. |
| `FLW_SECRET_KEY` | Flutterwave secret. Premium is activated only after Flutterwave verifies the transaction. |
| `FLW_WEBHOOK_HASH` | Flutterwave `verif-hash`. Webhooks are rejected when this is missing. |
| `CRON_SECRET` | Bearer token for `POST /api/push/dispatch`. The placeholder `change-me-cron-secret` is rejected. |
| `SUPABASE_URL` | Supabase project URL, when Supabase features are enabled. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access. |
| `VITE_SUPABASE_URL` | Browser Supabase URL. |
| `VITE_SUPABASE_ANON_KEY` | Browser Supabase anon key. |

Do not commit `.env.local`.
