const test=require('node:test');
const assert=require('node:assert/strict');
const {selectEdition,filtered,markup,EditionStore}=require('../assets/weekly-stories.js');
const editions=[{week_number:4,revision:1,updated_at:'2026-10-08T00:00:00Z',payload:{week:4,poll_count:25,preview_week:4,lead:{headline:'A new contender',fact:'Ranked #20.'},recaps:[{person_id:'a',coach_name:'A',headline:'First team',fact:'Won 41–10.',body:'Now 2–1.',record:'2–1'},{person_id:'b',headline:'Second team',fact:'Lost 14–19.'}],movers:[{headline:'Team climbs',fact:'#21 to #20.'}],previews:[{person_id:'a',headline:'Team at Rival',fact:'Week 4 · Away'}]}},{week_number:0,payload:{recaps:[],movers:[],previews:[]}}];
test('archives preserve Week 0 and default to the latest available edition',()=>{
 assert.equal(selectEdition(editions,0).week_number,0);
 assert.equal(selectEdition(editions,null).week_number,4);
 assert.equal(selectEdition([],3),null);
});
test('person filters scope team coverage and previews but retain league poll coverage',()=>{
 const html=markup(editions[0],'a');assert.match(html,/First team/);assert.doesNotMatch(html,/Second team/);assert.match(html,/Team climbs/);assert.match(html,/Team at Rival/);
 assert.equal(filtered(editions[0].payload.recaps,'b').length,1);
});
test('untrusted text is escaped and incomplete polls do not imply ranking movement',()=>{
 const html=markup({week_number:3,payload:{lead:{headline:'<script>alert(1)</script>',fact:'"quoted"'},poll_count:12}});
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/poll is incomplete/);
});
test('league and season caches cannot contaminate each other; concurrent reads are deduplicated',async()=>{
 let calls=0;const store=new EditionStore(async query=>{calls++;return [{query}];});
 await Promise.all([store.load('league-a:season-a','a'),store.load('league-a:season-a','a')]);assert.equal(calls,1);
 await store.load('league-b:season-a','b');assert.equal(calls,2);assert.equal(store.rows('league-a:season-a')[0].query,'a');assert.equal(store.rows('league-b:season-a')[0].query,'b');
 await store.load('league-a:season-a','a');assert.equal(calls,2);await store.load('league-a:season-a','new',true);assert.equal(calls,3);
});
test('failed refreshes retain the last saved edition and release the in-flight request',async()=>{
 let fail=false;const store=new EditionStore(async()=>{if(fail)throw Error('offline');return editions;});
 await store.load('a','a');fail=true;await assert.rejects(store.load('a','a',true));assert.equal(store.rows('a')[0].week_number,4);
 fail=false;await store.load('a','a',true);assert.equal(store.pending.size,0);
});
