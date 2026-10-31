'use strict';
/* Dock centering (10.1.45): the capsule must be auto-width between its insets
   (an older layer's width:100% pushed it off-screen and clipped the last tab)
   and every tab an equal flex cell with no max-width cap. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
test('dock centering rules close out the responsive cascade',()=>{
  const css=fs.readFileSync('assets/graphite/responsive.css','utf8');
  const block=css.slice(css.indexOf('10.1.45: dock centering'));
  assert.ok(block.includes('html.sf-standalone .bottomnav{width:auto'),'standalone capsule is auto-width');
  assert.ok(block.includes('html.sf-standalone .bottomnav button{flex:1 1 0;max-width:none;min-width:0}'),'standalone tabs are equal uncapped cells');
  assert.ok(block.includes('.bottomnav button{flex:1 1 0;max-width:none;min-width:0}'),'browser tabs are equal uncapped cells');
  assert.ok(css.indexOf('10.1.45: dock centering')>css.indexOf('10.1.36: ESPN-style floating capsule dock'),'centering block lands after the capsule block it corrects');
});

test('load screen footer rests low and the card right column has air',()=>{
  const css=fs.readFileSync('assets/graphite/site.css','utf8');
  assert.ok(css.includes('.viewport{display:flex;flex-direction:column}'),'viewport is a column flex');
  assert.ok(css.includes('.viewport .content{flex:1 0 auto}'),'main grows so the footer drops to the bottom on short screens');
  assert.ok(css.includes('.match-team>:last-child{justify-self:end;text-align:right}'),'right column content right-aligns');
  // The 10.1.48 failure mode: a fixed track declared in site.css was silently
  // overridden by responsive.css layers later in the bundle. Guard the win,
  // not the declaration — no .match-team rule in ANY layer may use auto.
  for(const f of ['assets/graphite/site.css','assets/graphite/responsive.css','assets/graphite/report.css','assets/graphite/career-hub.css']){
    const src=fs.readFileSync(f,'utf8');
    assert.ok(!/\.match-team\{[^}]*1fr auto/.test(src),f+' must not redeclare the card right track as auto');
  }
  const resp=fs.readFileSync('assets/graphite/responsive.css','utf8');
  assert.ok(resp.includes('grid-template-columns:30px 1fr 128px'),'the phone layer carries the fixed track');
});
