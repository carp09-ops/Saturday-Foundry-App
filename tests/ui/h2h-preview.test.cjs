const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM,ResourceLoader}=require('jsdom');const root=path.resolve(__dirname,'../..');
class Local extends ResourceLoader{fetch(url){const p=url.split('/assets/')[1]?.split('?')[0];if(p?.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,'assets',p)));return null;}}
test('isolated QA page runs enter, opponent validation and dispute resolution',async t=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,'h2h-qa.html'),'utf8'),{runScripts:'dangerously',resources:new Local(),url:'https://preview.test/h2h-qa.html'});t.after(()=>dom.window.close());await new Promise(r=>dom.window.addEventListener('load',r,{once:true}));const doc=dom.window.document;
 const role=x=>{doc.getElementById('viewer').value=x;doc.getElementById('viewer').dispatchEvent(new dom.window.Event('change'));};
 doc.getElementById('home').value='28';doc.getElementById('away').value='21';doc.querySelector('[data-action="submit"]').click();assert.match(doc.getElementById('card').textContent,/Awaiting Pete/);assert.equal(doc.querySelector('[data-action="confirm"]'),null);
 role('pete');doc.querySelector('[data-action="confirm"]').click();assert.match(doc.getElementById('card').textContent,/Confirmed by both/);
 doc.getElementById('reset').click();doc.getElementById('home').value='0';doc.getElementById('away').value='7';doc.querySelector('[data-action="submit"]').click();role('corey');doc.getElementById('note').value='It should be 0–14';doc.querySelector('[data-action="flag"]').click();assert.match(doc.getElementById('card').textContent,/Commissioner review required/);role('commish');doc.getElementById('away').value='14';doc.getElementById('note').value='Screenshot reviewed';doc.querySelector('[data-action="resolve"]').click();assert.match(doc.getElementById('card').textContent,/0–14/);assert.match(doc.getElementById('card').textContent,/Commissioner resolved/);
});
test('real app cards decorate both users and block H2H writes until backend readiness',async t=>{
 const dom=new JSDOM('<div id="myWeekPanel"></div><div id="admin"></div>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;
 const game={id:'shared',team_id:'u',team_name:'UConn',opponent_team_id:'m',opponent_team:'Memphis',status:'scheduled'};
 const state={programs:[{team_id:'u',person_id:'corey',coach_name:'Corey'},{team_id:'m',person_id:'pete',coach_name:'Pete'}],games:[game],myPrograms:[{season_id:'s',person_id:'corey'}]};let writes=0;
 w.CDHQ_RUNTIME={getState:()=>state,getSeason:()=>({season_id:'s'}),getDynasty:()=>({role:'member'}),session:()=>({access_token:'fixture'}),req:async()=>{throw Error('No preview backend');},Data:{games:async()=>[game],scheduleGames:async()=>[game],submitResult:async()=>writes++,editGame:async()=>writes++}};w.gameDayCard=()=>'<div class="gd-card"></div>';
 w.eval(fs.readFileSync(path.join(root,'assets/scorecard-identity.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(root,'assets/h2h-games.js'),'utf8'));assert.match(w.gameDayCard(game),/User vs user/);assert.match(w.gameDayCard(game),/Corey vs Pete/);assert.match(w.gameDayCard(game),/Try the demo/);await assert.rejects(w.CDHQ_RUNTIME.Data.submitResult('shared',{}),/preview-only/);await assert.rejects(w.CDHQ_RUNTIME.Data.editGame({p_game_id:'shared'}),/commissioner/);assert.equal(writes,0);
 const data=await w.CDHQ_RUNTIME.Data.games('d','s');assert.equal(data[0].h2h_ready,false);
});
