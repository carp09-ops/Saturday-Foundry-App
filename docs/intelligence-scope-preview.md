# Intelligence time range — preview 9.10.4

Adds a Current season / All time toggle directly beneath Intelligence's heading. Current season follows the global selected season and names it in the scope caption. All time covers recorded seasons in the selected dynasty/edition, including retired members and program moves. It does not combine independent leagues or editions.

Every Intelligence pane uses the selected scope: Charts, Power, Luck, Clutch, Streaks, Vegas and Compare. Historical games, rankings and Vegas rows load on demand with guards against a late response crossing a league/season change. Fresh selected-season rows override historical copies. Partial history reports incomplete coverage and exposes Retry history. Refresh invalidates the history cache. Missing history is not fabricated.

All-time timeline axes distinguish season and week (including Week 0). Ranking trajectories resolve the program recorded that season, not the coach's current program. Opponent records/SOS are computed within each game's season. Head-to-head follows opposing person IDs through program changes and falls back to recorded programs in the same season. Historical Vegas matches game, person and season. Scope is applied only inside Intelligence rendering; Overview metrics, global season selection, active week and the Legacy views retain their existing behavior.

Validation includes season/all-time counts, league isolation, program moves/head-to-head, distinct timeline points, historical rank/market scope, Overview isolation and stale-response rejection, plus the auth recovery regressions from 9.10.3. Browser fixture QA covers seven panes and mobile containment. Production remains 9.10.2 pending approval of the combined preview.
