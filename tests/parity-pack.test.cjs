const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('standings print PF/PA and cards carry team records', () => {
  const league = read('assets/graphite/league.js');
  assert(league.includes("'CONF','OVERALL','PCT','PF','PA','STREAK'"), 'Standings gain PF/PA columns');
  assert(league.includes("'—',t.pf,t.pa,streaks.get(t.id)"), 'Standings rows print the model PF/PA');
  assert(league.includes('function teamRecordMap(') && league.includes('function recordChip('), 'Card record helpers exist');
  assert(league.includes('<span>${esc(g.away)}${recordChip(g.awayId)}</span>'), 'Away row carries its record inside the name cell (grid stays three columns)');
  assert(league.includes('<span>${esc(g.home)}${recordChip(g.homeId)}</span>'), 'Home row carries its record inside the name cell');
});

test('card records count finals only, from the loaded season', () => {
  const league = read('assets/graphite/league.js');
  const src = league.slice(league.indexOf('let cardRecKey'), league.indexOf('function card('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var dynasty = { dynasty_id: 'd1' };
    var season = { season_id: 's6' };
    var games = () => ([
      { awayId: 'fla', homeId: 'gt', a: 31, h: 17, final: true },
      { awayId: 'wvu', homeId: 'fla', a: 24, h: 20, final: true },
      { awayId: 'fla', homeId: 'cupcake', a: 0, h: 0, final: false }
    ]);
    ${src}
  `);
  assert.equal(w.recordChip('fla'), '<span class="team-rec">1–1</span>', 'Florida is 1-1 in finals');
  assert.equal(w.recordChip('gt'), '<span class="team-rec">0–1</span>');
  assert.equal(w.recordChip('cupcake'), '', 'No finals, no record chip');
});

test('last five comes from dynasty history, deduped and most recent first', () => {
  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('function lastFiveRows('), wf.indexOf('function dynastyLine('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const row = (season_number, week_number, opponent_team, points_for, points_against, extra = {}) =>
    ({ season_id: 's' + season_number, season_number, week_number, week_label: 'Week ' + week_number, team_name: 'Florida', opponent_team, opponent_team_id: 'opp-' + opponent_team, points_for, points_against, is_bye: false, home_away: 'home', ...extra });
  w.eval(`
    var esc = s => String(s);
    var section = t => '<h2>' + t + '</h2>';
    var logo = () => '';
    var season = { season_number: 6 };
    var model = { history: [
      ${JSON.stringify(row(6, 3, 'LSU', 27, 24))},
      ${JSON.stringify(row(6, 2, 'Miami', 17, 31))},
      ${JSON.stringify(row(6, 2, 'Miami', 17, 31))},
      ${JSON.stringify(row(6, 1, 'UCF', 41, 10))},
      ${JSON.stringify(row(5, 14, 'Bama', 20, 23))},
      ${JSON.stringify(row(5, 13, 'FSU', 35, 28))},
      ${JSON.stringify(row(5, 12, 'UGA', 13, 30))},
      ${JSON.stringify(row(6, 4, 'Bye U', 0, 0, { is_bye: true }))}
    ]};
    ${src}
  `);
  const rows = [...w.lastFiveRows('Florida')];
  assert.equal(rows.length, 5, 'Five rows after dedupe and the bye filter');
  assert.deepEqual(rows.map(r => r.opponent_team), ['LSU', 'Miami', 'UCF', 'Bama', 'FSU'], 'Most recent first across seasons');
  const html = w.lastFiveSection({ away: 'Florida', home: 'Georgia', awayId: 'fla', homeId: 'uga' });
  assert(html.includes('Last five games'), 'Section renders');
  assert(html.includes('W 27–24') && html.includes('L 17–31'), 'Results carry W/L and score');
  assert(html.includes('S5 · Week 14'), 'Prior-season rows are tagged with their season');
});

test('bracket uses ESPN round names and crowns a champion', () => {
  const wf = read('assets/graphite/workflows.js');
  assert(wf.includes("const labels=['First Round','Quarterfinals','Semifinals','National Championship'];"), 'Round names match ESPN');
  const src = wf.slice(wf.indexOf('function champBanner('), wf.indexOf('function playoffPicture('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var esc = s => String(s);
    var logo = (id, name) => '<img alt="' + name + '">';
    var season = { year: 2030 };
    ${src}
  `);
  const banner = w.champBanner({ final: true, a: 21, h: 27, away: 'Miami', home: 'Florida', awayId: 'mia', homeId: 'fla' });
  assert(banner.includes('NATIONAL CHAMPION'), 'Banner crowns the winner');
  assert(banner.includes('2030') && banner.includes('Florida'), 'Banner shows the year and champion');
  assert.equal(w.champBanner({ final: false, a: 0, h: 0, away: 'Miami', home: 'Florida' }), '', 'No banner before the final is played');
});
