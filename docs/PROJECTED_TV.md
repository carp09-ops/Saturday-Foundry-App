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

### 2026 references

- [ESPN 2026 college football platforms](https://espnpressroom.com/press-release/powerhouse-presentations-ranked-showdowns-and-conference-clashes-fuel-espns-blockbuster-broadcast-schedule-for-the-2026-27-college-football-season/)
- [Pac-12 television partners and schedule](https://pac-12.com/news/2026/5/26/pac-12s-2026-football-broadcast-schedule-and-kickoff-times-announced.aspx)
- [2026 conference television guide](https://sports.yahoo.com/articles/college-football-watch-guide-2026-090025675.html)

**Maintenance:** Refresh rights assumptions before estimating future seasons. Broadcaster rights may change substantially before the simulated 2032 season.
