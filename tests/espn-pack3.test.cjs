const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('power rankings are linked from the home rail', () => {
  assert(read('assets/graphite/workflows.js').includes("row('Power rankings','Foundry power index for this season'"), 'Home rail should link to Power Rankings');
  const league = read('assets/graphite/league.js');
  assert(league.includes('function seasonPowerRankings('), 'Season rankings builder should exist');
  assert(league.includes("section('Power Rankings · Season '"), 'Intelligence page should lead with Power Rankings');
});

test('season power rankings flip with week-over-week movement', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function recordBookGames('), league.indexOf('function intelligencePage('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const row = (person_id, wk, team_name, opponent_team, points_for, points_against, season_id = 's1') =>
    ({ person_id, season_id, season_number: 6, week_number: wk, team_name, opponent_team, points_for, points_against, result: points_for > points_against ? 'W' : 'L', result_method: 'played', status: 'completed', is_bye: false, id: Math.random().toString(36).slice(2) });
  w.eval(`
    var model = {
      history: [
        // Week 1: Saif's WVU posts the bigger win; Corey is second.
        ${JSON.stringify(row('p1', 1, 'Florida', 'Weak U', 30, 20))},
        ${JSON.stringify(row('p2', 1, 'WVU', 'Strong State', 40, 10))},
        // Week 2: Florida routs Strong State while WVU loses to Weak U — the flip.
        ${JSON.stringify(row('p1', 2, 'Florida', 'Strong State', 45, 7))},
        ${JSON.stringify(row('p2', 2, 'WVU', 'Weak U', 14, 28))},
        // CPU context for strength of schedule.
        ${JSON.stringify(row(null, 1, 'Strong State', 'Weak U', 35, 21))},
        ${JSON.stringify(row(null, 2, 'Weak U', 'Strong State', 17, 31))},
        // A prior-season game that must not leak into the season rankings.
        ${JSON.stringify(row('p2', 9, 'WVU', 'Florida', 50, 0, 's0'))}
      ],
      career: [{person_id:'p1',coach_name:'Corey'},{person_id:'p2',coach_name:'Saif'}],
      programs: [], seasons: []
    };
    var season = { season_id: 's1', season_number: 6 };
    ${src}
  `);
  const rankings = w.seasonPowerRankings();
  assert.equal(rankings.length, 2, 'Two coaches ranked');
  assert.equal(rankings[0].pid, 'p1', 'Corey leads after week 2');
  assert.equal(rankings[0].rank, 1);
  assert.equal(rankings[0].move, 1, 'Corey climbed one spot from last week');
  assert.equal(rankings[1].pid, 'p2');
  assert.equal(rankings[1].move, -1, 'Saif fell one spot');
  assert.equal(rankings[0].w, 2, 'Season record counts only this season');
  assert.equal(rankings[1].l, 1, 'Prior-season blowout does not leak in');
});
