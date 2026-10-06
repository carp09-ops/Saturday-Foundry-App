# Dynasty Book / Chronicles preview 9.10.0

Built from main 4d2c3ad (9.9.25). The mobile bar is Overview, Schedule, Intelligence, Legacy and Book. The book opens with Conference Race and preserves the existing feature routes, selected league, season and active week. Hardware opens the Trophy Case pane in Legacy; Season Recap and dynasty switching remain accessible. Commissioner visibility follows the existing role check. Refresh and logout retain their existing controller.

Overview places one Chronicle preview, a compact league-news inbox and six discovery entrances below Your Week. The existing Legacy Line is retained and links into Chronicles.

Chronicles selects career openings and meaningful developments from loaded league data: program moves, preceding recorded-season results, revenge against an opposing person, top-ten wins, first losses after unbeaten starts, surpassing a prior win total, losing-streak turning points and postseason results. Routine games are condensed into factual season summaries. Fiction is labelled and separated from factual score/record lines. Deterministic scene rotation changes adjacent seasons and keeps earlier game episodes stable when later results arrive. Original character lore remains in a collapsed file.

No new database schema or AI endpoint is introduced in this first preview. Editorial is generated locally from curated scenes, not a persistent AI-written novel. Read markers are local to the browser, scoped by signed-in user, league and edition. Career comparisons use the selected league's loaded history and career-stop rows; histories from independent leagues/editions are never conflated. Unavailable history cannot be invented.

Validation: 32 automated checks covering application routing, async league/season isolation, roles, historical career context, event selection, spoiler avoidance, read state, Trophy Case routing, Week 0 and existing regressions. Chromium fixture checks at 320, 390, 768 and 1024 pixels found no JavaScript errors or horizontal overflow; the book stays within the viewport. Signed-in production data and native iOS Safari still need user QA.
