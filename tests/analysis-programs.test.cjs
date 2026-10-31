'use strict';
/* Season analysis is the Foundry-programs scoring table: it must list only
   programs currently controlled by a coach. Vacated programs (North Carolina
   and California in WSB S7, after the moves to Florida and West Virginia)
   keep standings rows but have no person_id — they must not appear. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const league=fs.readFileSync('assets/graphite/league.js','utf8');
const src=league.slice(league.indexOf('function analysis('),league.indexOf('\nfunction ',league.indexOf('function analysis(')+10));
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
const w=dom.window;
w.eval(`
  var esc=s=>String(s), num=v=>Number(v)||0, fmt=v=>String(v), uid=s=>String(s);
  var dynasty={name:'WSB'};
  var title=(...a)=>a[1]; var section=()=>'S'; var row=()=>'R';
  var table=(h,rows)=>rows.map(r=>r[0]).join('|');
  var model={
    programs:[
      {team_id:'fla',person_id:'corey'},{team_id:'gt',person_id:'jared'},{team_id:'wvu',person_id:'saif'},
      {team_id:'unc',person_id:null},{team_id:'cal',person_id:null}
    ],
    standings:[
      {team_id:'fla',team_name:'Florida',wins:2,losses:0,games_played:2,points_for:65,points_against:40},
      {team_id:'gt',team_name:'Georgia Tech',wins:2,losses:0,games_played:2,points_for:97,points_against:24},
      {team_id:'wvu',team_name:'West Virginia',wins:1,losses:0,games_played:1,points_for:43,points_against:31},
      {team_id:'unc',team_name:'North Carolina',wins:0,losses:0,games_played:0,points_for:0,points_against:0},
      {team_id:'cal',team_name:'California',wins:0,losses:0,games_played:0,points_for:0,points_against:0}
    ]
  };
  ${src}
`);
test('analysis lists only active coach-controlled programs',()=>{
  const out=w.analysis();
  assert.ok(out.includes('Florida')&&out.includes('Georgia Tech')&&out.includes('West Virginia'),'coach programs listed');
  assert.ok(!out.includes('North Carolina')&&!out.includes('California'),'vacated programs hidden');
});
