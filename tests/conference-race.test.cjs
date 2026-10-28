const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script id="conference-race-v79-runtime">([\s\S]*?)<\/script>/)[1];
const game=(a,b,overrides={})=>({id:a+'-'+b,team_id:a,team_name:a,team_conference:'American',opponent_team_id:b,opponent_team:b,opponent_conference:'American',game_type:'regular_season',status:'completed',points_for:21,points_against:7,...overrides});
function renderState(t,state){
 const dom=new JSDOM('<div id="confRaceBoards"></div>',{runScripts:'outside-only'}),w=dom.window;
 t.after(()=>w.close());
 w.CDHQ_RUNTIME={getState:()=>state,esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),currentWeek:()=>12};
 w.eval(source);
 const rows=[...w.document.querySelectorAll('.conf-row')].map(e=>({name:e.querySelector('strong').textContent,position:e.querySelector('.conf-pos').textContent,record:e.querySelectorAll('.conf-record')[0].textContent,overall:e.querySelectorAll('.conf-record')[1].textContent,metric:e.querySelector('.conf-rem').textContent,status:e.querySelector('.conf-status').textContent,qualifier:e.classList.contains('conf-qualifier')}));
 return {dom,rows,names:rows.map(r=>r.name),preview:w.document.querySelector('.conf-champ-preview')?.textContent||'',state};
}
// Fill target records around real head-to-head results. Anonymous opponents are
// outside the displayed conference, so they cannot accidentally break ties.
function render(t,records,conf='American',headToHead=[]){
 const games=[...headToHead];
 for(const [name,cw,cl,wins=cw,losses=cl] of records){
  let usedW=0,usedL=0;
  for(const g of headToHead){
   if(g.status!=='completed')continue;
   if(g.team_name===name)(g.points_for>g.points_against?usedW++:usedL++);
   if(g.opponent_team===name)(g.points_against>g.points_for?usedW++:usedL++);
  }
  const add=(count,won,conference)=>{for(let i=0;i<count;i++)games.push(game(name,name+' opponent '+games.length,{id:'fixture-'+games.length,team_conference:conf,opponent_conference:'Other',is_conference_game:conference,points_for:won?21:7,points_against:won?7:21}));};
  assert.ok(cw>=usedW&&cl>=usedL&&wins>=cw&&losses>=cl,'valid record fixture');
  add(cw-usedW,true,true);add(cl-usedL,false,true);add(wins-cw,true,false);add(losses-cl,false,false);
  if(!wins&&!losses)games.push(game(name,name+' upcoming',{team_conference:conf,opponent_conference:'Other',status:'scheduled',points_for:null,points_against:null}));
 }
 return renderState(t,{scheduleGames:games,programs:records.map(([name])=>({team_id:name,team_name:name,conference:conf})),standings:[]});
}
test('American orders by conference percentage, preserving recorded W-L',t=>{
 const records=[['Army',6,0,9,0],['Memphis',6,1,9,1],['UConn',7,1,9,2],['Charlotte',5,1,8,2],['UAB',5,2,8,3],['East Carolina',4,2,5,5],['North Texas',3,3,5,5],['Tulane',3,3,4,6],['Florida Atlantic',3,3,3,7],['Temple',3,4,5,6],['UTSA',2,5,5,6],['South Florida',1,5,1,9]];
 const r=render(t,[...records].reverse());
 assert.deepEqual(r.names,['Army','UConn','Memphis','Charlotte','UAB','East Carolina','Florida Atlantic','North Texas','Tulane','Temple','UTSA','South Florida']);
 for(const [name,cw,cl,w,l] of records){const row=r.rows.find(x=>x.name===name);assert.equal(row.record,cw+'-'+cl);assert.equal(row.overall,w+'-'+l);}
 assert.equal(r.rows.find(x=>x.name==='UConn').metric,'0.875');
 assert.equal(r.rows.find(x=>x.name==='Memphis').metric,'0.857');
 assert.match(r.preview,/CONFERENCE REVIEW REQUIRED/);
});
test('loss count cannot outrank a higher conference percentage',t=>{
 assert.deepEqual(render(t,[['Fewer losses',1,1,4,1],['Higher percentage',6,2,6,5]]).names,['Higher percentage','Fewer losses']);
});
test('equivalent percentages share a rank regardless of wins, overall record or PD',t=>{
 const r=render(t,[['Zulu',2,0,8,0],['Alpha',1,0,1,7],['Bravo',3,0,9,0]]);
 assert.deepEqual(r.rows.map(x=>x.position),['T1','T1','T1']);assert.deepEqual(r.names,['Alpha','Bravo','Zulu']);
 assert.ok(r.rows.every(x=>!x.qualifier));assert.match(r.preview,/TIEBREAK PENDING/);assert.doesNotMatch(r.preview,/ vs /);
});
test('two-team head-to-head overrides overall record at equal conference percentage',t=>{
 const r=render(t,[['Alpha',3,1,9,1],['Zulu',3,1,3,6]],'American',[game('Zulu','Alpha')]);
 assert.deepEqual(r.names,['Zulu','Alpha']);assert.deepEqual(r.rows.map(x=>x.position),['1','2']);assert.match(r.preview,/CURRENT TOP TWO/);
});
test('head-to-head does not override different percentages in the current table',t=>{
 assert.deepEqual(render(t,[['Alpha',6,1],['Zulu',5,2]],'American',[game('Zulu','Alpha')]).names,['Alpha','Zulu']);
});
test('complete mini round-robin is resolved as a group',t=>{
 const r=render(t,[['Alpha',4,2],['Bravo',4,2],['Zulu',4,2]],'American',[game('Zulu','Alpha'),game('Zulu','Bravo'),game('Bravo','Alpha')]);
 assert.deepEqual(r.names,['Zulu','Bravo','Alpha']);assert.deepEqual(r.rows.map(x=>x.position),['1','2','3']);
});
test('circular head-to-head stays tied regardless of input order',t=>{
 const games=[game('Alpha','Bravo'),game('Bravo','Zulu'),game('Zulu','Alpha')];
 for(const records of [[['Alpha',3,1],['Bravo',3,1],['Zulu',3,1]],[['Zulu',3,1],['Bravo',3,1],['Alpha',3,1]]]){
  const r=render(t,records,'American',games);
  assert.deepEqual(r.rows.map(x=>x.position),['T1','T1','T1']);assert.match(r.preview,/TIEBREAK PENDING/);assert.equal(r.rows.filter(x=>x.qualifier).length,0);
 }
});
test('incomplete mini round-robin stays tied without a sweep',t=>{
 const r=render(t,[['Alpha',3,1],['Bravo',3,1],['Zulu',3,1]],'American',[game('Zulu','Alpha')]);
 assert.deepEqual(r.rows.map(x=>x.position),['T1','T1','T1']);
});
test('a sweep resolves first but an unplayed second-place tie stays unresolved',t=>{
 const r=render(t,[['Alpha',3,1],['Bravo',3,1],['Zulu',3,1]],'American',[game('Zulu','Alpha'),game('Zulu','Bravo')]);
 assert.deepEqual(r.names,['Zulu','Alpha','Bravo']);assert.deepEqual(r.rows.map(x=>x.position),['1','T2','T2']);
 assert.deepEqual(r.rows.filter(x=>x.qualifier).map(x=>x.name),['Zulu']);assert.match(r.preview,/TIEBREAK PENDING/);
});
test('two tied first-place teams remain current contenders without a host assignment',t=>{
 const r=render(t,[['Zulu',2,0],['Alpha',2,0],['Bravo',1,1]]);
 assert.deepEqual(r.rows.map(x=>x.position),['T1','T1','3']);assert.match(r.preview,/CURRENT TOP TWO/);
 assert.match(r.preview,/host are not yet determined/);assert.equal(r.rows.filter(x=>x.qualifier).length,2);
});
test('0-0 teams have no percentage or seed and stay below played teams',t=>{
 const r=render(t,[['Idle',0,0,5,0],['Losing',0,2,0,2],['Leader',1,0,1,0]]);
 assert.deepEqual(r.names,['Leader','Losing','Idle']);assert.equal(r.rows[2].position,'—');assert.equal(r.rows[2].metric,'—');assert.equal(r.rows[2].status,'AWAITING CONF');
});
test('an unplayed conference does not project two teams',t=>{
 const r=render(t,[['Idle',0,0,1,0],['Waiting',0,0,2,0]]);
 assert.match(r.preview,/RACE DEVELOPING/);assert.ok(r.rows.every(x=>!x.qualifier&&x.position==='—'));
});
test('missing CFP/computer inputs cannot fall through to overall W-L',t=>{
 const r=render(t,[['Leader',4,0],['Zulu',3,1,9,1],['Alpha',3,1,3,5]]);
 assert.deepEqual(r.rows.map(x=>x.position),['1','T2','T2']);assert.match(r.preview,/TIEBREAK PENDING/);
});
test('postseason results and schedules do not affect conference W-L or games left',t=>{
 for(const type of ['conference_championship','bowl','playoff','national_championship']){
  const games=[game('Alpha','Zulu'),game('Zulu','Alpha',{id:type,game_type:type,is_conference_game:true}),game('Alpha','Zulu',{id:'future',game_type:type,status:'scheduled'})];
  const r=renderState(t,{scheduleGames:games,programs:[{team_id:'Alpha',team_name:'Alpha',conference:'American'}]});
  assert.deepEqual(r.rows.map(x=>x.record),['1-0','0-1']);assert.deepEqual(r.rows.map(x=>x.overall),['1-1','1-1']);
  assert.ok([...r.dom.window.document.querySelectorAll('.conf-row')].every(e=>e.querySelectorAll('.conf-rem')[1].textContent==='0'));
 }
});
test('duplicate schedule entries count once and fallback game ledger works',t=>{
 const g=game('Alpha','Zulu');
 for(const state of [{scheduleGames:[g,g],games:[]},{scheduleGames:[],games:[g,g]}]){
  const r=renderState(t,{...state,programs:[{team_id:'Alpha',team_name:'Alpha',conference:'American'}]});assert.deepEqual(r.rows.map(x=>x.record),['1-0','0-1']);
 }
});
test('authoritative coach overall records remain intact',t=>{
 const r=renderState(t,{scheduleGames:[game('Alpha','Zulu')],programs:[{team_id:'Alpha',team_name:'Alpha',conference:'American'}],standings:[{team_id:'Alpha',wins:5,losses:1,point_differential:99}]});
 assert.equal(r.rows[0].overall,'5-1');assert.equal(r.rows[0].record,'1-0');
});
test('all American conference aliases use the corrected standings',t=>{
 for(const conf of ['American','American Conference','American Athletic','American Athletic Conference'])assert.deepEqual(render(t,[['Memphis',6,1,9,1],['UConn',7,1,9,2]],conf).names,['UConn','Memphis']);
});
test('other conference ordering and Sun Belt divisions are preserved',t=>{
 const r=render(t,[['Memphis',6,1,9,1],['UConn',7,1,9,2]],'ACC');
 assert.deepEqual(r.names,['UConn','Memphis']);assert.match(r.preview,/PROJECTED CHAMPIONSHIP MATCHUP/);
 const sb=render(t,[['James Madison',4,0],['Marshall',3,1],['Troy',3,1],['Louisiana',2,2]],'Sun Belt');
 const text=sb.dom.window.document.body.textContent;assert.match(text,/East Division/);assert.match(text,/West Division/);assert.match(text,/EAST vs WEST/);
});
