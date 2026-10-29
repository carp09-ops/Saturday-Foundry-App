const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Compact mobile navigation remains in the source and both generated app pages', () => {
  const css = read('assets/graphite/responsive.css');
  const index = read('index.html');
  const compatibility = read('foundry.html');
  const workflows = read('assets/graphite/workflows.js');
  const version = JSON.parse(read('package.json')).version;
  assert.match(version, /^10\.1\.\d+(?:-beta\.\d+)?$/);
  assert(index.includes(`<meta name="sf-version" content="${version}">`), 'Generated build version must match package.json');
  assert.equal(index, compatibility, 'Both entry points must stay in sync.');
  assert(index.includes(css), 'Generated page must include source CSS so builds cannot erase the fix.');
  assert.match(css, /@media\(max-width:700px\)\{\s*\.bottomnav\{box-sizing:border-box;width:100%/);
  assert.match(css, /\.bottomnav button\{min-width:0;min-height:44px;/);
  assert.match(css, /\.bottomnav \.icon\{width:18px;height:18px\}/);
  assert.match(css, /\.bottomnav button\.on:before\{height:2px;width:20px;/);
  assert.match(css, /env\(safe-area-inset-bottom,0px\)/);
  assert.match(workflows, /\['Home','home'\],\['Scores','scores'\],\['Teams','teams'\],\['Standings','standings'\],\['Legacy','legacy'\]/);
});


test('standalone Home Screen dock is pinned to the viewport and remains compact',()=>{
 const css=read('assets/graphite/responsive.css');
 const entry=read('index.html');
 const workflows=read('assets/graphite/workflows.js');
 assert.match(css,/html\.sf-standalone \.site-app\{position:fixed;inset:0;/);
 assert.match(css,/html\.sf-standalone \.bottomnav\{position:fixed!important;/);
 assert.match(css,/bottom:0;z-index:60;/);
 assert.match(css,/html\.sf-standalone \.bottomnav button\{flex:1 1 0;max-width:110px;min-width:0;min-height:44px;height:44px;/);
 assert.match(css,/padding-bottom:calc\(56px \+ env\(safe-area-inset-bottom,0px\)\)/);
 assert.match(workflows,/navigator\.standalone===true/);
 assert.match(entry,/html\.sf-standalone \.bottomnav/);
});


test('standalone bottom inset is capped so the Home Screen menu cannot become oversized',()=>{
 const css=read('assets/graphite/responsive.css');
 const index=read('index.html');
 assert.match(css,/--sf-dock-safe-bottom:clamp\(0px,env\(safe-area-inset-bottom,0px\),30px\)/);
 assert.match(css,/height:calc\(52px \+ var\(--sf-dock-safe-bottom\)\)!important/);
 assert.match(css,/max-height:calc\(52px \+ var\(--sf-dock-safe-bottom\)\)!important/);
 assert.match(css,/min-height:0!important/);
 assert.match(css,/padding-bottom:calc\(52px \+ var\(--sf-dock-safe-bottom\)\)/);
 assert.match(css,/html\.sf-standalone \.bottomnav button\{[\s\S]*?min-height:44px;max-height:44px;height:44px/);
 assert(index.includes(css),'Generated Home Screen app must retain capped safe area rules');
 // A falsely reported 100px inset must collapse to a 30px inset (82px dock).
 const dockHeight=inset=>52+Math.max(0,Math.min(inset,30));
 assert.equal(dockHeight(100),82);
 assert.equal(dockHeight(20),72);
 assert.equal(dockHeight(0),52);
});


test('iOS installed app avoids deprecated black-translucent status bar geometry',()=>{
 const builder=read('tools/build-site.py');
 const index=read('index.html');
 const compatibility=read('foundry.html');
 const version=JSON.parse(read('package.json')).version;
 assert.match(version,/^10\.1\.\d+(?:-beta\.\d+)?$/);
 assert.equal(index,compatibility,'Both installed app entry points must use the same metadata');
 for(const source of [builder,index,compatibility]){
   assert.doesNotMatch(source,/apple-mobile-web-app-status-bar-style/);
   assert.doesNotMatch(source,/black-translucent/);
   assert.match(source,/apple-mobile-web-app-capable/);
   assert.match(source,/viewport-fit=cover/);
 }
 assert.match(index,/<meta name="theme-color" content="#24262B">/);
 assert(index.includes(`<meta name="sf-version" content="${version}">`));
 assert(index.includes(`const SITE_VERSION='${version}'`));
 assert.match(index,/html\.sf-standalone \.bottomnav/);
 assert.match(read('manifest.webmanifest'),/"display": "standalone"/);
});


test('standalone Foundry ribbon is above the dock, crimson on graphite and noninteractive',()=>{
 const css=read('assets/graphite/responsive.css');
 const js=read('assets/graphite/workflows.js');
 const entry=read('index.html');
 const compatibility=read('foundry.html');
 assert.equal(entry,compatibility);
 assert(js.includes('class="sf-bottom-ribbon" role="note"'), 'Ribbon should render with the five-tab navigation');
 assert(js.indexOf('class="sf-bottom-ribbon"')<js.indexOf('class="bottomnav"'), 'Ribbon must precede dock in markup');
 assert(css.includes('.sf-bottom-ribbon{display:none}'), 'Normal Safari and desktop should not show ribbon');
 assert(css.includes('html.sf-standalone .sf-bottom-ribbon{'), 'Only installed app should show it');
 assert(css.includes('bottom:calc(52px + var(--sf-dock-safe-bottom,0px))'), 'Place ribbon immediately above safe-area dock');
 assert(css.includes('pointer-events:none'), 'Ribbon must never obstruct navigation');
 assert(css.includes('border-top:1px solid #C72D40')&&css.includes('background:linear-gradient'), 'Use graphite and crimson rather than white');
 assert(css.includes('html.sf-standalone body{background:#24262B!important}'), 'Paint available underlay in graphite');
 assert(css.includes('padding-bottom:calc(86px + var(--sf-dock-safe-bottom,0px))'), 'Keep scrolling content clear of banner');
 assert(entry.includes('Your dynasty, forged on Saturdays'));
 assert(entry.includes(css),'Generated release must include banner source');
 const report=read('assets/graphite/report.js');
 assert(report.includes('foundry-shield.webp'), 'Ticker brand should use the site shield logo');
 assert(report.includes('function tickerFit()'), 'Ticker should scale long items to fit instead of clipping them');
 assert(report.includes('setInterval(tickerStep,5000)'), 'Ticker should dwell five seconds per item');
 assert(report.includes('sf-tick-scroll')&&css.includes('@keyframes sfTickScroll'), 'Overflowing ticker items should scroll within their dwell instead of truncating');
});
