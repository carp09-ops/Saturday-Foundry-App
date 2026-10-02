#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx --yes tailwindcss@3.4.17 -c tools/tailwind.config.cjs -i tools/foundry-utilities.input.css -o assets/foundry-utilities.css --minify
