# Vegas probability visual — Preview 9.10.5

The overview Games of the Week probability rail uses the matchup’s away and home team colors. Away remains left and home remains right regardless of which team owns the stored game entry. The favored team’s native SVG helmet and existing team logo sit at the split; even matchups use a neutral Foundry mark. Percentage labels and an accessible description make the stored odds explicit.

Completed games retain FINAL and missing markets retain MARKET PENDING. Unknown team colors use the program color or a neutral fallback. Unavailable logos leave the colored helmet visible. The bar still uses the existing game/market data and schedule navigation.

Validation: 43 automated tests passed. Browser checks at 320, 390, 768, and 1024 pixels showed no horizontal overflow or runtime errors. External ESPN images are unavailable in the QA network, so logo positioning was additionally checked with a fixture image through the same resolver URL.
