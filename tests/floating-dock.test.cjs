'use strict';
/* 10.1.36: the bottom dock floats as an ESPN-style graphite-glass capsule with a
   crimson active pill; the Bottom Line ribbon reflows above it and the scroll
   viewport keeps enough clearance that the capsule never covers a card. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const css=fs.readFileSync('assets/graphite/responsive.css','utf8');
const block=css.slice(css.indexOf('10.1.36'));

test('dock is a floating glass capsule',()=>{
  assert.ok(block.length>0,'capsule block present');
  assert.match(block,/\.bottomnav\{position:fixed;left:10px;right:10px;/);
  assert.match(block,/border-radius:999px;background:rgba\(26,27,31,\.93\)/);
  assert.match(block,/backdrop-filter:blur\(14px\)/);
  assert.match(block,/box-shadow:0 12px 32px/);
});

test('active tab is a crimson pill, tick removed',()=>{
  assert.match(block,/\.bottomnav button\.on\{background:var\(--accent\);color:#fff\}/);
  assert.match(block,/\.bottomnav button\.on:before\{display:none\}/);
});

test('standalone geometry: THE LINE grounds the bottom edge, capsule floats above it, content clears both',()=>{
  // 10.1.38: Corey asked for the ticker below the menu. The standalone dock
  // override must carry the glass background itself: html.sf-standalone rules
  // outrank the generic .bottomnav rule, which is how 10.1.36 shipped a cream
  // bar pinned by an older bottom:0!important.
  assert.match(block,/html\.sf-standalone \.bottomnav\{left:10px;right:10px;bottom:calc\(42px \+ var\(--sf-dock-safe-bottom\)\)!important;height:60px!important/);
  assert.match(block,/html\.sf-standalone \.bottomnav\{[^}]*background:rgba\(26,27,31,\.93\)/);
  assert.match(block,/html\.sf-standalone \.sf-bottom-ribbon\{bottom:var\(--sf-dock-safe-bottom\);height:34px;align-items:center\}/);
  assert.match(block,/html\.sf-standalone \.viewport\{padding-bottom:calc\(112px \+ var\(--sf-dock-safe-bottom,0px\)\)\}/);
});
