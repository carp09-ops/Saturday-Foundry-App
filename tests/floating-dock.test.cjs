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

test('standalone geometry: dock floats off the safe area, ribbon above it, content clears both',()=>{
  assert.match(block,/html\.sf-standalone \.bottomnav\{left:10px;right:10px;bottom:calc\(var\(--sf-dock-safe-bottom\) \+ 8px\);height:60px!important/);
  assert.match(block,/html\.sf-standalone \.sf-bottom-ribbon\{bottom:calc\(74px \+ var\(--sf-dock-safe-bottom,0px\)\)\}/);
  assert.match(block,/html\.sf-standalone \.viewport\{padding-bottom:calc\(108px \+ var\(--sf-dock-safe-bottom,0px\)\)\}/);
});
