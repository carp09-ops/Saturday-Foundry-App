# Saturday Foundry experience preview

Version: 9.11.0-preview.1. Based on main 015543681ab67db19cedd9a7777d82ae7f1e8235.

## Review entry points

- `experience-tour.html`: interactive sample, with desktop/phone sizing. Isolates storage, blocks outbound fetch/XHR/WebSocket/beacon calls, and uses in-memory fixture data. No account required. All records and coach assignments shown in the tour are illustrative.
- `index.html`: real application and existing authentication. Connects to the existing live database. Normal actions such as selecting a program or entering a score still save real data.

## Journey and information architecture

Account → dynasty chooser → program selection when unassigned → Home.
Returning coaches enter their assigned program without having to choose again.

| Destination | Visible content and direct routes |
| --- | --- |
| Home | Current coach slate, Your Week, weekly coverage, Games of the Week, coaching room digest, League and Legacy |
| Games | Existing schedule and score entry, lines and predictions, head-to-head matchups |
| League | Official conference standings, Top 25, season pulse, analysis |
| Coaches | Canonical coach cards, chronicles, rivalries, direct comparison |
| Legacy | Trophy room, career leaders, coaching records, season recaps |

Account tools provide dynasty switching, create/join, refresh, all features, sign out, and commissioner controls when authorized. Detail screens have a breadcrumb to their destination. Browser history retains routes within the current dynasty/season. One global season selector uses the existing load handler.

No migrations, standings calculations, auth endpoints, permissions, coach portraits, or score-save logic are changed. Presentation is isolated in `assets/foundry-experience.js` and `.css`. The existing navigation remains as an internal route bridge so feature initialization continues to run. Existing secondary analysis/Legacy tabs remain available inside their destinations.

## Artwork provenance

Three original wordless images were generated with the built-in imagegen tool, inspired by the user's original Saturday Foundry mockups. They are atmospheric concept art, never representations of actual games or records. Existing SF branding and canonical coach portraits are preserved. Optimized WebP assets total about 286 KB.

### stadium

Asset: `assets/experience/stadium.webp`.

Prompt:

> Use case: photorealistic-natural. Asset type: premium college-football dynasty web app hero background, wide landscape 2048x1152. Create a cinematic editorial photograph at field level in a packed American college football stadium at blue hour turning to night. Restrained antique gold floodlights cut through subtle atmospheric haze, graphite shadows, deep green turf, warm ivory highlights. The composition is a sweeping stadium bowl; one small anonymous football player seen from behind on the far right quarter, looking toward the bright field. Make the left half of the image visually quiet dark atmospheric negative space for live headline overlay. Realistic photographic texture, subtle film grain, sophisticated sports documentary, powerful but calm. No lettering, text, UI, logos, watermarks, identifiable teams, exaggerated neon, flames, or spark effects. The image should feel like a premium sports magazine cover photograph. This is a website asset, not a mockup.
\n### tunnel

Asset: `assets/experience/tunnel.webp`.

Prompt:

> Use case: photorealistic-natural. Asset type: full-height login and onboarding background for a premium college football coaching dynasty app; portrait 1024x1536. Create an atmospheric photograph from inside a dark concrete stadium tunnel looking out onto a glowing college football field at night. A distant anonymous football coach in a dark jacket is a small silhouette in the lower center-right, facing the floodlit field. Strong architectural lines, tactile concrete, deep graphite, antique gold and warm ivory stadium lights, subdued green grass. Moody sophisticated sports editorial, realistic film grain. Keep upper half and left side simple enough for typography overlay. No logos, numbers, text, typography, UI, watermarks, neon, fire, or effects. This is a production background asset, not an app screenshot.
\n### legacy

Asset: `assets/experience/legacy.webp`.

Prompt:

> Use case: photorealistic-natural. Asset type: landscape editorial card background for college football Legacy hub, 1536x1024. A close architectural still-life photograph of a classic unbranded football championship trophy, brushed antique gold football sculpture mounted on a dark walnut plinth, in a dim prestigious collegiate athletic trophy room. Place the trophy in right third, with warm spotlights and out-of-focus championship banners behind. Dark graphite shadows, warm ivory and aged gold accents, tactile polished metal. Left half is quiet dark negative space for live headline. Understated premium sports editorial, realistic photograph. No readable text, no team logos, no brand logos, no watermark, no neon, no UI.


## Validation

The full-app runtime suite covers the five destinations, direct comparison, breadcrumbs, permissions, keyboard program selection, back to dynasty selection, Week 0, empty scores, season isolation, and the isolated sample tour. Existing conference, rollover, coach history, trophy, story, rivalry and scorecard checks are also retained. Browser visual review follows the initial branch commit.

