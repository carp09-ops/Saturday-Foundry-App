const {test}=require('node:test'),assert=require('node:assert/strict');
const engine=require('../assets/chronicle-engine.js');
const coach={person_id:'j',coach_name:'Jared',team_name:'Georgia Tech'};
const game=(sn,week,result='W',extra={})=>({id:`s${sn}w${week}`,dynasty_id:'league',person_id:'j',coach_name:'Jared',season_number:sn,week_number:week,team_name:sn===1?'Kennesaw':'Georgia Tech',opponent_team:'Army',status:'completed',result,points_for:result==='W'?28:14,points_against:result==='W'?14:28,...extra});
const build=extra=>engine.build({dynasty:'league',edition:'27',season:2,coaches:[coach],games:[],...extra});
test('new program and prior season use recorded career stops before historical games arrive',()=>{
 const x=build({games:[game(2,0)],stops:[{person_id:'j',season_number:1,team_name:'Kennesaw',wins:4,losses:8},{person_id:'j',season_number:2,team_name:'Georgia Tech'}]});
 assert.equal(x.profiles[0].from,'Kennesaw');assert.equal(x.profiles[0].tenure,1);assert.match(x.chapters.find(x=>x.kind==='move').fact,/4-8 at Kennesaw/);
});
test('another league is never treated as an earlier season or an opponent history',()=>{
 const x=build({games:[game(1,0,'L',{dynasty_id:'other'}),game(2,0)],stops:[{person_id:'j',season_number:1,team_name:'Wrong school',wins:15,losses:0,dynasty_id:'other'}]});
 assert.equal(x.profiles[0].previous,null);assert(!x.chapters.some(x=>x.kind==='move'||x.kind.startsWith('revenge')));
});
test('routine wins are condensed and adding later results cannot rewrite earlier episodes',()=>{
 const games=[0,1,2,3].map(w=>game(2,w));const old=build({games});
 assert.equal(old.chapters.filter(x=>x.game).length,1);
 const next=build({games:[...games,game(2,4,'L')]});
 assert.deepEqual(next.chapters.find(x=>x.kind==='first-answer'),old.chapters.find(x=>x.kind==='first-answer'));
 assert.equal(next.chapters.filter(x=>x.kind==='first-loss').length,1);
});
test('revenge follows the opposing person through a school change, and ignores future meetings',()=>{
 const x=build({games:[game(1,2,'L',{opponent_person_id:'p',opponent_team:'NDSU'}),game(2,0,'W',{opponent_person_id:'p',opponent_team:'Army'}),game(2,9,'L',{opponent_person_id:'p'})]});
 const revenge=x.chapters.find(x=>x.kind==='revenge-p');assert(revenge);assert.match(revenge.scene,/1 earlier defeat/);assert.equal(revenge.week,0);
});
test('tenure resets on return to a former school and improvement compares the preceding year',()=>{
 const x=build({games:[game(2,0,'W',{team_name:'Kennesaw'}),game(2,1,'W',{team_name:'Kennesaw'})],stops:[{person_id:'j',season_number:0,team_name:'Kennesaw'},{person_id:'j',season_number:1,team_name:'Army',wins:1,losses:11}]});
 assert.equal(x.profiles[0].tenure,1);assert.equal(x.profiles[0].from,'Army');assert(x.chapters.some(x=>x.kind==='progress'));
});
test('historical episodes retain their old program and postseason links point to earned hardware',()=>{
 const x=build({games:[game(2,0,'W',{game_type:'national_championship',event_name:'National Championship'})]});
 assert.equal(x.chapters.find(x=>x.game).link,'hardware');assert.equal(x.chapters.find(x=>x.game).importance,100);
});
