'use strict';
/* Live alerts (app side): when the backend marks a coach live (v_coach_live
   rows in model.liveStatus), the app lights up — a LIVE badge on their Watch
   link, a chip on their game cards, and a 🔴 LIVE item leading THE LINE.
   With no live rows, nothing changes anywhere. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const league=fs.readFileSync('assets/graphite/league.js','utf8');
const start=league.indexOf('function safeStreamUrl(');
const src=league.slice(start,league.indexOf('const POST_TYPES',start));
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://x/'});
const w=dom.window;
w.eval(`
  var esc=s=>String(s), ico=()=>'[ico]';
  var route='home';
  var season={season_id:'s1',is_active:true};
  var model={coachStreams:[
    {person_id:'corey',coach_name:'Corey',current_season_id:'s1',current_team_id:'fla',stream_platform:'youtube',stream_url:'https://youtube.com/@corey'},
    {person_id:'jared',coach_name:'Jared',current_season_id:'s1',current_team_id:'gt',stream_platform:'twitch',stream_url:'https://twitch.tv/jared'}
  ],liveStatus:[{person_id:'corey',coach_name:'Corey',is_live:true,live_title:'Week 2 vs Cincinnati'}]};
  ${src}
`);
const game={awayId:'gt',homeId:'fla'};

test('watch link carries a LIVE badge only for the coach who is live',()=>{
  const out=w.homeGameStreams(game);
  assert.ok(out.includes('Watch Corey')&&out.includes('Watch Jared'),'both watch links render');
  assert.ok(out.includes('<span class="live-badge">LIVE</span>'),'live badge present');
  assert.equal((out.match(/live-badge/g)||[]).length,1,'exactly one badge — Jared is not live');
  assert.ok(out.includes('game-stream-link is-live'),'live link highlighted');
});

test('game card chip lights when either coach is live, and stays dark when nobody is',()=>{
  assert.ok(w.liveChip(game).includes('live-chip'),'chip renders for a live matchup');
  w.eval("model.liveStatus=[]");
  assert.equal(w.liveChip(game),'','no live rows, no chip');
  const out=w.homeGameStreams(game);
  assert.ok(!out.includes('live-badge'),'badges gone too');
});

test('ticker leads with the live item',()=>{
  const report=fs.readFileSync('assets/graphite/report.js','utf8');
  const t0=report.indexOf('function tickerItems(){');
  const tsrc=report.slice(t0,report.indexOf('\nfunction ',t0+10));
  const dom2=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
  const w2=dom2.window;
  w2.eval(`
    var esc=s=>String(s);
    var games=()=>[];
    var reportSelection=()=>({available:[],next:[]});
    var model={liveStatus:[{person_id:'corey',coach_name:'Corey',is_live:true,live_title:'Week 2 vs Cincinnati'}],programs:[],stops:[]};
    ${tsrc}
  `);
  const items=w2.tickerItems();
  assert.ok(items.length>=1&&items[0].k==='🔴 LIVE','live item is first in the rotation');
  assert.ok(items[0].t.includes('Corey')&&items[0].t.includes('Week 2 vs Cincinnati'),'names the coach and the stream title');
});

test('watch links show the platform app icon instead of the platform word',()=>{
  w.eval("model.liveStatus=[{person_id:'corey',coach_name:'Corey',is_live:true,live_title:'Week 2 vs Cincinnati'}]");
  const out=w.homeGameStreams(game);
  assert.ok(out.includes('platform-icon pi-youtube'),'youtube app icon renders');
  assert.ok(out.includes('platform-icon pi-twitch'),'twitch app icon renders');
  assert.ok(!out.includes('<small class="stream-plat">YouTube'),'platform word replaced by the icon');
  assert.ok(!out.includes('↗'),'no leftover external-link arrow next to the icons');
  assert.ok(out.includes('Watch Corey on youtube'),'accessible label still names the platform');
});
