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
