# Beta 14 — My Career

Beta 13 exposed dynasty-specific career records but left the original cross-edition career hub on a hidden legacy landing screen. Beta 14 restores it natively under **Legacy → My Career**, with additional access from Account and the signed-in coach's profile. The screen is also usable when a new season or program assignment is not yet available.

## Features restored

- All-time career record, national titles, conference titles and Heismans.
- Edition-by-edition totals across the user's authorized leagues.
- Every program coached, cumulative records and distinct season counts.
- Separate coaching journeys per league and game edition, including archived leagues, retired programs, season zero and moves between programs.
- All recorded honors and an archived trophy room with edition, league and category filters, original trophy artwork and detail sheets.
- Draft history, recorded round/pick information and statistical leaders.
- Win percentage, draft/award/season counts, bowl and playoff records, scoring and points-allowed averages.
- Original coach cards and official team logos. Missing imagery uses existing generated artwork, never initials.

The design uses the preview's graphite/crimson/ivory theme. Section links scroll through visible content rather than hiding the career behind nested tabs. League-specific records and trophy views remain available in Legacy.

## Data and refresh

`assets/graphite/career-hub.js` calls the existing authenticated `get_my_coach_career_hub()` RPC with no coach or dynasty selector supplied by the client. The server resolves the signed-in coach and authorized league history. Totals come from the existing service; they are not recomputed from the currently selected league. No database schema or data changes are required.

The screen keeps the existing private `coach-career:<user id>` broadcast pattern. Notifications contain no trusted score data: they only trigger an authenticated re-read. A 60-second visible-page refresh and manual Refresh provide a fallback. Connections stop when the screen is hidden, the user leaves, or the account changes. Requests deduplicate, old account responses are discarded, open score forms and detail sheets are preserved, and failed refreshes retain the last good snapshot with an explicit status. A first-load failure offers Retry without inventing zero totals.

Archived hardware uses `active_game_edition_year` from the same RPC, rather than a hardcoded calendar year or the selected league. Current-edition honors cannot enter the archived view. Historical count imports do not misidentify the coach as a player recipient.

## Validation

68 automated checks pass across the native app, report engine, curation permissions and artwork permissions. Eight new career checks cover navigation, complete totals, ties and season zero, program aggregation, edition/league isolation, trophy details, retry/error states, no current assignment, logout/account races, private broadcast re-reads, preserved score drafts and escaping/fallback imagery.

A read-only authenticated database call matched the supplied screenshots, including the career record, edition totals, seasons, programs, draft picks and scoring averages. Mobile visual QA uses that private snapshot locally; no career snapshot, credentials, or fixture league results are published in this release. Desktop and 390 px mobile layouts, archive filters, trophy details and original coach artwork were checked.

Preview only: `ui-graphite-crimson-site`. Production `main` and `index.html` remain unchanged. No scores, seasons, coach assignments or honors were modified.
