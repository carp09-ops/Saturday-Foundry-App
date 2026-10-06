const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..');
class LocalResources extends ResourceLoader{
 fetch(url){const relative=url.split('/assets/')[1]?.split('?')[0];if(relative&&relative.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,'assets',relative)));return null;}
}
async function createApp(){
 const errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',error=>{if(!/CSS stylesheet|Not implemented/.test(error.message))errors.push(error.message);});
 virtualConsole.on('error',(...args)=>errors.push(args.map(a=>a?.message||String(a)).join(' ').slice(0,220)));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://foundry.test/index.html',runScripts:'dangerously',resources:new LocalResources(),pretendToBeVisual:true,virtualConsole,beforeParse(w){
  w.matchMedia=query=>({matches:false,media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollBy=()=>{};w.CSS={escape:value=>String(value)};
  w.ResizeObserver=class{observe(){}disconnect(){}};w.WebSocket=class{constructor(){this.readyState=0;}close(){}send(){}};
  w.fetch=async()=>{throw Error('Unexpected network request in fixture test');};
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({canvas:{}},{get:(object,key)=>object[key]||(()=>{})});
 }});
 await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));
 const w=dom.window;
 w.Chart=class{static defaults={font:{}};constructor(){this.destroy=()=>{};this.update=()=>{};this.resize=()=>{};}};
 w.eval(`
 window.sfActiveGameEdition=2027;
 window.fixtureDynasties=[{dynasty_id:'d-a',name:'League A',short_name:'A',game_edition:'27',is_commissioner:true},{dynasty_id:'d-b',name:'League B',short_name:'B',game_edition:'27',is_commissioner:true}];
 window.fixtureSeasons=d=>[{season_id:d+'-current',season_number:2,year:2027,status:'active',is_active:true},{season_id:d+'-old',season_number:1,year:2026,status:'completed',is_active:false}];
 window.fixtureGame=(d,s)=>({id:d+'-'+s,dynasty_id:d,season_id:s,season_number:s.endsWith('old')?1:2,week_number:0,team_id:'texas',team_name:'Texas State',team_abbreviation:'TXST',person_id:'coach',coach_name:'Corey',opponent_team:'Ohio State',opponent_team_id:'ohio',home_away:'home',status:'completed',result:'W',points_for:24,points_against:14,is_bye:false,game_type:'regular'});
 for(const key of Object.keys(Data))if(typeof Data[key]==='function')Data[key]=async()=>[];
 Data.dynasties=async()=>window.fixtureDynasties;
 Data.seasons=async d=>window.fixtureSeasons(d);
 Data.games=async(d,s)=>[window.fixtureGame(d,s)];Data.scheduleGames=Data.games;
 Data.myPrograms=async d=>window.fixtureSeasons(d).map(s=>({season_id:s.season_id,person_id:'coach',team_id:'texas',team_name:'Texas State'}));
 Data.programs=async(d,s)=>[{id:'program',program_id:'program',person_id:'coach',coach_name:'Corey',season_id:s,team_id:'texas',team_name:'Texas State',conference:'Sun Belt',wins:1,losses:0}];
 Data.standings=Data.programs;Data.activeWeek=async()=>0;
 Data.career=async()=>[{person_id:'coach',coach_name:'Corey',wins:1,losses:0}];
 Data.careerHub=async()=>({coach:{name:'Corey'},totals:{wins:1,losses:0},chapters:[],editions:[],timeline:[],honors:[],facts:[]});
 save({access_token:'fixture-token',refresh_token:'fixture-refresh',user:{id:'fixture-user'}});
 dynasties=window.fixtureDynasties;
 `);
 return {dom,w,errors};
}
const tick=w=>new Promise(resolve=>w.setTimeout(resolve,25));
test('full-app navigation and async failure regressions',async t=>{
 const {dom,w,errors}=await createApp();t.after(()=>dom.window.close());
 await t.test('all static element IDs are unique and startup is clean',()=>{
  const ids=[...w.document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);assert.deepEqual(errors,[]);
 });
 await t.test('all 11 views render and navigate with week zero preserved',async()=>{
  await w.eval('loadDynasty(0)');await tick(w);
  assert.equal(w.eval('state.activeWeek'),0);
  for(const view of [...w.document.querySelectorAll('.view')]){
   w.switchView(view.id);await tick(w);
   assert.equal(w.document.querySelectorAll('.view.active').length,1);assert.equal(w.document.querySelector('.view.active').id,view.id);
   const button=w.document.querySelector('#nav [data-view="'+view.id+'"]');if(button)assert.equal(button.getAttribute('aria-current'),'page');
  }
  assert.deepEqual(errors,[]);
 });
 await t.test('Dynasty Book routes every chapter through the existing views and keeps week zero',async()=>{
  w.eval('loadDynasty(0)');await tick(w);
  w.eval("D.role='commissioner';renderCommissioner()");
  const views=[...w.document.querySelectorAll('#hqMobileNav [data-mobile-view]')].map(b=>b.dataset.mobileView);
  assert.deepEqual(views,['overview','schedule','analytics','legacy']);
  w.CDHQOpenMobileMore();
  assert.equal(w.document.getElementById('hqMoreTitle').textContent,'Dynasty Book');
  const chapters=[...w.document.querySelectorAll('#hqMobileMoreGrid [data-sf-chapter]')];
  assert.equal(chapters[0].dataset.sfChapter,'conference');
  assert(chapters.some(b=>b.dataset.sfChapter==='recap'));
  for(const key of ['conference','storylines','rivalries','hardware','records','vegas','admin','recap']){
   w.CDHQOpenMobileMore();w.document.querySelector('#hqMobileMoreGrid [data-sf-chapter="'+key+'"]').click();await tick(w);
   assert.equal(w.document.querySelector('.view.active').id,key==='hardware'?'legacy':key);
   assert.equal(w.document.getElementById('hqMobileMoreSheet').getAttribute('aria-hidden'),'true');
   assert.equal(w.eval('state.activeWeek'),0);assert.equal(w.eval('S.season_number'),2);
  }
  assert.equal(w.document.getElementById('paneTrophyCase').hidden,false);
  w.eval("D.role='member';renderCommissioner()");w.CDHQOpenMobileMore();
  assert.equal(w.document.querySelector('#hqMobileMoreGrid [data-sf-chapter="admin"]'),null);w.CDHQCloseMobileMore();
  assert.deepEqual(errors,[]);
 });
 await t.test('Overview episode opens its person and season, then remembers reading across refresh',async()=>{
  w.eval(`state.coachMoves=[{person_id:'coach',coach_name:'Corey',season_number:2,from_team_name:'Army',to_team_name:'Texas State'}];renderAll();`);
  const preview=w.document.querySelector('#sfChroniclePreview [data-sf-episode]');assert(preview);
  preview.click();await tick(w);
  assert.equal(w.document.querySelector('.view.active').id,'storylines');assert.equal(w.eval('storyCoachFilter'),'coach');assert.equal(w.document.getElementById('storySeasonSelect').value,'2');
  w.eval('renderAll()');assert.equal(w.document.querySelector('#sfChroniclePreview').textContent.includes('UNREAD'),false);
  assert.equal(w.document.querySelectorAll('#sfDynastyDiscovery').length,1);
  w.eval('state.coachMoves=[]');
 });
 await t.test('removed overview and race summaries stay absent after rendering',()=>{
  w.eval('renderAll()');
  assert.equal(w.document.getElementById('hqNewsDesk'),null);
  assert.equal(w.document.getElementById('confRaceSummary'),null);
  assert(w.document.getElementById('confRaceSelect'));assert(w.document.getElementById('confRaceBoards'));
  assert.match(w.document.querySelector('#nav [data-view="storylines"]').textContent,/Coach Chronicles/);
 });
 await t.test('Intelligence excludes phantom coaches and keeps real historical members',()=>{
  w.eval(`window.savedIntelState=state;state={...state,
   career:[{person_id:'corey',coach_name:'Corey'},{person_id:'retired',coach_name:'Pete'},{person_id:'ghost',coach_name:'Coach'}],
   programs:[{person_id:'corey',coach_name:'Coach',team_name:'Texas State'},{person_id:'unknown',coach_name:'Unknown',team_name:'CPU team'}],
   dynastyCoaches:[{person_id:'jared',coach_name:'Jared',current_team_name:'Georgia Tech'}],
   games:[{person_id:'ghost',coach_name:'Coach'},{person_id:'unlinked',coach_name:'Coach'},{person_id:'unknown'},{person_id:'corey',team_name:'Texas State'},{person_id:'retired',team_name:'NDSU'},{person_id:'jared',team_name:'Georgia Tech'}]};`);
  try{
   const coaches=JSON.parse(JSON.stringify(w.sfChartCoaches()));assert.deepEqual(coaches.map(c=>c.name),['Corey','Pete','Jared']);
   assert.equal(coaches[0].team,'Texas State');assert.equal(coaches[2].team,'Georgia Tech');
   assert.deepEqual(JSON.parse(w.eval('JSON.stringify(legacyCareer().map(c=>c.coach_name))')),['Corey','Pete']);
   for(const name of ['Coach','UNKNOWN','CPU','Unassigned','Apple Review',''])assert.equal(w.sfIsNamedDynastyCoach({person_id:'placeholder',coach_name:name}),false);
  }finally{w.eval('state=window.savedIntelState;delete window.savedIntelState');}
 });
 await t.test('local runtime styles, fonts and chart dependency are complete',()=>{
  for(const element of w.document.querySelectorAll('script[src],link[rel="stylesheet"][href]')){
   const value=element.getAttribute('src')||element.getAttribute('href');if(value.startsWith('assets/'))assert(fs.existsSync(path.join(root,value.split('?')[0])),value);
  }
  const fonts=fs.readFileSync(path.join(root,'assets/foundry-fonts.css'),'utf8');
  for(const match of fonts.matchAll(/url\('([^']+)'\)/g))assert(fs.existsSync(path.join(root,'assets',match[1])));
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(!/fonts\.googleapis|cdn\.tailwindcss|cdn\.jsdelivr.*chart|\bTeko\b|\bOswald\b/.test(html));
 });
 await t.test('missing market numbers remain unknown rather than zero or 100 percent',()=>{
  const missing=w.eval("vegasPerspective({spread_home:null,home_win_probability:null,home_away:'away'})");assert.equal(missing.teamSpread,null);assert.equal(missing.teamWinProbability,null);
  const zero=w.eval("vegasPerspective({spread_home:0,home_win_probability:0,home_away:'home'})");assert.equal(zero.teamSpread,0);assert.equal(zero.teamWinProbability,0);
 });
 await t.test('post-save recap updates its own subtitle',()=>{
  const original=w.document.getElementById('recapSubtitle').textContent;
  w.eval("showScoreRecap('fixture-game',24,14,{team_name:'Texas State',opponent_team:'Ohio State',week_number:0,home_away:'home'})");
  assert.match(w.document.getElementById('resultRecapSubtitle').textContent,/Week 0/);assert.equal(w.document.getElementById('recapSubtitle').textContent,original);
  w.document.getElementById('resultRecapModal').classList.add('hidden');
 });
 await t.test('blank scores do not submit as zero',async()=>{
  let saves=0;w.CDHQ_RUNTIME.Data.submitResult=async()=>{saves++;};
  w.eval("selectedGame=window.fixtureGame('d-a','d-a-current')");
  w.document.getElementById('myScore').value='';w.document.getElementById('oppScore').value='21';
  await w.eval('submitSelectedResult()');assert.equal(saves,0);assert.match(w.document.getElementById('resultMessage').textContent,/both final scores/);
 });
 await t.test('failed season load restores selection and releases loading',async()=>{
  const previous=w.eval('S.season_id'),original=w.CDHQ_RUNTIME.Data.standings;
  w.CDHQ_RUNTIME.Data.standings=async()=>{throw Error('Fixture network failure');};
  await assert.rejects(w.eval("loadSeason('d-a-old')"),/Fixture network failure/);
  assert.equal(w.eval('S.season_id'),previous);assert.equal(w.document.getElementById('seasonSelect').value,previous);assert.equal(w.CDHQLoader.depth,0);
  w.CDHQ_RUNTIME.Data.standings=original;
 });
 await t.test('a slower old season response cannot overwrite a later selection',async()=>{
  const original=w.CDHQ_RUNTIME.Data.games;let release;
  w.CDHQ_RUNTIME.Data.games=(d,s)=>s.endsWith('old')?new Promise(resolve=>release=()=>resolve([w.fixtureGame(d,s)])):original(d,s);
  const older=w.eval("loadSeason('d-a-old')");const latest=w.eval("loadSeason('d-a-current')");await latest;release();await older;
  assert.equal(w.eval('S.season_id'),'d-a-current');assert.equal(w.eval('state.games[0].season_id'),'d-a-current');assert.equal(w.CDHQLoader.depth,0);
  w.CDHQ_RUNTIME.Data.games=original;
 });
 await t.test('historical league enrichment cannot cross a dynasty switch',async()=>{
  const original=w.CDHQ_RUNTIME.Data.games;let release;
  w.CDHQ_RUNTIME.Data.games=(d,s)=>d==='d-a'&&s.endsWith('old')?new Promise(resolve=>release=()=>resolve([w.fixtureGame(d,s)])):original(d,s);
  await w.eval('loadDynasty(0)');await w.eval('loadDynasty(1)');release();await tick(w);
  assert.equal(w.eval('D.dynasty_id'),'d-b');assert(w.eval("state.allGames.every(g=>g.dynasty_id==='d-b')"));assert.equal(w.CDHQLoader.depth,0);
  w.CDHQ_RUNTIME.Data.games=original;
 });
 await t.test('failed dynasty entry returns to selector and releases loader',async()=>{
  const original=w.CDHQ_RUNTIME.Data.seasons;w.CDHQ_RUNTIME.Data.seasons=async()=>{throw Error('Fixture league failure');};
  await assert.rejects(w.eval('loadDynasty(0)'),/Fixture league failure/);
  assert(w.document.body.classList.contains('dynasty-chooser-active'));assert.equal(w.CDHQLoader.depth,0);
  w.CDHQ_RUNTIME.Data.seasons=original;
 });
 await t.test('refresh works on the dynasty selector',async()=>{
  await w.CDHQRefresh();assert(w.document.body.classList.contains('dynasty-chooser-active'));assert.equal(w.CDHQLoader.depth,0);
 });
 await t.test('failed refresh retains visible data and reports sync error',async()=>{
  await w.eval('loadDynasty(1)');const original=w.CDHQ_RUNTIME.Data.standings,previous=w.eval('JSON.stringify(state.games)');
  w.CDHQ_RUNTIME.Data.standings=async()=>{throw Error('Fixture refresh failure');};
  await w.CDHQRefresh();assert.equal(w.eval('JSON.stringify(state.games)'),previous);assert.equal(w.document.getElementById('syncStatus').dataset.refreshState,'error');assert.equal(w.CDHQLoader.depth,0);
  w.CDHQ_RUNTIME.Data.standings=original;
 });
 await t.test('refresh response is ignored after a league switch',async()=>{
  const original=w.CDHQ_RUNTIME.Data.standings;let release;
  w.CDHQ_RUNTIME.Data.standings=(d,s)=>d==='d-b'?new Promise(resolve=>release=()=>resolve([])):original(d,s);
  const refresh=w.CDHQRefresh();while(!release)await tick(w);
  await w.eval('loadDynasty(0)');release();await refresh;
  assert.equal(w.eval('D.dynasty_id'),'d-a');assert(w.eval("state.games.every(g=>g.dynasty_id==='d-a')"));assert.equal(w.CDHQLoader.depth,0);
  w.CDHQ_RUNTIME.Data.standings=original;
 });
 await t.test('dialog keyboard focus loops and restores after dismissal',async()=>{
  const opener=w.document.querySelector('#nav button[data-view="overview"]');opener.focus();
  const modal=w.document.getElementById('resultModal');modal.classList.remove('hidden');await tick(w);
  const items=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(e=>!e.closest('.hidden,[hidden]'));
  items.at(-1).focus();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(w.document.activeElement,items[0]);
  modal.classList.add('hidden');await tick(w);assert.equal(w.document.activeElement,opener);
 });
 await t.test('transient token refresh failures retain the existing session',async()=>{
  const previous=w.eval('session().refresh_token');w.fetch=async()=>{throw new w.TypeError('Fixture offline');};
  await assert.rejects(w.eval('refreshAuthSingleFlight()'),/Fixture offline/);assert.equal(w.eval('session().refresh_token'),previous);
 });
 await t.test('a definitively rejected refresh token clears only that session',async()=>{
  w.fetch=async()=>({ok:false,status:400,text:async()=>JSON.stringify({message:'Invalid refresh token'})});
  await assert.rejects(w.eval('refreshAuthSingleFlight()'),/session expired/);assert.equal(w.eval('session()'),null);
 });
 await t.test('offline notice appears and clears on reconnect',()=>{
  Object.defineProperty(w.navigator,'onLine',{value:false,configurable:true});w.dispatchEvent(new w.Event('offline'));assert(w.document.getElementById('sfConnectionNotice'));
  Object.defineProperty(w.navigator,'onLine',{value:true,configurable:true});w.dispatchEvent(new w.Event('online'));assert(!w.document.getElementById('sfConnectionNotice'));
 });
});
