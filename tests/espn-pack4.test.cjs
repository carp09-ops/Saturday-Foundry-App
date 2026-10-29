const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('game page renders a win probability meter from the dynasty line', () => {
  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('function marketLineFor('), wf.indexOf('function dynastyLine('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var esc = s => String(s);
    var marketStatus = 'loaded';
    var marketContext = 'ctx';
    var context = () => 'ctx';
    var marketRows = [{ game_id: 'g1', spread_home: -2.5, total_line: 52.5, projected_away_score: 25, projected_home_score: 28, home_win_probability: 0.58 }];
    ${src}
  `);
  const g = { id: 'g1', away: 'Wake Forest', home: 'Georgia Tech' };
  const meter = w.winProbMeter(g);
  assert(meter.includes('WIN PROBABILITY'), 'Meter is labeled');
  assert(meter.includes('Wake Forest 42% · Georgia Tech 58%'), 'Both sides get their percentage');
  assert(meter.includes('width:42%') && meter.includes('width:58%'), 'Bar segments match the percentages');
  assert(meter.includes('aria-label="Win probability: Wake Forest 42 percent, Georgia Tech 58 percent"'), 'Meter is accessible');
  assert.equal(w.winProbMeter({ id: 'nope', away: 'A', home: 'B' }), '', 'No line, no meter');
  assert(wf.includes('return base+dynastyLine(g)+winProbMeter(g)+h2hStatus(g)+'), 'Game page places the meter under the dynasty line');
});
