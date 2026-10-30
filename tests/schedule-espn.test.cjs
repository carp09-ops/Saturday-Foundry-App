'use strict';
/* 10.1.37: ESPN-style schedule — week pills carry kickoff date ranges, the
   week's games group under day headers, and Top 25 ranks sit beside team
   names on cards (read from the entry's team_rank/opponent_rank by team id). */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const league=fs.readFileSync('assets/graphite/league.js','utf8');
const src=league.slice(league.indexOf('function weekRange('),league.indexOf('function scores('));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
const w=dom.window;
let rows=[];
w.eval(`
  var num=v=>{const n=Number(v);return isNaN(n)?0:n};
  var esc=s=>String(s);
  var games=()=>rows;
  var card=g=>'['+g.id+']';
  ${src}
`);
const setRows=r=>{rows=r;w.eval('');w.rows=r};
// jsdom realm: assign through the window object the closure reads.
const load=r=>{w.rows=r};

test('week pills show kickoff date ranges',()=>{
  load([{week_number:9,kickoff_time:'2026-09-02T16:00:00Z'},{week_number:9,kickoff_time:'2026-09-04T23:00:00Z'},{week_number:10,kickoff_time:'2026-09-09T16:00:00Z'}]);
  assert.equal(w.weekRange(9),'SEP 2–4');
  load([{week_number:9,kickoff_time:'2026-10-30T16:00:00Z'},{week_number:9,kickoff_time:'2026-11-01T17:00:00Z'}]);
  assert.equal(w.weekRange(9),'OCT 30 – NOV 1');
  load([{week_number:9,kickoff_time:'2026-09-02T16:00:00Z'}]);
  assert.equal(w.weekRange(9),'SEP 2');
  load([{week_number:9,kickoff_time:null}]);
  assert.equal(w.weekRange(9),'');
});

test('games group under day headers, kickoff order, untimed last',()=>{
  const out=w.groupedScores([
    {id:'sat',kickoff_time:'2026-10-31T16:00:00Z'},
    {id:'tbd',kickoff_time:null},
    {id:'fri',kickoff_time:'2026-10-30T23:00:00Z'},
  ]);
  const fri=out.indexOf('Friday, Oct 30'),sat=out.indexOf('Saturday, Oct 31'),tbd=out.indexOf('Kickoff time TBD');
  assert.ok(fri>-1&&sat>fri&&tbd>sat,'headers ascend by day with TBD last: '+out);
  assert.ok(out.indexOf('[fri]')>fri&&out.indexOf('[sat]')>sat&&out.indexOf('[tbd]')>tbd,'cards sit under their headers');
  assert.match(out,/class="gameday-head"/);
});

test('rank prefix maps by team id and stays inside the name cell',()=>{
  const g={team_id:'a',team_rank:5,opponent_team_id:'b',opponent_rank:22};
  assert.equal(w.rankPrefix(g,'a'),'<span class="team-rank">5</span>');
  assert.equal(w.rankPrefix(g,'b'),'<span class="team-rank">22</span>');
  assert.equal(w.rankPrefix(g,'zzz'),'');
  assert.equal(w.rankPrefix({team_id:'a',team_rank:null},'a'),'');
  assert.equal(w.rankPrefix({team_id:'a',team_rank:26},'a'),'');
  assert.ok(league.includes('${rankPrefix(g,g.awayId)}${esc(g.away)}'),'away rank inside the name span');
  assert.ok(league.includes('${rankPrefix(g,g.homeId)}${esc(g.home)}'),'home rank inside the name span');
});

test('scores page uses pills with ranges and grouped cards',()=>{
  assert.ok(league.includes("weekRange(w)?`<small>${weekRange(w)}</small>`:''"),'pill carries the range');
  assert.ok(league.includes('${groupedScores(list)||empty('),'scores list renders grouped');
  const css=fs.readFileSync('assets/graphite/site.css','utf8');
  assert.ok(css.includes('.gameday-head{')&&css.includes('.team-rank{'),'styles in source CSS');
});
