# Beta 11 — Saturday report

The report now selects substantive league-wide stories from saved games and complete polls instead of rendering the old weekly-desk filler. Home retains the personal game and other user games above the report.

## Selection and refresh

`report-engine.js` is a deterministic pure function. Within the selected season/week it gives explicit postseason results, ranked upsets, user head-to-head results, overtime and verified winning streaks priority over routine recaps. Ordinary conference games do not receive championship weighting. One game produces one story; supporting stories avoid the lead's teams. Future results are excluded. Only complete unique 25-team current and prior polls yield ranking movement. Pending/disputed H2H results cannot generate a recap; confirmed/resolved results and completed legacy imports can. If H2H verification is unavailable, user-v-user recaps are withheld. Unplayed or unverified intervening games break a winning-streak claim.

The report derives its candidates from current saved game/poll data on load and after existing result, confirmation and week writes. While Home or Stories is visible, a read refresh checks for other members' changes every 60 seconds, and on focus/visibility return when due. This is polling, not a WebSocket subscription or an AI generation job. It reuses existing result and ranking sources without changing score, standings or historical story-edition generation. A failed refresh retains the last loaded data with a visible notice; background refresh will not replace an open form/dialog.

The latest completed user-game week supplies recaps; the selected week supplies scheduled previews. An older recap is explicitly labeled with its source week. The selected week's shared curation row determines the pin and hidden stories; invalid pins fall back to the automatic selection.

## Shared editorial controls

The additive `preview_report_curation_v1` migration creates `preview_report_curation` and the `set_preview_report_story` invoker RPC. Reads require dynasty membership and edits require commissioner/co-commissioner permission for the season's dynasty. Anonymous access is revoked. Updates use revisions and a row lock to reject stale edits. The table contains editorial metadata only. Existing production screens do not reference it.

The editor supports Feature this (replace/pin lead), Hide, Restore, and Use automatic lead. Scope is season/week. Pinned stories retain current facts; deleted, unverified or otherwise ineligible sources cannot remain featured.

## Artwork

Prepared AI editorial helmet images for UConn, Army and Kansas live in `assets/graphite/report/`. Other teams use their official team marks on restrained graphic backgrounds. Live streak numbers, ranks, titles and scores are HTML rather than baked into images. School marks outside the editorial illustration use the existing official-logo sources. All editorial art is labeled.

Built-in image generation was used. UConn was extracted from the approved concept with all interface copy, score, and numeral 4 removed; helmet left, clean graphite/navy negative space right. Matching Army and Kansas assets used the UConn composition with the appropriate equipment and team emblem, no statistics or UI text. Converted to 1400px-wide WebP at quality 87. Source images are retained in generated_images in the working session. Project assets: `assets/graphite/report/uconn.webp`, `army.webp`, `kansas.webp`.

## Validation

52 checks passed: existing native flows plus focused report selection/integration and local PostgreSQL-compatible access-control tests. Cases cover streak recalculation, gaps, disputes, duplicate games, deterministic sorting, pins/hides, stale revisions, cross-league/member/anonymous denial, week 0, incomplete polls, and updates arriving while navigating. Mobile 390px browser inspection covered the rendered story and editorial controls. The deployed additive table was verified empty, RLS-enabled, inaccessible to anonymous users, and served by an invoker function; no new report-related advisor findings. No real game results or live editorial choices were written during QA. Real signed-in acceptance remains for the user preview.

Production `index.html` and main remain unchanged. Preview version: 10.0.0-beta.11.
