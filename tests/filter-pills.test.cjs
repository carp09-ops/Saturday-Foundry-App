'use strict';
/* Filter pills: the Standings switcher rendered its selected pill as a tall
   black blob because the unselected buttons carry the global .primary CTA
   class (display:block;width:100%;tall padding) into the flex filter bar.
   The .filterbar override must give every button one ESPN-style capsule
   geometry regardless of the classes the markup hands it. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const css=['site.css','responsive.css','report.css','career-hub.css'].map(f=>fs.readFileSync('assets/graphite/'+f,'utf8')).join('\n');
const dom=new JSDOM(`<!doctype html><style>${css}</style><body><div class="filterbar"><button class="sel">Conference</button><button class="primary">Top 25</button><button class="primary">Season analysis</button></div></body>`,{url:'https://x/'});
const w=dom.window;

test('every filter pill shares one capsule geometry, whatever class it carries',()=>{
  const styles=[...w.document.querySelectorAll('.filterbar button')].map(b=>w.getComputedStyle(b));
  for(const cs of styles){
    assert.equal(cs.display,'inline-flex');
    assert.equal(cs.height,'38px');
    assert.equal(cs.width,'auto','the .primary width:100% leak is overridden');
    assert.equal(cs.borderRadius,'999px');
    assert.equal(cs.padding,'0px 16px');
    assert.equal(cs.flexGrow,'0');
  }
  const bar=w.getComputedStyle(w.document.querySelector('.filterbar'));
  assert.equal(bar.alignItems,'center');
});

test('selected pill is the graphite fill; sources carry the override after the CTA rules',()=>{
  const resp=fs.readFileSync('assets/graphite/responsive.css','utf8');
  const block=resp.slice(resp.indexOf('Filter pills, ESPN-style'));
  assert.ok(block.length>0,'override block present');
  assert.match(block,/\.filterbar button\.sel\{background:var\(--graphite\);border-color:var\(--graphite\);color:#fff\}/);
  assert.match(block,/\.filterbar button\{[^}]*width:auto;height:38px;/,'geometry override present in the last general stylesheet');
});
