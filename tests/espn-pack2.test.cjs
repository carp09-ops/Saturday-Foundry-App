const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('ticker flags ranked losses as upset alerts only when the winner was not favored by rank', () => {
  const report = read('assets/graphite/report.js');
  const src = report.slice(report.indexOf('function upsetLine('), report.indexOf('function tickerItems('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(src);
  const g = (over) => ({ away: 'WVU', home: 'Georgia Tech', a: 31, h: 28, awayId: 'wv', homeId: 'gt', team_id: 'gt', opponent_team_id: 'wv', team_rank: 4, opponent_rank: null, ...over });
  assert.equal(w.upsetLine(g({})), 'WVU 31, #4 Georgia Tech 28', 'Unranked winner over a ranked loser is an upset');
  assert.equal(w.upsetLine(g({ opponent_rank: 17 })), 'WVU 31, #4 Georgia Tech 28', 'Lower-ranked winner over a higher-ranked loser is an upset');
  assert.equal(w.upsetLine(g({ opponent_rank: 2 })), null, 'A better-ranked winner is not an upset');
  assert.equal(w.upsetLine(g({ team_rank: null })), null, 'An unranked loser is not an upset');
  assert.equal(w.upsetLine(g({ a: 20, h: 35 })), null, 'Ranked team winning is not an upset');
  assert(report.includes("k:'Upset alert'"), 'Ticker emits upset items with the alert kicker');
  assert(report.includes('plain.slice(0,Math.max(0,10-upsets.length))'), 'Upsets lead the finals block inside the same cap');
});

test('standings compute current streaks per team from finals', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function teamStreaks('), league.indexOf('function standings()'));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const game = (week_number, awayId, homeId, a, h) => ({ week_number, awayId, homeId, a, h, final: true });
  w.eval(`
    var games = () => ([
      ${JSON.stringify(game(1, 'x', 'a', 10, 24))},
      ${JSON.stringify(game(2, 'a', 'y', 30, 20))},
      ${JSON.stringify(game(3, 'a', 'z', 35, 14))},
      ${JSON.stringify(game(1, 'b', 'x', 40, 10))},
      ${JSON.stringify(game(2, 'y', 'b', 21, 24))},
      {week_number:4, awayId:'a', homeId:'b', a:null, h:null, final:false}
    ]);
    ${src}
  `);
  const streaks = w.teamStreaks();
  assert.equal(streaks.get('a'), 'W3', 'Team A won its last three');
  assert.equal(streaks.get('b'), 'W2', 'Team B won its last two (non-final game ignored)');
  assert.equal(streaks.get('x'), 'L2', 'Team X lost its last two');
  assert(league.includes("'PCT','STREAK'"), 'Standings table carries the streak column');
});
