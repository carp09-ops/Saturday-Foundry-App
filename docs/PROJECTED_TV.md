# Saturday Foundry: Projected TV networks

**Scope:** WSB / WE'RE SO BACK, Season 7 (fictional 2032 season), Week 1. 87 completed games.

Predictions are **not** real 2032 TV announcements. The game's tower icon is stored in `games.network` as **National broadcast (network unspecified)**; the cast-style icon is stored as **Conference/secondary broadcast (network unspecified)**. `games.projected_network` is a **separate editorial estimate**, based on the host program's conference and 2026 media-rights arrangements, adjusted for prominent matchups. Never overwrite confirmed channel information with a projection.

## Mapping guide

| Home conference | Tower icon / national candidates | Cast icon / conference-secondary candidates |
| --- | --- | --- |
| SEC | ABC, ESPN, ESPN2 | SEC Network, SEC Network+ |
| Big Ten | FOX, CBS, NBC | Big Ten Network, FS1, Peacock |
| ACC | ABC, ESPN, ESPN2, The CW | ACC Network, ACCNX |
| Big 12 | FOX, ABC, ESPN, FS1 | ESPN+, FS1, TNT |
| Pac-12 | CBS, The CW | CBS Sports Network, USA Network |
| American | ESPN, ESPN2 | ESPN+, ESPNU, CBS Sports Network |
| Mountain West | CBS, FOX | CBS Sports Network, MW+ |
| MAC | ESPN, ESPN2, ESPNU | ESPN+, CBS Sports Network |
| Conference USA | ESPN, ESPN2, ESPNU | ESPN+, CBS Sports Network |
| Sun Belt | ESPN, ESPN2, ESPNU | ESPN+ |
| Independents | Notre Dame home: NBC | UConn home: CBS Sports Network; varies by game |
| MVFC (FCS) | ESPN/ESPN2 for select games | ESPN+ |

Home-team media rights are the starting point, not the visiting team's conference. In this season snapshot, Georgia, Arkansas, Auburn, Mississippi State and Missouri have blank team conference metadata but are treated as SEC for this editorial assignment; USC is treated as Big Ten. They were **not** changed in the `teams` table.

## Audit

- All 87 Week 1 rows have a distinct `projected_network`, alongside their original broadcast tier and final score.
- 40 show national broadcast tier; 47 show conference/secondary tier.
- Two overtime finals remain unchanged.
- Historical seasons, other dynasties and subsequent weeks were not assigned projections.
- Assignment snapshot: [`wsb-s7-week1-projected-networks.csv`](wsb-s7-week1-projected-networks.csv).

## Standard weekly broadcast-import workflow (adopted October 30, 2026)

For **each incoming WSB week**, when the user supplies game screenshots:

1. Locate the **existing dynasty, season, and week** in Supabase. Match every screenshot game by both away and home teams; include the entire week's screenshot set, accounting for repeated games across adjacent screenshots.
2. Use the in-game **tower** icon for `games.network = 'National broadcast (network unspecified)'`. Use the **cast/screen** icon for `games.network = 'Conference/secondary broadcast (network unspecified)'`.
3. If the TV icon is **absent or not legible**, store `games.network = 'Not shown in screenshot'`. Do not fabricate a confirmed tier.
4. Independently populate **`games.projected_network`** with a *plausible, unofficial* broadcaster, guided first by home-team conference or home-game rights, then by the screenshot tier, notable opponent, and time slot. If the icon is missing, a projected conference broadcaster may still be proposed but **must remain modeled as an unofficial projection**. Do not confuse the stream/cast icon with a verified streaming service.
5. Honor actual league realignment as stored in the season program, and use verified conference overrides where `teams.conference` is blank or outdated. Never rewrite historical games or team affiliations incidentally.
6. Update **broadcast classification and projection only**. Do not modify game scores, completion status, overtime, kickoff timestamps, home/away team IDs, or unrelated games. Independently process results only if user sends them and requests import.
7. Preflight and postflight audit: **full screenshot coverage, one existing game per matchup, zero duplicates, zero unmapped games, complete projection coverage, and unchanged previously recorded finals**.
8. The app displays only an ESPN-style **network-name tag** (e.g., `ESPN`, `FOX` or `Big Ten Network`), without the visible `Projected TV` prefix. The value still comes from `games.projected_network`, and game details retain a discreet estimate disclosure. Save a per-week CSV snapshot and append the audit to this document. A database-only update **does not require a frontend deployment**.
9. These are simulations. The displayed WSB Season 7 year is **2032**; the channel choices are based on known **2026** rights agreements, which may change before 2032.

### WSB Season 7 — Week 2 broadcast audit

- 71 existing schedule games matched and updated (no new games inserted).
- 40 national tower icons, 30 conference/secondary cast icons, 1 game with no visible TV icon: **FCS Northwest at Nevada** (tier unconfirmed, channel projected as MW+).
- All 71 received an unofficial projected network; 14 different projected channels used.
- Georgia Tech 56–17 FCS Midwest already final and preserved.
- All 71 kickoff timestamps retained; no other weeks or leagues modified.
- Assignment snapshot: [`wsb-s7-week2-projected-networks.csv`](wsb-s7-week2-projected-networks.csv).

### 2026 references

- [ESPN 2026 college football platforms](https://espnpressroom.com/press-release/powerhouse-presentations-ranked-showdowns-and-conference-clashes-fuel-espns-blockbuster-broadcast-schedule-for-the-2026-27-college-football-season/)
- [Pac-12 television partners and schedule](https://pac-12.com/news/2026/5/26/pac-12s-2026-football-broadcast-schedule-and-kickoff-times-announced.aspx)
- [2026 conference television guide](https://sports.yahoo.com/articles/college-football-watch-guide-2026-090025675.html)

**Maintenance:** Refresh rights assumptions before estimating future seasons. Broadcaster rights may change substantially before the simulated 2032 season.

## ESPN-style presentation update (2026-10-30)

Cards display the broadcaster name alone inside a neutral outlined tag; game details use the heading `Broadcast` and disclose the simulated network estimate. Scores, games, and network projections remain unchanged.
