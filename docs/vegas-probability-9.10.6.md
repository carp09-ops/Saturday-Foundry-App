# Vegas probability correction — Preview 9.10.6

Team artwork is now an SVG image inside the helmet viewBox, contained in a 20 × 14 area with its original aspect ratio. General HTML team-logo rules and wrappers cannot move it below the shell.

The rail uses dedicated grid segments with widths tied directly to the same percentages used by the labels and seam. Tennessee 45% / SMU 55% gives a 45% orange segment on the left and 55% blue segment on the right. A favored-team caption clarifies that the helmet identifies the favorite while sitting at the probability boundary, rather than indicating the favorite’s percentage position.

Validation: 44 automated tests pass, including Tennessee/SMU stored from either team’s perspective. Browser measurements confirm the 45/55 split at 320, 390, 768, and 1024 pixels, no horizontal overflow or runtime errors, and logo placement inside the helmet after delayed app styling. External logo positioning uses a fixture via the same resolver URL in the restricted QA network.
