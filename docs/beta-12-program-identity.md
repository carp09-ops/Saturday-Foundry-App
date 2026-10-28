# Beta 12 — Season-aware league badges

League selection now shows the signed-in coach's official team logo and team name for each league's active season. All current-user assignments are read once alongside memberships at startup; returning to the picker refreshes memberships and assignments together. Matching uses dynasty ID and active season ID. Viewing an archived season does not change these active-league badges. A season without a selected team uses the Foundry shield and an explicit status, never a previous team's logo or an initials placeholder. Broken logo URLs fall back to the existing shield.

Native selected-season identity remains based on the current user's season program assignment. Report artwork follows the story team, with prepared helmet illustrations for UConn, Army and Kansas and official-logo graphics for other schools. Program changes do not imply automatic AI image generation.

Archived-season program reads now include inactive programs. The previous unconditional active-program filter could hide the original identities in fully archived seasons; active/setup seasons still request current active programs only. Career records and trophies are not modified.

Validation: 55 checks passed across native UI, report selection and local report-access tests. New cases cover multiple leagues before opening them, active-season badges while browsing archives, rollover into an unassigned season, subsequent program selection, logout cleanup, and switching between North Carolina and archived UConn report artwork. Browser QA at 390px verified official logos, team labels and card layout. No live database mutations in this update. Main and production index.html unchanged. Version 10.0.0-beta.12.
