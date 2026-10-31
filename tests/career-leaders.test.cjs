'use strict';
/* Career leaders (Legacy) spanned the full width with WINS and LOSSES at
   opposite ends of a three-column table — Corey: "too spaced out". The table
   gets a fixed layout that clusters the stat columns and slightly tighter rows. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
test('career leaders table is wrapped and clustered',()=>{
  const league=fs.readFileSync('assets/graphite/league.js','utf8');
  const wrap=league.indexOf('<div class="leaders-table">');
  assert.ok(wrap>-1,'wrapper present');
  assert.ok(league.includes('<div class="leaders-table">${table([\'COACH\',\'WINS\',\'LOSSES\']'),'the div opens in literal text and the table expression follows inside it');
  assert.ok(league.indexOf('</div>',wrap)<league.indexOf('tiersHTML()',wrap),'wrapper closes before the tiers section');
  const css=fs.readFileSync('assets/graphite/site.css','utf8');
  assert.ok(css.includes('.leaders-table .table{table-layout:fixed}'),'fixed layout');
  assert.ok(css.includes('.leaders-table .table td:nth-child(1){width:52%}'),'coach column takes the room');
  assert.ok(css.includes('.leaders-table .table td{padding-top:11px;padding-bottom:11px}'),'rows tightened');
});
