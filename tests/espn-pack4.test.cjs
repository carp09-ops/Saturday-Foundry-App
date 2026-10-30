const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('game page renders an ESPN-style matchup predictor donut', () => {
  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('function marketLineFor('), wf.indexOf('function dynastyLine('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var esc = s => String(s);
    var section = t => '<h2>' + t + '</h2>';
    var logo = () => '';
    var marketStatus = 'loaded';
    var marketContext = 'ctx';
    var context = () => 'ctx';
    var marketRows = [{ game_id: 'g1', spread_home: -2.5, total_line: 52.5, projected_away_score: 25, projected_home_score: 28, home_win_probability: 0.58 }];
    var model = { history: [] };
    var season = { season_number: 6 };
    ${src}
  `);
  const g = { id: 'g1', away: 'Wake Forest', home: 'Georgia Tech', awayId: 'wf', homeId: 'gt' };
  const meter = w.winProbMeter(g);
  assert(meter.includes('MATCHUP PREDICTOR'), 'Predictor is labeled ESPN-style');
  assert(meter.includes('58.0%') && meter.includes('42.0%'), 'Percentages carry one decimal');
  assert(meter.includes('winprob-donut'), 'Percentages render as a donut');
  assert(meter.includes('stroke-dasharray="189.5 '), 'Home arc spans 58% of the ring');
  assert(meter.includes('aria-label="Matchup predictor: Wake Forest 42.0 percent, Georgia Tech 58.0 percent"'), 'Donut is accessible');
  assert.equal(w.winProbMeter({ id: 'nope', away: 'A', home: 'B', awayId: 'a', homeId: 'b' }), '', 'No line, no predictor');
  assert(wf.includes('return base+dynastyLine(g)+winProbMeter(g)+lastFiveSection(g)+h2hStatus(g)+'), 'Game page order: line, predictor, last five');
});
