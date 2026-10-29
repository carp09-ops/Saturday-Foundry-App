const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('record book is routed and linked from explore', () => {
  const league = read('assets/graphite/league.js');
  assert(league.includes("'records',"), 'Records route should be registered');
  assert(league.includes("case'records':return recordsPage();"), 'Content should route to the record book');
  assert(league.includes('function recordBookGames('), 'Eligibility/dedupe builder should exist');
  const wf = read('assets/graphite/workflows.js');
  assert(wf.includes("row('Record book'"), 'Explore should link to the record book');
});

test('record book dedupes like legacy and computes extremes, streaks, best seasons', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function recordBookGames('), league.indexOf('function recordsPage('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const row = (person_id, season_number, week_number, team_name, opponent_team, points_for, points_against, result_method = 'played') =>
    ({ person_id, season_id: 's' + season_number, season_number, week_number, team_name, opponent_team, points_for, points_against, result: points_for > points_against ? 'W' : 'L', result_method, status: 'completed', is_bye: false, id: Math.random().toString(36).slice(2) });
  w.eval(`
    var model={
      history:[
        // Duplicate pair: the sim row says a 10-40 loss; the played (authoritative) row says a 45-10 win.
        ${JSON.stringify(row('p1', 4, 1, 'Florida', 'Georgia', 10, 40, 'sim'))},
        ${JSON.stringify(row('p1', 4, 1, 'Florida', 'Georgia', 45, 10, 'played'))},
        ${JSON.stringify(row('p1', 4, 2, 'Florida', 'LSU', 63, 0))},
        ${JSON.stringify(row('p1', 4, 3, 'Florida', 'Bama', 31, 30))},
        ${JSON.stringify(row('p1', 4, 4, 'Florida', 'Texas', 20, 24))},
        ${JSON.stringify(row('p1', 4, 5, 'Florida', 'Auburn', 38, 35))},
        ${JSON.stringify(row('p2', 4, 1, 'WVU', 'Pitt', 55, 52))},
        ${JSON.stringify(row('p2', 4, 2, 'WVU', 'Kansas', 7, 49))},
        // CPU-only row: no person_id, never enters the book even with a huge margin.
        ${JSON.stringify(row(null, 4, 2, 'Ohio State', 'Rutgers', 77, 0))},
        // Current (active) season rows: count for extremes/streaks, never for best season.
        ${JSON.stringify(row('p1', 5, 1, 'Florida', 'Miami', 40, 10))}
      ],
      career:[{person_id:'p1',coach_name:'Corey'},{person_id:'p2',coach_name:'Saif'}],
      programs:[],
      seasons:[{season_number:4,status:'completed',is_active:false},{season_number:5,status:'active',is_active:true}]
    };
    var season={season_number:5};
    ${src}
  `);
  const games = w.recordBookGames();
  assert.equal(games.length, 8, 'Dedupe drops the sim duplicate; CPU-only rows never enter');
  const kept = games.find(g => g.person_id === 'p1' && g.week_number === 1);
  assert.equal(kept.points_for, 45, 'The authoritative played row beats the sim duplicate');
  const ex = w.leagueExtremes(games);
  assert.equal(ex.blowout.team_name, 'Florida', 'Blowout is the 63-0 game (not the CPU 77-0)');
  assert.equal(Number(ex.blowout.points_for) - Number(ex.blowout.points_against), 63);
  assert.equal(Number(ex.worstLoss.points_for) - Number(ex.worstLoss.points_against), -42, 'Worst loss is WVU 7-49');
  assert.equal(Number(ex.shootout.points_for) + Number(ex.shootout.points_against), 107, 'Shootout is the 55-52 game');
  assert.equal(Number(ex.mostPoints.points_for), 63, 'Most points in a game');
  assert.equal(Math.abs(Number(ex.nailbiter.points_for) - Number(ex.nailbiter.points_against)), 1, 'Closest game is the 31-30 final');
  assert.equal(w.longestWinStreak('p1', games), 3, 'Corey streak: W (deduped) + 63-0 + 31-30, then a loss');
  const best = w.bestSeason('p1', games);
  assert.equal(best.season, 4, 'Best season comes from completed seasons only');
  assert.equal(best.wins, 4, 'Best season win count uses the deduped rows');
  assert.equal(best.losses, 1);
});
