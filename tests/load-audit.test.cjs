const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('load audit reports per-week load state in the League Office', () => {
  const wf = read('assets/graphite/workflows.js');
  assert(wf.includes('h+=loadAuditSection();'), 'Office page renders the audit');
  const src = wf.slice(wf.indexOf('function loadAudit('), wf.indexOf('function weekProgressStrip('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const game = (week_number, away, home, team_id, opponent_team_id, final, extra = {}) =>
    ({ week_number, week_label: 'Week ' + week_number, away, home, team_id, opponent_team_id, final, is_bye: false, status: 'scheduled', person_id: null, opponent_person_id: null, ...extra });
  w.eval(`
    var esc = s => String(s);
    var section = t => '<h2>' + t + '</h2>';
    var model = {
      programs: [{ team_id: 'fla', person_id: 'p1', coach_name: 'Corey' }],
      rankings: [{ week_number: 1 }, { week_number: 2 }, { week_number: 2 }]
    };
    var games = () => ([
      ${JSON.stringify(game(1, 'Florida', 'Cincinnati', 'fla', 'cin', true))},
      ${JSON.stringify(game(1, 'Army', 'Navy', 'army', 'navy', true))},
      ${JSON.stringify(game(1, 'Rice', 'UAB', 'rice', 'uab', false))},
      ${JSON.stringify(game(2, 'Georgia', 'Florida', 'uga', 'fla', false))},
      ${JSON.stringify(game(2, 'Army', 'Rice', 'army', 'rice', true))},
      ${JSON.stringify(game(3, 'Navy', 'UAB', 'navy', 'uab', true))},
      ${JSON.stringify(game(3, 'Rice', 'Army', 'rice', 'army', true))},
      ${JSON.stringify(game(3, 'Florida', 'Bye', 'fla', 'bye', false, { is_bye: true }))}
    ]);
    ${src}
  `);
  const audit = [...w.loadAudit()];
  assert.equal(audit.length, 3, 'Three scheduled weeks (bye excluded)');
  assert.deepEqual(
    audit.map(r => [r.week, r.scheduled, r.loaded, r.coach, r.coachIn]),
    [[1, 3, 2, 1, 1], [2, 2, 1, 1, 0], [3, 2, 2, 0, 0]],
    'Per-week scheduled/loaded/coach counts match the slate'
  );
  assert.equal(audit[1].missing.length, 1, 'Week 2 is waiting on the Florida game');
  const html = w.loadAuditSection();
  assert(html.includes('Load audit'), 'Section renders');
  assert(html.includes('Top 25 polls in for weeks 1, 2'), 'Poll weeks are summarized');
  assert(html.includes('Waiting on: Georgia at Florida'), 'Missing coach game is named');
  assert(html.includes('>Loaded</b>'), 'Complete week is marked Loaded');
  assert(html.includes('>Partial</b>'), 'Incomplete week is marked Partial');
});
