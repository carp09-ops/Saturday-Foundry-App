# Live stream alerts — backend setup

The app side shipped in **10.1.41**: it reads a `v_coach_live` view on every
season load and, the moment a coach is marked live, lights up automatically —
a 🔴 LIVE item leads THE LINE ticker, their Watch links get a pulsing LIVE
badge, and their game cards get a LIVE chip. Until the steps below are done,
the view doesn't exist, the app finds nothing, and nothing changes. No app
update is needed after setup.

## Status — ACTIVATED 2026-10-30 (driven by muse in the dashboard)

Steps 1–4 below are DONE: `coach_live_status` + `v_coach_live` created,
`v_stream_channels` created (streams live on `public.people`, joined to
`v_season_programs` — 11 channel rows), and `stream-live-check` deployed.
A manual flip verified end to end at the database level (Corey marked live;
the app renders it). Scheduling: a muse cron POSTs to the function every
5 minutes with the app's publishable key — no pg_cron and no service key
stored in SQL. Remaining gap: Twitch detection needs `TWITCH_CLIENT_ID` /
`TWITCH_CLIENT_SECRET` function secrets (Saif streams on Twitch); YouTube
(Corey, Jared, Pete) works keyless.

## The steps (reference)

1. **Create the table + views.** SQL Editor → paste all of
   [`migration.sql`](migration.sql) → Run.
2. **Deploy the checker.** Edge Functions → Create function → name it
   `stream-live-check` → paste
   [`functions/stream-live-check/index.ts`](functions/stream-live-check/index.ts)
   → Deploy. (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to
   functions automatically.)
3. **Twitch only (optional).** If anyone streams on Twitch: register an app
   at dev.twitch.tv (2 minutes, free), then add `TWITCH_CLIENT_ID` and
   `TWITCH_CLIENT_SECRET` under Edge Functions → Secrets. YouTube needs no
   key — the checker reads the channel's public /live page.
4. **Schedule it.** Either the muse cron (current setup), or uncomment the
   cron block at the bottom of `migration.sql` (fill in the project ref +
   service key) and run it.

## See it work before wiring the checker

Run the manual test snippet at the bottom of `migration.sql` (flip a coach
live, reload the app, check the ticker and their game card), then set
`is_live` back to `false`.

## Phase 2 — true push notifications (separate build, later)

Detection above is the hard part; push builds on it: the app gains a service
worker + a permission prompt, subscriptions are stored in a
`push_subscriptions` table, and the checker sends a Web Push on each
false→true flip (VAPID keys as function secrets). Web Push reaches the
home-screen-installed app (iOS 16.4+). The TestFlight wrapper cannot receive
Web Push inside its web view — native push there means the Capacitor push
plugin + APNs + a new native build.

Known limits of v1 detection: YouTube's /live page is probed, not an official
API, so a YouTube redesign could pause detection (Twitch uses the official
API and is unaffected; the manual flip always works). Polling every 5 minutes
means a stream can be live a few minutes before the app notices.
