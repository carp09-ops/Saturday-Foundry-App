const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('playoff picture seeds champions to byes and pairs the first round', () => {
  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('function playoffPicture('), wf.indexOf('async function openMarket('));
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  const team = (id, name, conf, wins, losses) => ({ id, name, conf, w: wins, l: losses, cw: wins, cl: losses });
  w.eval(`
    var esc = s => String(s);
    var section = t => '<h2>' + t + '</h2>';
    var scope = 'all';
    var model = {};
    var bracketData = () => null;
    var games = () => [];
    var conferenceModel = () => ({
      sortRows: (a, b) => (b.w / (b.w + b.l)) - (a.w / (a.w + a.l)) || b.w - a.w,
      teams: [
        ${JSON.stringify(team('c1', 'Charlie One', 'Conf C', 10, 0))},
        ${JSON.stringify(team('a1', 'Apex', 'Conf A', 10, 1))},
        ${JSON.stringify(team('a2', 'Alpha Two', 'Conf A', 9, 1))},
        ${JSON.stringify(team('b1', 'Bravo One', 'Conf B', 8, 2))},
        ${JSON.stringify(team('d1', 'Delta One', 'Conf D', 7, 3))},
        ${JSON.stringify(team('c2', 'Charlie Two', 'Conf C', 7, 3))},
        ${JSON.stringify(team('a3', 'Alpha Three', 'Conf A', 6, 4))},
        ${JSON.stringify(team('d2', 'Delta Two', 'Conf D', 6, 4))},
        ${JSON.stringify(team('b2', 'Bravo Two', 'Conf B', 5, 5))},
        ${JSON.stringify(team('b3', 'Bravo Three', 'Conf B', 4, 6))},
        ${JSON.stringify(team('c3', 'Charlie Three', 'Conf C', 3, 7))},
        ${JSON.stringify(team('d3', 'Delta Three', 'Conf D', 2, 8))}
      ]
    });
    ${src}
  `);
  const html = w.playoffPicture();
  assert(html.includes('Playoff picture'), 'Section renders');
  const order = ['Charlie One', 'Apex', 'Bravo One', 'Delta One', 'Alpha Two', 'Charlie Two', 'Alpha Three', 'Delta Two', 'Bravo Two', 'Bravo Three', 'Charlie Three', 'Delta Three'];
  let last = -1;
  for (const name of order) {
    const idx = html.indexOf(name);
    assert(idx > last, name + ' should appear in seed order');
    last = idx;
  }
  assert.equal((html.match(/First-round bye/g) || []).length, 4, 'Exactly the four champions get byes');
  assert(html.includes('At-large · First round: hosts #12'), 'Seed 5 hosts seed 12');
  assert(html.includes('At-large · First round: at #5'), 'Seed 12 travels to seed 5');
  assert(html.includes('Conference champion'), 'Champions are tagged');
  w.eval('bracketData = () => ({ rounds: [] });');
  assert.equal(w.playoffPicture(), '', 'The real bracket replaces the picture once playoff games exist');
  w.eval('bracketData = () => null; scope = "mine";');
  assert.equal(w.playoffPicture(), '', 'Picture only renders in the all-scores scope');
  assert(read('assets/graphite/league.js').includes("bracketSection()||playoffPicture()"), 'Scores falls back to the picture when no bracket exists');
});
