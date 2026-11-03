'use strict';
/* Rank display consistency (10.1.59): Corey saw Kansas unranked on Home
   while the Top 25 tab had them 14 — cards were printing the ranks stored
   on the game row (frozen when the schedule loaded) instead of the poll.
   Rule: upcoming games display the LATEST poll (absent = unranked); finals
   keep the rank recorded with the score; no poll at all = stored fallback. */
const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs');
const league=fs.readFileSync('assets/graphite/league.js','utf8');
const start=league.indexOf('function latestPoll(');
const src=league.slice(start,league.indexOf('\nfunction ',league.indexOf('function rankPrefix',start)+10));
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://x/'});
const w=dom.window;
w.eval(`
  var num=x=>Number.isFinite(Number(x))?Number(x):0;
  var model={rankings:[
    {week_number:4,team_id:'uconn',rank:9},
    {week_number:5,team_id:'uconn',rank:18},
    {week_number:5,team_id:'kansas',rank:14}
  ]};
  ${src}
`);
// UConn's entry: stored ranks say UConn 17, Kansas unranked — both stale.
const upcoming={team_id:'uconn',opponent_team_id:'kansas',team_rank:17,opponent_rank:null,homeId:'kansas',awayId:'uconn',final:false};
const played={...upcoming,final:true};

test('upcoming cards show the latest poll, not the stored row ranks',()=>{
  assert.equal(w.displayRank(upcoming,'kansas'),14,'Kansas is 14 in the latest poll');
  assert.equal(w.displayRank(upcoming,'uconn'),18,'UConn is 18 in the latest poll — not stored 17, not last week\u2019s 9');
  assert.ok(w.rankPrefix(upcoming,'kansas').includes('>14<'),'card prefix renders the poll rank');
});

test('a team absent from the latest poll shows unranked on upcoming games',()=>{
  const g={...upcoming,opponent_team_id:'navy',homeId:'navy'};
  assert.equal(w.displayRank(g,'navy'),null,'stored ranks do not resurrect a team the poll dropped');
});

test('finals keep the rank recorded with the score',()=>{
  assert.equal(w.displayRank(played,'uconn'),17,'the final shows the rank it was played under');
  assert.equal(w.displayRank(played,'kansas'),null,'Kansas was unranked in that final, whatever the poll says now');
});

test('with no poll recorded, stored ranks are the fallback',()=>{
  w.eval('model.rankings=[]');
  assert.equal(w.displayRank(upcoming,'uconn'),17);
  assert.equal(w.displayRank(upcoming,'kansas'),null);
});
