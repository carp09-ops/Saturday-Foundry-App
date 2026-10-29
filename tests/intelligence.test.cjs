const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('intelligence page is routed and linked from explore', () => {
  const league = read('assets/graphite/league.js');
  assert(league.includes("'intelligence']"), 'Intelligence route should be registered');
  assert(league.includes("case'intelligence':return intelligencePage();"), 'Content should route to intelligence');
  assert(league.includes('function coachPower(') && league.includes('function coachLuck('), 'Power and luck builders should exist');
  assert(read('assets/graphite/workflows.js').includes("row('League intelligence'"), 'Explore should link to intelligence');
});

test('power index and luck index match the legacy formulas', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function recordBookGames('), league.indexOf('function intelligencePage('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const row = (person_id, wn, team_name, opponent_team, points_for, points_against) =>
    ({ person_id, season_id: 's4', season_number: 4, week_number: wn, team_name, opponent_team, points_for, points_against, result: points_for > points_against ? 'W' : 'L', result_method: 'played', status: 'completed', is_bye: false, id: Math.random().toString(36).slice(2) });
  w.eval(`
    var model={
      history:[
        ${JSON.stringify(row('p1', 1, 'Florida', 'Weak U', 49, 7))},
        ${JSON.stringify(row('p1', 2, 'Florida', 'Weak U', 42, 10))},
        ${JSON.stringify(row('p2', 1, 'WVU', 'Strong State', 30, 27))},
        ${JSON.stringify(row('p2', 2, 'WVU', 'Strong State', 13, 44))},
        // CPU rows give Weak U a losing record and Strong State a winning one (SOS inputs).
        ${JSON.stringify(row(null, 1, 'Weak U', 'Strong State', 3, 50))},
        ${JSON.stringify(row(null, 2, 'Strong State', 'Weak U', 45, 6))}
      ],
      career:[{person_id:'p1',coach_name:'Corey'},{person_id:'p2',coach_name:'Saif'}],
      programs:[], seasons:[]
    };
    var season=null;
    ${src}
  `);
  const games = w.recordBookGames();
  assert.equal(games.length, 4, 'Only coach games enter the power/luck base set');
  const recs = w.intelTeamRecs();
  const power1 = w.coachPower('p1', games, recs);
  const power2 = w.coachPower('p2', games, recs);
  assert(power1.score > power2.score, 'Undefeated blowout coach outranks the .500 coach');
  assert.equal(power1.pct, 1);
  assert(Math.abs(power1.mov - 37) < 1e-9, 'Average margin is (42+32)/2 = 37');
  // Weak U lost every game in the data (0-4 incl. CPU rows), so Corey's SOS is 0.
  assert.equal(power1.sos, 0, 'SOS averages opponent win rate');
  // Coach 2: 43 scored, 71 allowed across a 1-1 split: points say well under .500.
  const luck2 = w.coachLuck('p2', games);
  assert(luck2.expW > 0.4 && luck2.expW < 0.55, 'Pythagorean expectation near half a win');
  assert(luck2.luck > 0.45, 'A 1-1 record against a -28 point split is lucky');
  // Coach 1 outscored 91-17 at 2-0: expectation close to 2, luck near zero.
  const luck1 = w.coachLuck('p1', games);
  assert(luck1.expW > 1.9 && luck1.luck >= 0 && luck1.luck < 0.1, 'Dominant 2-0 is barely lucky');
});
