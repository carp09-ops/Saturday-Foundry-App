'use strict';
/* Top 25 rows carry team logos beside the name, ESPN-style. The poll rows
   have no points column in the data — that gap stays honest (no PTS). */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const league=fs.readFileSync('assets/graphite/league.js','utf8');
const start=league.indexOf('function rankings(){');
const src=league.slice(start,league.indexOf('\nfunction ',start+10));
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
const w=dom.window;
w.eval(`
  var esc=s=>String(s);
  var dynasty={name:'WSB'};
  var title=(...a)=>a[1];
  var empty=t=>'EMPTY:'+t;
  var teamData=id=>({ok:{name:'Oklahoma'},usc:{name:'USC'}}[id]||{name:String(id)});
  var logo=(id,nm)=>'<img class="team-logo" data-team="'+id+'" alt="">';
  var table=(h,rows)=>h.join(',')+'||'+rows.map(r=>r.join('~')).join('|');
  var model={rankings:[
    {week_number:1,rank:2,team_id:'usc',wins:0,losses:0},
    {week_number:1,rank:1,team_id:'ok',wins:0,losses:0}
  ]};
  ${src}
`);
test('each Top 25 row shows the team logo beside its name, sorted by rank',()=>{
  const out=w.rankings();
  assert.ok(out.includes('RANK,TEAM,RECORD,TREND'),'same four columns — no invented PTS');
  const okCell=out.indexOf('data-team="ok"'),uscCell=out.indexOf('data-team="usc"');
  assert.ok(okCell>-1&&uscCell>-1,'both rows carry logos');
  assert.ok(okCell<uscCell,'rank order preserved (Oklahoma 1, USC 2)');
  assert.ok(out.includes('>Oklahoma<')&&out.includes('>USC<'),'names still shown beside the logos');
  assert.ok(out.includes('table-team rank-team'),'row uses the rank-team cell');
  const css=fs.readFileSync('assets/graphite/site.css','utf8');
  assert.ok(css.includes('.rank-team .team-logo{width:28px;height:28px}'),'logos sized for a table row, ESPN-scale');
});
