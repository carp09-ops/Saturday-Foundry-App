const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/coach-career-hub.js','utf8'),ctx);
const stops=[
 {dynasty_id:'wsb',dynasty_name:'WSB',game_edition_year:2027,year:2030,team_name:'Texas State',wins:12,losses:2},
 {dynasty_id:'two',dynasty_name:'2.0',game_edition_year:2027,year:2027,team_name:'UConn',wins:2,losses:0},
 {dynasty_id:'wsb',dynasty_name:'WSB',game_edition_year:2027,year:2028,team_name:'Texas Tech',wins:8,losses:6},
 {dynasty_id:'wsb',dynasty_name:'WSB',game_edition_year:2026,year:2029,team_name:'Texas Tech',wins:3,losses:1},
 {dynasty_id:'wsb',dynasty_name:'WSB',game_edition_year:2027,year:null,team_name:'Texas State',wins:4,losses:8},
];
const chapters=[{dynasty_id:'wsb',game_edition_year:2026,retired:true}];
const before=JSON.stringify(stops),groups=ctx.sfCareerJourneyGroups(stops,chapters);
assert.equal(JSON.stringify(groups.map(g=>g.edition)),'[2027,2026]');
assert.equal(groups[0].leagues.length,2);
assert.equal(groups[0].leagues[0].stops.length,1);
assert.equal(JSON.stringify(groups[0].leagues[1].stops.map(s=>s.year)),'[2028,2030,null]');
assert(!groups[0].leagues[1].chapter?.retired);
assert(groups[1].leagues[0].chapter.retired);
assert.equal(JSON.stringify(stops),before);
const html=ctx.sfCareerJourneyMarkup(stops,chapters);
assert.equal((html.match(/class="sf-journey-rail"/g)||[]).length,3);
assert.equal((html.match(/sf-journey-move/g)||[]).length,1);
assert.match(html,/Year not recorded/);assert(!html.includes('null season'));
assert.match(html,/24–16 recorded/);assert.match(html,/RETIRED/);
assert.match(ctx.sfCareerJourneyMarkup([{...stops[0],dynasty_name:'<script>alert(1)</script>',team_name:'<img onerror=x>'}]),/&lt;script&gt;/);
assert.equal(ctx.sfCareerJourneyGroups([{...stops[0],dynasty_id:'a',dynasty_name:'Same'},{...stops[0],dynasty_id:'b',dynasty_name:'Same'}])[0].leagues.length,2);
assert.match(ctx.sfCareerJourneyMarkup([]),/No assignments recorded/);
// Live refresh restores a rail by its edition/league key and initializes new rails at the latest stop.
const buttons=[{},{}],handlers={};
const rail={clientWidth:300,scrollWidth:900,scrollLeft:0,dataset:{journeyKey:'test'},addEventListener:(event,fn)=>handlers[event]=fn,closest:()=>({querySelectorAll:()=>buttons})};
const host={querySelectorAll:selector=>selector==='.sf-journey-rail'?[rail]:[],querySelector:()=>({addEventListener(){}})};
ctx.sfSetupCareerJourney(host);assert.equal(rail.scrollLeft,600);assert.equal(buttons[1].disabled,true);
delete rail.dataset.positioned;ctx.sfSetupCareerJourney(host,new Map([['test',180]]));assert.equal(rail.scrollLeft,180);assert.equal(buttons[0].disabled,false);
console.log('Passed edition and league isolation, chronology, missing years, team moves, retirement scope, escaping and refresh scroll preservation.');
