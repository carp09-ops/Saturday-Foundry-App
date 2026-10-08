const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../assets/weekly-stories.js'),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));
const rows=[{week_number:4,revision:1,updated_at:'2026-10-08T00:00:00Z',payload:{recap_week:3,poll_count:25,preview_week:4,lead:{headline:'Poll moves',fact:'Rank #20'},recaps:[{id:'a-game',person_id:'a',game_id:'g',headline:'Recent win',fact:'Week 3 · 41–10',body:'Record 2–1',importance:50}],movers:[],previews:[]}},{week_number:3,revision:1,updated_at:'2026-10-08T00:00:00Z',payload:{recap_week:3,poll_count:25,lead:{headline:'Week three',fact:'A result'},recaps:[{id:'a-game',person_id:'a',game_id:'g',headline:'Recent win',fact:'Week 3 · 41–10',body:'Record 2–1',importance:50}],movers:[],previews:[]}}];
function setup(){
 const dom=new JSDOM('<section id="storylines" class="view active"><div class="story-shell"><header class="story-hero"><h2>Stories</h2><p>Intro</p></header></div></section>',{runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{D:{dynasty_id:'d'},S:{season_id:'s',season_number:6},seasons:[{season_id:'s',season_number:6},{season_id:'old',season_number:5}],state:{activeWeek:4,games:[],rankings:[]},storyCoachFilter:'all',selectedSeason:6,fetches:0,renderStorylines:()=>{},renderCoaches:()=>{},setInterval:()=>0});
 w.storySeasonNumber=()=>w.selectedSeason;w.Data={view:async(_,q)=>{w.fetches++;return q.includes('season_id=eq.old')?[{...rows[1],week_number:0,payload:{...rows[1].payload,lead:{headline:'Old season',fact:'Old facts'}}}]:rows;}};
 w.eval(source);return dom;
}
test('screen loads editions, preserves archive selection on refresh, and avoids duplicate carried-forward discovery stories',async()=>{
 const dom=setup(),w=dom.window;await tick();assert.equal(w.document.querySelector('#sfStoryWeek').value,'4');
 assert.match(w.document.querySelector('#sfWeeklyStories').textContent,/Around the League · Week 3/);
 assert.equal(w.SFWeeklyStories.chapters(6).length,1);
 const select=w.document.querySelector('#sfStoryWeek');select.value='3';select.dispatchEvent(new w.Event('change'));
 await w.SFWeeklyStories.refresh();assert.equal(w.document.querySelector('#sfStoryWeek').value,'3');assert.equal(w.fetches,2);dom.window.close();
});
test('a season change resets the week and stale in-flight responses cannot render the previous season',async()=>{
 const dom=setup(),w=dom.window;await tick();let release;
 w.Data.view=(_,q)=>q.includes('season_id=eq.old')?Promise.resolve([{...rows[1],week_number:0,payload:{lead:{headline:'Old season',fact:'Old facts'},recaps:[],movers:[],previews:[]}}]):new Promise(r=>release=r);
 const stale=w.SFWeeklyStories.refresh();w.selectedSeason=5;w.renderStorylines();await tick();
 release(rows);await stale;assert.equal(w.document.querySelector('#sfStoryWeek').value,'0');assert.match(w.document.querySelector('#sfWeeklyStories').textContent,/Old season/);assert.doesNotMatch(w.document.querySelector('#sfWeeklyStories').textContent,/Recent win/);dom.window.close();
});
