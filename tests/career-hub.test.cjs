const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/coach-career-hub.js','utf8'),ctx);
const rows=[{id:1,status:'active',game_edition:'27'},{id:2,status:'active',game_edition:'CFB2027'},{id:3,status:'active',game_edition:'2028'},{id:4,status:'archived',game_edition:'2026'},{id:5,status:'archived',game_edition:'27'}];
assert.equal(JSON.stringify(ctx.sfActiveDynasties(rows,2027).map(x=>x.id)),'[1,2]');
assert.equal(JSON.stringify(ctx.sfActiveDynasties(rows,2028).map(x=>x.id)),'[3]');
assert.match(ctx.sfCareerBadge({retired:true,status:'active'}),/RETIRED/);
assert.equal(ctx.sfCareerBadge({retired:false,status:'active'}),'');
assert.match(ctx.sfCareerBadge({retired:false,status:'archived'}),/ARCHIVE/);
assert.equal(ctx.sfCareerRecord({wins:35,losses:22}),'35–22');
assert.equal(ctx.sfCareerRecord({wins:0,losses:0,ties:1}),'0–0–1');
const html=fs.readFileSync('index.html','utf8');let count=0;
for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/src=|application\/ld\+json/.test(m[1]))continue;new vm.Script(m[2],{filename:`inline-${count++}`});}
assert(!html.includes('if(dynasties.length===1){hideDynastyChooser();'));
assert(html.includes('QA 9.9.2'));
assert(!html.includes('user-scalable=no'));
console.log(`Passed edition filter, retirement scope, record formatting, landing routing and ${count} inline script syntax checks.`);
assert(html.indexOf('id="dynastyChooserGrid"')<html.indexOf('id="sfCareerHub"'));
// A received private broadcast schedules a refresh; hiding the screen closes the connection.
let sent=[],scheduled=[],closed=false;
class FakeSocket{constructor(){this.readyState=1;ctx.testSocket=this;}send(value){sent.push(JSON.parse(value));}close(){closed=true;}}
const label={},liveCtx={...ctx};
Object.assign(ctx,{URL:'https://example.supabase.co',KEY:'publishable',WebSocket:FakeSocket,session:()=>({access_token:'test-access',user:{id:'test-user'}}),document:{visibilityState:'visible',body:{classList:{contains:()=>true}},getElementById:()=>label},setInterval:()=>1,clearInterval:()=>{},setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return 1;},clearTimeout:()=>{}});
ctx.sfStartCareerLive();ctx.testSocket.onopen();
assert.equal(sent[0].event,'phx_join');assert.equal(sent[0].payload.config.private,true);
assert.equal(sent[0].topic,'realtime:coach-career:test-user');
ctx.testSocket.onmessage({data:JSON.stringify({event:'broadcast',payload:{event:'career_changed'}})});
assert.equal(scheduled.at(-1).ms,350);
ctx.sfStopCareerLive();assert(closed);
console.log('Passed picker priority, private realtime subscription, notification debounce and connection cleanup.');
