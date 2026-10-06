# Vegas helmet confidence — Preview 9.10.7

The helmet now indicates confidence toward the favorite’s side independently of the colored probability boundary. Home favorite at 90% places it 90% across toward the home label; away favorite at 90% places it 10% across toward away. Colored segments continue to display each team’s exact share. Equal matchups center the marker. End positions remain inset enough to keep the helmet visible.

The helmet artwork uses a contained background layer instead of an external SVG image. It preserves the original logo proportions and adds a gold glow without triggering global HTML logo wrappers.

Validation: automated mapping tests cover both 90% home and away favorites, unchanged segment probabilities, and even matchups. Mobile browser inspection checks marker placement, rail proportions, and contained artwork.
