# Static app maintenance

The app runs directly from `index.html`. Its styles, fonts, and chart library are served locally; there is no browser-side CSS compiler.

## Checks and generated CSS

```sh
npm ci
npm test
npm run build:css
```

Regenerate `assets/foundry-utilities.css` after editing utility classes in the HTML or app scripts. Tailwind CSS is pinned to 3.4.17, with its content paths in `tools/tailwind.config.cjs`.

The UI tests use fixture data and block network calls. They cover all 11 views, week zero, score validation, late responses across season and league switches, refresh failures, loading cleanup, session recovery, and dialog focus. They do not submit production data.

## Local third-party assets

- Chart.js 4.5.1: `chart.umd.min.js` from the official `chart.js` npm package. The development-only source-map pointer is removed. Its MIT license is in `assets/vendor/chart-LICENSE.md`.
- Barlow Condensed and Inter: Latin WOFF2 subsets from the official Fontsource npm packages, version 5.3.0. The font weights and local URLs are defined in `assets/foundry-fonts.css`; their licenses are in `assets/fonts/`.

Keep these versions and licenses when replacing assets. The published HTML and asset blobs must match the checked files before providing a QA link.
