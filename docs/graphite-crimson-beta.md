# Graphite & Crimson beta — 10.0.0-beta.1

The new app opens at `foundry.html`. The existing `index.html` remains byte-for-byte unchanged from main commit `015543681ab67db19cedd9a7777d82ae7f1e8235`. This branch does not replace the production entry point.

## Experience

Five persistent destinations: Home, Scores, Teams, Standings, and Legacy. The approved Graphite & Crimson preview supplies the colors, type scale, card shapes, imagery, and mobile navigation. Desktop expands into a two-column home feed with a full-width header. Coach profiles, original coach cards, trophy details, league/season selection, published stories, analysis, rankings, and forecasts read authenticated league data with explicit empty and error states.

Native workflows include sign-in and account creation, invitation acceptance, league creation, program selection with confirmation, schedule entry, score review and submission, coach-vs-coach validation, active-week updates, and invitation creation. All mutations use the existing authenticated RPCs and database permissions. No database migrations are included.

The advanced league tools remain available through a themed `league-tools.html` copy of the original application. These retain their established layout and complete commissioner features, including imports, corrections, awards, rankings, disputes, and rollover. The return link restores the new app; both entries use the existing same-origin session store. The context bridge selects the requested dynasty and season only from the user's memberships.

## Data and behavior

This is a working beta connected to the existing live database. Confirming an action saves to the real league. There is no bundled league snapshot, demo data, service key, or test account. The public client key is the same publishable key as main. Historical and claimed programs cannot be claimed through the new UI. Duplicate saves are blocked; mutations are not automatically retried. A successful save followed by a refresh failure is reported as saved.

National conference standings reuse main's ledger and American tiebreak implementation unchanged. Pagination reads all available records; missing optional sources display a warning instead of fabricated values. Images use existing immutable approved assets.

## Build and validate

Run `python tools/build-site.py` from a checkout to regenerate `foundry.html` and `league-tools.html`. Source files are in `assets/graphite/`.

Run `node --test tests/graphite-site.test.cjs` with `jsdom` installed (the existing repository development dependencies provide the test runtime). Fourteen isolated tests cover loader/navigation, score ownership and zero scores, review-before-write, double submissions, claim races, stale seasons, H2H validation, commissioner roles, pagination, escaped data, and refresh failures after a committed write.

Browser checks covered desktop and 390px mobile login/home, navigation to coach profiles, trophies and details, schedule entry, account navigation, and sign-out. These authenticated browser layouts use isolated synthetic fixtures kept outside the published files. No real score, claim, invitation, league, or season mutation was performed during QA. A real-user authenticated acceptance pass remains necessary before promoting this beta to production.

## Beta 2 — dynasty lines on score cards

The new entry is now 10.0.0-beta.2. Stored dynasty lines load automatically for the selected season and appear on Home, Scores, and game details. Cards show the favorite and spread, O/U, and recorded projections/win probability when present. Missing lines remain explicitly unposted; request failures offer retry. The shared loader matches the live view `id`, paginates in stable order, guards stale season responses, and updates card strips without replacing an in-progress score form. Seventeen workflow tests pass.

## Beta 5 — integrated advanced-tool navigation

Advanced tools now open as an embedded tool workspace inside the new header, back control, tool selector, and primary navigation. The existing backend and detailed tool forms are reused, not fully rewritten. The child hides duplicate app navigation and loads the authorized league and season. Returning to the new screens reloads league data to reflect changes. Background H2H refresh does not replace an open tool workspace. Nineteen tests cover workflows and context bridging. Authenticated browser acceptance of the embedded production tools remains outstanding.
