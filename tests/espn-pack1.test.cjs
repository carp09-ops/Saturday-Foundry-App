const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('rankings show ESPN-style movement versus the previous recorded poll', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function rankings('), league.indexOf('const TIER_LABELS'));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var esc = s => String(s);
    var dynasty = { name: 'Fixture League' };
    var title = (k, t, p) => t + '|' + (p || '');
    var empty = t => 'EMPTY:' + t;
    var table = (heads, rows) => heads.join(',') + '::' + rows.map(r => r.join('|')).join(';;');
    var teamData = id => ({ name: ({t1:'Alpha', t2:'Bravo', t3:'Charlie', t4:'Delta'})[id] || id });
    var logo = id => '<img data-logo="' + id + '">';
    var model = { rankings: [
      {team_id:'t1', rank:3, week_number:5, wins:4, losses:1},
      {team_id:'t2', rank:1, week_number:5, wins:5, losses:0},
      {team_id:'t3', rank:2, week_number:5, wins:5, losses:0},
      {team_id:'t4', rank:4, week_number:5, wins:3, losses:2},
      {team_id:'t1', rank:1, week_number:6, wins:5, losses:1},
      {team_id:'t2', rank:3, week_number:6, wins:5, losses:1},
      {team_id:'t3', rank:2, week_number:6, wins:6, losses:0},
      {team_id:'t4', rank:5, week_number:6, wins:3, losses:3},
      {team_id:'t5', rank:4, week_number:6, wins:4, losses:2}
    ]};
    ${src}
  `);
  const html = w.rankings();
  assert(html.includes('Week 6'), 'Latest poll week is used');
  assert(html.includes('TREND'), 'Trend column renders');
  const rows = html.split('::')[1].split(';;');
  assert.equal(rows.length, 5, 'Five ranked teams in the latest poll');
  assert(rows[0].startsWith('1|') && rows[0].includes('Alpha') && rows[0].includes('data-logo="t1"'), 'Rows sort by rank, not storage order, and carry logos');
  assert(rows[0].includes('▲2'), 'Alpha climbed from 3 to 1');
  assert(rows[1].includes('—') && !rows[1].includes('▲') && !rows[1].includes('▼'), 'Charlie held at 2');
  assert(rows[2].includes('▼2'), 'Bravo fell from 1 to 3');
  assert(rows[3].includes('NEW'), 'Echo-less t5 enters the poll as NEW');
  assert(rows[4].includes('▼1'), 'Delta slipped from 4 to 5');
});

test('kickoff line carries the network when an entry has one', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('function kickoff('), league.indexOf('function card('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(src);
  assert.equal(w.kickoff({ final: true, overtime: false, network: 'ESPN2' }), 'FINAL · ESPN2');
  assert.equal(w.kickoff({ final: true, overtime: true }), 'FINAL · OT');
  assert.equal(w.kickoff({ final: false, kickoff_time: null, network: 'ABC' }), 'UPCOMING · ABC');
  assert(w.kickoff({ final: false, kickoff_time: '2031-09-02T20:00:00Z', network: 'FOX' }).endsWith('ET · FOX'), 'Scheduled games show time and network');
  assert(!w.kickoff({ final: false, kickoff_time: '2031-09-02T20:00:00Z' }).includes('·'), 'No dangling separator without a network');
});
