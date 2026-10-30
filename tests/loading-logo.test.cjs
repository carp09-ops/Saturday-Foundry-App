const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('the site shield is the loading icon everywhere loading shows', () => {
  for (const file of ['assets/graphite/workflows.js', 'assets/graphite/league.js']) {
    const src = read(file);
    assert(src.includes('<img class="loading-logo" src="${BRAND_ASSET}foundry-shield.webp"'), file + ' busy screen should show the shield');
    assert(!src.includes('<div class="spinner"></div>'), file + ' should no longer render the ring spinner');
  }
  const shell = read('tools/build-site.py');
  assert(shell.includes('<img class="loading-logo" src="assets/graphite/brand/foundry-shield.webp"'), 'Pre-JS shell should show the shield while the app boots');
  const css = read('assets/graphite/site.css');
  assert(css.includes('.loading-logo{display:block;width:76px;height:76px'), 'Loading logo styling should exist');
  assert(css.includes('@keyframes logopulse'), 'Loading logo should have its pulse animation');
  const responsive = read('assets/graphite/responsive.css');
  assert(responsive.includes('.spinner,.loading-logo{animation:none}'), 'Reduced motion should still the logo pulse');
  assert(fs.existsSync(path.join(root, 'assets/graphite/brand/foundry-shield.webp')), 'Shield asset exists');
});
