# Static app maintenance

The Graphite & Crimson app runs directly from `index.html`. `foundry.html` is an
identical compatibility entry point for existing preview bookmarks. The native
source lives in `assets/graphite/`; edit those files rather than generated HTML.

`league-tools.html` embeds the preserved 9.10.16 application for advanced workflows.
Its source is `legacy-runtime.html`, not `index.html`. `release.json` records the
original runtime checksum and recovery commit. The build verifies this baseline
before generating the themed tools page and its context bridge.

The release version comes from `package.json`; update the matching lockfile version
and run the build to update metadata, the visible badge and bridge cache versions.

## Checks and generated CSS

```sh
npm ci --ignore-scripts
npm run build
npm run check:release
npm run build:css
```

Regenerate `assets/foundry-utilities.css` after editing utility classes in the HTML or app scripts. Tailwind CSS is pinned to 3.4.17, with its content paths in `tools/tailwind.config.cjs`.

`check:release` rejects stale generated HTML, checks entry points and script syntax,
and runs the complete test suite. GitHub runs the same command with read-only
repository permissions. Earlier one-off patch workflows are retained in
`.github/archived-workflows/` and must remain inactive.

The UI tests use fixture data and block network calls. They cover native screens,
all 11 advanced views, week zero, score validation, late responses across season
and league switches, refresh failures, session recovery, career history and dialog
focus. Rollover tests cover carry-forward, conference assignments, authorization,
the real confirmation form and returning to the new active season. They do not
submit production data.

## WSB release acceptance

Use the pinned release-candidate GitHack URL from PR #57. Sign in with an existing
commissioner account and select **WE'RE SO BACK**. In **Commish → Start next season**,
review the year and leave **Carry current programs forward** selected unless an
empty season is intended. Confirm once, then return Home to reload the new season.

Before entering any completed games, use **Commish → Change programs** to move
Corey to Florida and Saif to West Virginia. Review each coach and destination before
saving. Check the new team badges, then open the prior season and My Career to
confirm history remains available. Deliberately selected archived seasons remain
selected on refresh; a previously active season follows a newly created season.

The release candidate is not a production merge. The immutable recovery branch is
`backup/main-9.10.16-2026-10-28`, pointing to
`015543681ab67db19cedd9a7777d82ae7f1e8235`. Keep private database/account backups out
of GitHub. Reverting site code does not undo a live season rollover; database
recovery is separate. No schema migration is required by this release candidate.

## Local third-party assets

- Chart.js 4.5.1: `chart.umd.min.js` from the official `chart.js` npm package. The development-only source-map pointer is removed. Its MIT license is in `assets/vendor/chart-LICENSE.md`.
- Barlow Condensed and Inter: Latin WOFF2 subsets from the official Fontsource npm packages, version 5.3.0. The font weights and local URLs are defined in `assets/foundry-fonts.css`; their licenses are in `assets/fonts/`.

Keep these versions and licenses when replacing assets. The published HTML and asset blobs must match the checked files before providing a QA link.
