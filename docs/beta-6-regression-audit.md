# Saturday Foundry Beta 6 regression audit

Date: October 28, 2026
Baseline: beta.5 / 9c05a9061441ee28ad70f7f6892419f567606ea4
Scope: new native interface, retained advanced runtime, shared business logic, database migration fixtures, and imagery.

## Result

137 automated tests pass, zero failures or skips: 39 native-site regressions, 97 retained-app tests, and one full embedded-runtime integration test. Desktop and 390px mobile fixture browser checks also passed. This is not a guarantee of zero bugs or a certification of authenticated production writes.

## Reproduced defects corrected

1. A delayed H2H validation-status response rebuilt active forms. It now updates state without replacing forms, an open detail dialog, or advanced tools.
2. Delayed schedule options erased typed week/event inputs. Only the opponent options update now; other inputs and the selected bye remain intact.
3. Leagues without seasons could hit null-season render errors. Unsupported destinations show a safe season-not-ready screen.
4. Blank week fields were converted to Week 0. Blank input is now rejected; explicitly entered zero remains valid.
5. Empty opponent catalogs disabled bye entry. Bye weeks remain available even with no opponents.
6. The advanced bridge's debounce could be perpetually postponed by runtime DOM updates. A bounded scheduled check now selects the requested dynasty/season before revealing the tools. Verified using the actual advanced application, not only a stub.

League/season reload actions are additionally blocked during a pending mutation to preserve form and context integrity.

## Coverage

| Area | Evidence |
| --- | --- |
| Login/signup | Signed-out UI, failed credentials, email-confirmation flow, session refresh single-flight, logout during in-flight requests |
| League/team selection | Empty memberships, membership roles, seasonless leagues, claims, race errors, archive navigation |
| Scores | Away/home mapping, zero scores, overtime, invalid/tied scores, confirm-before-write, duplicate submits, lost-response no retry, committed-save/read-failure distinction |
| Shared league Home | Own matchup, other user matchups before stories, more than three games, H2H deduplication |
| Schedule | Conference classification, away location, bye creation, empty catalogs, delayed responses, blank-week rejection |
| H2H | Pending validation, exact score/version payload, dispute note, server-side fixtures and permission regressions |
| Standings | American percentage/H2H/tie ordering, Sun Belt handling and national ledger tests retained |
| Intelligence/market | Automatic lines, real ID matching, pick'em, missing values, zero totals, late response isolation and request deduplication |
| Legacy | Trophy archive/vault, career journey, coach cards, rivalry center, chronicles and stories retained tests |
| Commissioner | Role checks, invitations, archived-season week protection, original rollover database fixtures |
| Advanced tools | New-shell containment, requested league/season, real runtime view navigation, original runtime load/failure tests |
| Robustness | Required/optional read failures, pagination, escaping, RPC allowlist, mutation locks, session changes |
| Imagery | Original school logos and branded artwork preserved; missing/broken team/coach images use generated art; account/league/news initial placeholders removed; explicit advanced fallback slots repaired |

## Browser checks

Used isolated synthetic data with all fetches intercepted; no production database mutations. Verified desktop Home branding, shared games and lines; 0–21 score review; teams and unknown-coach fallback; 390px Home/bottom navigation, Legacy/trophy modal, and standings. No horizontal document overflow or broken loaded images on the inspected desktop coach screen. The mobile check was a 390×844 browser frame, not physical-device Safari.

## Remaining release gate

A real signed-in member and commissioner session must still exercise the deployed preview against a disposable test league: sign-in/refresh, team claim, score submission and H2H confirmation/dispute, imports/corrections, season rollover, and returning from advanced tools. This audit used fixture-backed REST/RPC responses and local PGlite database tests; it did not validate production RLS, deliver email, run live imports, create a league, or roll a real season. Keep the branch in preview until that acceptance pass is complete.

No changes to production index.html, main, database schema, or live league records.

## Artwork provenance

Built-in image generation produced a neutral graphite helmet with crimson stripe, no letters, initials, numbers, school logos, or person. Full-resolution 1254px square output was encoded as WebP (approximately 91KB) for the application at `assets/graphite/football-fallback.webp`. Existing school marks and original coach/Foundry artwork take priority. This image is decorative football artwork, not a fabricated school logo or coach portrait.

Prompt: “Use case: stylized-concept. Asset type: polished square fallback artwork for Saturday Foundry college football dynasty dashboard, displayed at tiny avatar sizes and larger coach card sizes. A single premium graphite black American football helmet with a crisp crimson center stripe and dark facemask, centered three-quarter side view on charcoal studio backdrop, subtle crimson rim lighting, sharp realistic material details, ample safe margin all around. No letters, no initials, no numbers, no logos, no text, no person, no watermark. This is neutral football artwork, not a specific school identity. Square composition.”

## Reproduce

Install the repository's declared jsdom and PGlite development dependencies, then run:

```sh
python tools/build-site.py
node --test tests/*.test.cjs tests/ui/*.test.cjs
```

The audit ran in an isolated copy of the repository with baseline-matched tests/modules and the unchanged production index, plus the new native entry, generated advanced wrapper and beta assets. QA-only fixture pages were not published.
