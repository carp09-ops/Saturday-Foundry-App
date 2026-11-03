'use strict';
/* Bye weeks (10.1.57): a week with at least one regular (non-postseason)
   game league-wide is a schedule week; a team with no game in such a week
   is on a bye — no recorded bye entry needed. The team schedule interleaves
   bye rows; postseason-only weeks never produce bye rows. Also pins the
   masthead refresh control (cache-busting reload, no more killing the app). */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const league=fs.readFileSync('assets/graphite/league.js','utf8');
const workflows=fs.readFileSync('assets/graphite/workflows.js','utf8');
const icons=fs.readFileSync('assets/graphite/icons.js','utf8');
const start=league.indexOf('function unique(');
const srStart=league.indexOf('function scheduleRows');
const src=league.slice(start,league.indexOf('\nfunction ',srStart+10));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://x/'});
const w=dom.window;
let n=0;
const mk=(team,opp,week,opts={})=>({id:'g'+(++n),week_number:week,status:opts.status||'scheduled',game_type:opts.type||'conference',is_bye:false,team_id:team[0],team_name:team[1],opponent_team_id:opp[0],opponent_team:opp[1],primary_side:'home',points_for:opts.pf??null,points_against:opts.pa??null});
const FLA=['fla','Florida'],GT=['gt','Georgia Tech'],ARMY=['army','Army'],C1=['c1','CPU One'],C2=['c2','CPU Two'];
const entries=[
  mk(FLA,C1,1,{status:'completed',pf:28,pa:14}),
  mk(GT,ARMY,1),
  mk(GT,C1,2),
  mk(ARMY,C2,2),
  mk(FLA,GT,3),
  mk(FLA,C2,16,{type:'bowl'}),
];
w.eval(`
  var esc=s=>String(s==null?'':s), uid=s=>String(s), logo=(id,name)=>'[logo:'+name+']';
  var num=x=>Number.isFinite(Number(x))?Number(x):0;
  var route='team', season={season_id:'s1',is_active:true}, dynasty={dynasty_id:'d1'};
  var selectedTeam='fla';
  var model={scheduleGames:${JSON.stringify(entries)},teams:[{id:'fla',name:'Florida'},{id:'gt',name:'Georgia Tech'}],programs:[],liveStatus:[],coachStreams:[]};
  ${src}
`);

test('regular weeks are the weeks with a regular game league-wide',()=>{
  assert.deepEqual(w.regularWeeks(),[1,2,3],'bowl-only week 16 is not a schedule week');
});

test('a team with no game in a regular week is on a bye',()=>{
  assert.equal(w.teamOnBye('fla',2),true,'Florida idle in week 2');
  assert.equal(w.teamOnBye('fla',1),false,'Florida plays in week 1');
  assert.equal(w.teamOnBye('gt',2),false,'Georgia Tech plays in week 2');
});

test('team schedule interleaves a bye row in the idle week only',()=>{
  const out=w.scheduleRows(w.teamGames('fla'),'fla');
  const byeAt=out.indexOf('schedule-row bye');
  assert.ok(byeAt>out.indexOf('Wk 1')&&byeAt<out.indexOf('Wk 3'),'bye row sits between weeks 1 and 3');
  assert.ok(out.slice(byeAt,out.indexOf('</div>',byeAt)).includes('Bye week'),'bye row is labelled');
  assert.equal((out.match(/schedule-row bye/g)||[]).length,1,'exactly one bye row — none for the bowl week');
  assert.ok(out.includes('Wk 16'),'the bowl game itself still renders');
});

test('scores and home surfaces use the same bye rule',()=>{
  assert.ok(league.includes('On bye this week:'),'scores names the coach teams on bye for the selected week');
  assert.ok(workflows.includes('bye week')&&workflows.includes('teamOnBye(mine,week)'),'home banners my team when it is idle in the current week');
});

test('masthead refresh reloads the app with a cache-bust',()=>{
  assert.ok(league.includes('function refreshApp()'),'refresh helper exists');
  assert.ok(league.includes("searchParams.set('sfv'"),'refresh busts the cached page');
  assert.ok(workflows.includes('onclick="refreshApp()"')&&workflows.includes('mast-refresh'),'refresh button sits in the masthead actions');
  assert.ok(icons.includes("refresh:'"),'refresh icon is defined');
});
