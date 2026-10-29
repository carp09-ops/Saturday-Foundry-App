const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('rivalries route renders the upgraded page', () => {
  const league = read('assets/graphite/league.js');
  assert(league.includes("case'rivalries':return rivalriesPage();"), 'Content should route to the rivalries page');
  assert(league.includes('function seriesBoard(') && league.includes('function nextShowdown('), 'Board and showdown builders should exist');
});

test('ownership board, streaks, last meetings and next showdown compute from paired H2H rows', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function h2hMeetings('), league.indexOf('function standings()'));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const row = (id, person_id, coach_name, season_number, week_number, team_name, opponent_team, points_for, points_against) =>
    ({ id, person_id, coach_name, season_number, week_number, team_name, opponent_team, points_for, points_against, status: 'completed', is_bye: false });
  w.eval(`
    var esc = s => String(s);
    var recordCoachName = pid => ({p1:'Corey',p2:'Saif',p3:'Jared'})[pid] || 'Coach';
    var selectedCoach = 'p1';
    var games = () => ([
      {final:true, is_bye:false, person_id:'p1', opponent_person_id:'p2', week_number:4, away:'WVU', home:'Florida', awayId:'t2', homeId:'t1', team_id:'t1'},
      {final:false, is_bye:false, person_id:null, opponent_person_id:'p1', week_number:10, away:'Florida', home:'Bama', awayId:'t1', homeId:'t9', team_id:'t9'},
      {final:false, is_bye:false, person_id:'p2', opponent_person_id:'p1', week_number:12, away:'Florida', home:'WVU', awayId:'t1', homeId:'t2', team_id:'t2'}
    ]);
    var model = { history: [
      ${JSON.stringify(row('g1', 'p1', 'Corey', 4, 5, 'Florida', 'WVU', 31, 24))},
      ${JSON.stringify(row('g1', 'p2', 'Saif', 4, 5, 'WVU', 'Florida', 24, 31))},
      ${JSON.stringify(row('g2', 'p2', 'Saif', 4, 11, 'WVU', 'Florida', 38, 35))},
      ${JSON.stringify(row('g2', 'p1', 'Corey', 4, 11, 'Florida', 'WVU', 35, 38))},
      ${JSON.stringify(row('g3', 'p1', 'Corey', 5, 3, 'Florida', 'WVU', 45, 20))},
      ${JSON.stringify(row('g3', 'p2', 'Saif', 5, 3, 'WVU', 'Florida', 20, 45))},
      ${JSON.stringify(row('g3', 'p1', 'Corey', 5, 3, 'Florida', 'WVU', 45, 20))},
      ${JSON.stringify(row('g4', 'p3', 'Jared', 5, 6, 'Georgia Tech', 'Florida', 27, 24))},
      ${JSON.stringify(row('g4', 'p1', 'Corey', 5, 6, 'Florida', 'Georgia Tech', 24, 27))},
      ${JSON.stringify(row('g5', 'p3', 'Jared', 5, 9, 'Georgia Tech', 'Florida', 30, 27))},
      ${JSON.stringify(row('g5', 'p1', 'Corey', 5, 9, 'Florida', 'Georgia Tech', 27, 30))},
      ${JSON.stringify(row('g6', 'p2', 'Saif', 5, 2, 'WVU', 'Pitt', 40, 10))},
      ${JSON.stringify(row('g6', null, null, 5, 2, 'Pitt', 'WVU', 10, 40))}
    ], career: [], programs: [] };
    ${src}
  `);
  const meetings = w.h2hMeetings();
  assert.equal(meetings.length, 5, 'Five true H2H games (CPU pairing and duplicate rows excluded)');
  const board = w.seriesBoard();
  assert.equal(board.length, 2, 'Two pairings have met');
  const cs = board[0];
  assert.equal(cs.w1 + cs.w2, 3, 'Corey–Saif met three times');
  assert.equal(Math.max(cs.w1, cs.w2), 2, 'Corey leads the series');
  assert.equal(cs.last.line, 'Florida 45–20 WVU', 'Last meeting is the S5 game');
  assert.equal(cs.streakN, 1, 'No live streak after alternating wins');
  const cj = board[1];
  assert.equal(cj.streakPid, 'p3', 'Jared owns the live streak');
  assert.equal(cj.streakN, 2, 'Jared has won two straight');
  const rows = w.rivalryRows();
  assert.equal(rows.length, 2, 'Selected coach has two series');
  assert(rows.some(r => r.includes('Lost 2 straight')), 'Corey view shows the losing streak vs Jared');
  assert(rows.some(r => r.includes('Florida 45–20 WVU')), 'Series rows carry the last-meeting score');
  const nx = w.nextShowdown();
  assert.equal(nx.week_number, 12, 'Next showdown is the upcoming H2H game, not the final or the CPU game');
  assert.equal(nx.home, 'WVU');
});
