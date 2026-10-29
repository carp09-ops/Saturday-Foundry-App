const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test');
const {JSDOM,ResourceLoader,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname,'../..');
class LocalResources extends ResourceLoader{
 fetch(url){const relative=url.split('/assets/')[1]?.split('?')[0];if(relative&&relative.endsWith('.js'))return Promise.resolve(fs.readFileSync(path.join(root,'assets',relative)));return null;}
}
async function createApp(query='embedded=1&dynasty=d-a&season=d-a-old&view=analytics'){
 const errors=[],virtualConsole=new VirtualConsole();
 virtualConsole.on('jsdomError',error=>{if(!/CSS stylesheet|Not implemented/.test(error.message))errors.push(error.message);});
 virtualConsole.on('error',(...args)=>errors.push(args.map(a=>a?.message||String(a)).join(' ').slice(0,220)));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'league-tools.html'),'utf8'),{url:'https://foundry.test/league-tools.html?'+query,runScripts:'dangerously',resources:new LocalResources(),pretendToBeVisual:true,virtualConsole,beforeParse(w){
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
 window.fixtureDynasties=[{dynasty_id:'d-a',name:'League A',short_name:'A',game_edition:'27',is_commissioner:true,role:'commissioner'},{dynasty_id:'d-b',name:'League B',short_name:'B',game_edition:'27',is_commissioner:true,role:'commissioner'}];
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
test('real embedded application selects the requested league and archived season',async t=>{
 const {dom,w,errors}=await createApp();t.after(()=>w.close());
 await w.loadDynastyById('d-a');
 for(let i=0;i<30&&!w.document.documentElement.classList.contains('sf-tools-ready');i++)await tick(w);
 assert(w.document.documentElement.classList.contains('sf-tools-ready'));
 assert.equal(w.eval('D.dynasty_id'),'d-a');assert.equal(w.eval('S.season_id'),'d-a-old');
 assert(!w.document.querySelector('#sfEmbeddedStatus'));
 for(const view of ['analytics','vegas','storylines','rivalries','records','recap','legacy','schedule']){w.switchView(view);await tick(w);assert.equal(w.document.querySelector('.view.active')?.id,view);}
 assert.deepEqual(errors,[]);
});

test('commissioner rollover requires every active coach to choose a unique program',async t=>{
 const {w,errors}=await createApp('embedded=1&dynasty=d-a&season=d-a-current&view=admin&focus=season');t.after(()=>w.close());
 const scrolls=[];w.HTMLElement.prototype.scrollIntoView=function(){scrolls.push(this)};
 const oldWrites=[],rpcWrites=[];
 w.CDHQ_RUNTIME.Data.nextSeason=async(...args)=>{oldWrites.push(args);throw Error('Legacy rollover must never run');};
 w.CDHQ_RUNTIME.Data.dynastyCoaches=async()=>[
  {person_id:'corey',coach_name:'Corey',current_season_id:'d-a-current',current_team_id:'texas',current_team_name:'Texas State'},
  {person_id:'saif',coach_name:'Saif',current_season_id:'d-a-current',current_team_id:'marshall',current_team_name:'Marshall'},
  {person_id:'retired',coach_name:'Retired coach',current_season_id:'d-a-old',current_team_id:'uconn',current_team_name:'UConn'}
 ];
 w.CDHQ_RUNTIME.Data.teamSelection=async()=>[
  {team_id:'texas',team_name:'Texas State',claimed:true,claimed_by:'Corey'},
  {team_id:'marshall',team_name:'Marshall',claimed:true,claimed_by:'Saif'},
  {team_id:'florida',team_name:'Florida',claimed:false},
  {team_id:'wvu',team_name:'West Virginia',claimed:false}
 ];
 w.fetch=async(url,opts)=>{
  if(String(url).includes('/rpc/create_next_season_with_programs')){
    rpcWrites.push(JSON.parse(opts.body));return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify('new-season')};
  }
  throw Error('Unexpected network request: '+url);
 };
 await w.loadDynastyById('d-a');
 for(let i=0;i<30&&!w.document.documentElement.classList.contains('sf-tools-ready');i++)await tick(w);
 assert.equal(w.document.querySelector('.view.active')?.id,'admin');
 assert(scrolls.includes(w.document.querySelector('#newSeasonBtn').closest('.admin-card')));
 const button=w.document.querySelector('#newSeasonBtn');
 assert.match(button.textContent,/Choose next-season teams/);
 assert(w.document.querySelector('#carryPrograms').closest('label').classList.contains('hidden'));
 button.click();for(let i=0;i<20&&!w.document.querySelector('#sfProgramRollover');i++)await tick(w);
 const panel=w.document.querySelector('#sfProgramRollover');
 assert(panel,'Coach selection panel should open');
 const selects=[...panel.querySelectorAll('select')];
 assert.equal(selects.length,2,'historical/retired coach must not be selected');
 const submit=[...panel.querySelectorAll('button')].find(b=>/Review and start season/.test(b.textContent));
 submit.click();await tick(w);assert.equal(rpcWrites.length,0,'missing choices block submission');
 selects[0].value='florida';selects[1].value='florida';
 submit.click();await tick(w);assert.equal(rpcWrites.length,0,'duplicate selections block submission');
 selects[1].value='wvu';
 w.confirm=()=>true;submit.click();
 for(let i=0;i<30&&!rpcWrites.length;i++)await tick(w);
 assert.equal(oldWrites.length,0,'legacy auto-carry handler must never run');
 assert.equal(rpcWrites.length,1);
 assert.equal(rpcWrites[0].p_dynasty_id,'d-a');
 assert.equal(rpcWrites[0].p_expected_season_id,'d-a-current');
 assert.deepEqual(rpcWrites[0].p_assignments,[
   {person_id:'corey',team_id:'florida',confirmed:true},
   {person_id:'saif',team_id:'wvu',confirmed:true}
 ]);
 assert.deepEqual(errors,[]);
});

test('program shortcut focuses the existing coach selector without changing an assignment',async t=>{
 const {w,errors}=await createApp('embedded=1&dynasty=d-a&season=d-a-current&view=admin&focus=program');t.after(()=>w.close());
 w.CDHQ_RUNTIME.Data.games=async()=>[];w.CDHQ_RUNTIME.Data.scheduleGames=async()=>[];
 const calls=[];w.CDHQ_RUNTIME.Data.changeCoachProgram=async(...args)=>calls.push(args);
 await w.loadDynastyById('d-a');
 for(let i=0;i<30&&!w.document.documentElement.classList.contains('sf-tools-ready');i++)await tick(w);
 assert.equal(w.document.querySelector('.view.active')?.id,'admin');
 assert.equal(w.document.activeElement?.id,'careerMoveCoach');assert.equal(calls.length,0);
 assert.deepEqual(errors,[]);
});
