const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('postseason presentation: card chip, game banner, bracket hook in scores', () => {
  const league = read('assets/graphite/league.js');
  assert(league.includes('function postseasonChip(g)'), 'Card chip helper should exist');
  assert(league.includes('${postseasonChip(g)}'), 'Game cards should render the postseason chip');
  assert(league.includes('postseason-banner'), 'Game page should render a postseason banner');
  assert(league.includes("bracketSection==='function'?bracketSection():''"), 'Scores should include the bracket section');
  const wf = read('assets/graphite/workflows.js');
  for (const fn of ['function bracketData(', 'function bracketActiveRound(', 'function bracketSection(', 'function setBracketRound('])
    assert(wf.includes(fn), `Missing ${fn}`);
});

test('bracket builds four rounds with byes, winner-of slots, TBDs and the title game', () => {
  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('let bracketRound=null;'), wf.indexOf('async function openMarket'));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const game = (id, week_number, game_type, away, home, final = false, a = null, h = null) =>
    ({ id, week_number, game_type, away, home, awayId: id + 'a', homeId: id + 'h', team_id: id + 'h', team_rank: null, opponent_rank: null, a, h, final, is_bye: false, status: final ? 'completed' : 'scheduled', event_name: null });
  w.eval(`
    var esc=s=>String(s??''), uid=s=>String(s??''), logo=()=>'', section=t=>'<h2>'+t+'</h2>', render=()=>{};
    var scope='all', week=17;
    var fixture=[
      ${JSON.stringify(game('g1', 16, 'playoff', 'A', 'B', true, 10, 20))},
      ${JSON.stringify(game('g2', 16, 'playoff', 'C', 'D', true, 30, 27))},
      ${JSON.stringify(game('g3', 16, 'playoff', 'E', 'F', true, 24, 21))},
      ${JSON.stringify(game('g4', 16, 'playoff', 'G', 'H', true, 17, 31))},
      ${JSON.stringify(game('g5', 17, 'playoff', 'I', 'J'))},
      ${JSON.stringify(game('g6', 17, 'playoff', 'K', 'L'))},
      ${JSON.stringify(game('g7', 20, 'national_championship', 'M', 'N'))}
    ];
    var games=()=>fixture;
    var model={scheduleGames:[{id:'bye1',is_bye:true,team_id:'TB1',team_name:'Georgia',week_number:17,event_name:'CFP First Round Bye',game_type:'playoff'}]};
    ${src}
  `);
  const data = w.bracketData();
  assert(data, 'Bracket data should exist once playoff games are scheduled');
  assert.deepEqual([...data.rounds.map(r => r.length)], [4, 4, 2, 1], 'Rounds are sized 4/4/2/1');
  assert.equal(data.rounds[0].filter(g => !g.synthetic).length, 4, 'Round 1 holds the four first-round games');
  const round2 = data.rounds[1];
  assert.equal(round2.filter(g => !g.synthetic).length, 2, 'Round 2 holds the scheduled quarterfinals');
  const byeSlot = round2.find(g => g.home === 'Georgia');
  assert(byeSlot, 'The bye team is slotted into Round 2');
  assert(byeSlot.away.startsWith('Winner of'), 'Bye slot opponent is the Round 1 winner placeholder');
  assert(round2.some(g => g.synthetic && String(g.home).startsWith('Winner of')), 'Remaining Round 2 slot uses a Winner-of placeholder');
  assert(data.rounds[2].every(g => g.synthetic && g.home === 'TBD'), 'Semifinals stay TBD until scheduled');
  assert.equal(data.rounds[3][0].id, 'g7', 'The national championship is the final round');
  const html = w.bracketSection();
  assert(html.includes('College Football Playoff'), 'Section renders on the all-games board');
  assert(html.includes('Championship'), 'Round pills include the Championship');
  w.eval(`scope='mine';`);
  assert.equal(w.bracketSection(), '', 'Bracket hides on filtered boards');
  w.eval(`scope='all'; fixture=[]; model.scheduleGames=[];`);
  assert.equal(w.bracketData(), null, 'No bracket before the postseason exists');
  assert.equal(w.bracketSection(), '', 'No bracket section before the postseason');
});
