# iPhone Home Screen dock appearing far above the home indicator

The iOS 27 installed Home Screen app had its content viewport rendered shorter than the device screen. The five-tab dock was already compact and bottom-fixed within the reported viewport, but an OS-controlled strip persisted *below* it. Repeated tweaks to `.bottomnav` height, safe-area caps, and `bottom:0` could not move controls into that strip.

WebKit reference:
- https://bugs.webkit.org/show_bug.cgi?id=317153 — iOS 27 Home Screen app fullscreen status-bar regression. WebKit recommends removing the deprecated `apple-mobile-web-app-status-bar-style=black-translucent` meta key, which can affect install-time viewport geometry.
- https://bugs.webkit.org/show_bug.cgi?id=313800 — WebKit exposes an iOS standalone viewport smaller than `screen.height` by approximately the status bar inset. The reserved strip may not be reachable by CSS or JavaScript.

**10.1.5 change:** remove the status-bar-style meta tag from both generated native entry points via `tools/build-site.py`. Preserve `viewport-fit=cover`, the manifest, `theme-color`, current dock touch targets, and all game/season features.

**Required acceptance procedure on iPhone:** old installed Home Screen app chrome may retain its viewport geometry. Remove the existing Foundry Home Screen icon; open https://saturday-foundry.netlify.app in Safari; use Share > Add to Home Screen and launch the fresh icon. This may require signing in again because standalone browser storage may differ. Check both Home/scroll positions and safe-area alignment. If the bottom gap persists on a freshly installed icon, inspect `window.innerHeight`, `visualViewport.height`, `screen.height`, and computed inset variables on that device before changing CSS again; no amount of `bottom:0` can render content outside the OS-exposed web viewport.

This is **not** a database or Season 7 change.
