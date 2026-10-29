const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('10.1.1 compact mobile navigation remains in the source and both generated app pages', () => {
  const css = read('assets/graphite/responsive.css');
  const index = read('index.html');
  const compatibility = read('foundry.html');
  const workflows = read('assets/graphite/workflows.js');
  const version = JSON.parse(read('package.json')).version;
  assert.equal(version, '10.1.1');
  assert.equal(index, compatibility, 'Both entry points must stay in sync.');
  assert(index.includes(css), 'Generated page must include source CSS so builds cannot erase the fix.');
  assert.match(css, /@media\(max-width:700px\)\{\s*\.bottomnav\{box-sizing:border-box;width:100%/);
  assert.match(css, /\.bottomnav button\{min-width:0;min-height:44px;/);
  assert.match(css, /\.bottomnav \.icon\{width:18px;height:18px\}/);
  assert.match(css, /\.bottomnav button\.on:before\{height:2px;width:20px;/);
  assert.match(css, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(workflows, /\['Home','home'\],\['Scores','scores'\],\['Teams','teams'\],\['Standings','standings'\],\['Legacy','legacy'\]/);
});
