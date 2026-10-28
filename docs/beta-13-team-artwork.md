# Beta 13 — shared team artwork

The Saturday report now reads published artwork metadata by stable team ID. Florida and West Virginia join UConn, Army and Kansas. A program change uses the destination team's artwork when that team has a qualifying lead story; the move itself does not invent a result or force a story. Archived stories use their original team IDs. Official team logos remain the fallback.

## Runtime

`assets/graphite/artwork-catalog.js` reads `public.team_artwork_catalog` independently from scores and report selection. It refreshes on season load and the visible Home/Stories refresh cycle (60 seconds, also on return to the page when due). Requests are deduplicated; stale authentication responses are ignored. Changes do not replace an open form or commissioner dialog. A failed read retains the last good catalog. A failed image reveals the official logo. No generated image contains a score, rank or streak number; those remain rendered from verified game data.

This initial release is required to enable the catalog. Beta 12 and earlier retain their embedded artwork mapping. After opening Beta 13, adding or changing catalog artwork requires no frontend patch, version bump or new app URL.

## Publish later artwork without an app release

1. Generate and visually review the team's editorial image. Keep the subject on the left and negative space on the right for factual overlays. Export a roughly 1400 px wide WebP; the new assets are about 70–85 KB.
2. Upload the image to the existing asset host. An asset-only Git commit is sufficient; do not rebuild `foundry.html`. Use an immutable HTTPS image URL, including a new commit SHA or filename for revisions.
3. Through the trusted database publishing connection, upsert the team's existing `public.teams.id` into `public.team_artwork_catalog` with `image_url`, meaningful `alt_text`, a six-digit hexadecimal `accent_color`, and `published=true`. Resolve the team ID from the team catalog rather than a coach name or league assignment.
4. Verify that the URL loads and the appropriate report lead picks it up. To withdraw artwork, set `published=false`; on the next successful refresh the official logo returns. To roll back, restore the previous image URL.

Images are generated and published once by an administrator. The app does not generate images automatically, and the commissioner report editor does not provide image uploads. Catalog data is shared across leagues because it contains public team artwork only. Browser clients can read published rows; they cannot create, edit or delete catalog rows. Anonymous reads are denied. No service-role key is included in the app.

## Data and release boundaries

- Additive schema: `docs/team-artwork-catalog.sql`.
- Initial five-team publication: `docs/team-artwork-catalog-seed.sql`.
- Florida and West Virginia assets are hosted from asset-only commit `dc11c7e49339d0891c1177a6ebcaaa2ad2618976`.
- No scores, seasons, coach assignments or report curation choices were modified.
- Preview branch only: `ui-graphite-crimson-site`; production `main` and `index.html` are unchanged.

## Validation

60 automated checks pass across the native site, report engine, curation permissions and artwork catalog permissions. New checks cover newly published team artwork, changed URLs, withdrawal, ID-based matching after a display-name change, invalid URL/color rejection, failed-image fallback, catalog outages, request deduplication, open score drafts and logout races. The catalog database test verifies published-only reads, denied anonymous access, denied browser mutations, field constraints and revision timestamps. Florida and West Virginia were visually checked in the 390 px mobile report using isolated fixture game results.
