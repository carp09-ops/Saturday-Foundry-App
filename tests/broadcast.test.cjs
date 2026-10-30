const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('projected TV networks render ESPN-style from the source tree', () => {
  const league = read('assets/graphite/league.js');
  const start = league.indexOf('function kickoff(');
  const panelStart = league.indexOf('function broadcastPanel(');
  const end = league.indexOf('\nfunction ', panelStart + 10);
  const src = league.slice(start, end);
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var esc = s => String(s);
    ${src}
  `);
  // With a projection present, the tier stays off the kickoff line; the channel tag carries it.
  assert.equal(w.kickoff({ network: 'National broadcast (network unspecified)', projected_network: 'ESPN', final: true, overtime: false }), 'FINAL');
  // Tier-only games map the stored tier text to ESPN-style labels.
  assert.equal(w.kickoff({ network: 'National broadcast (network unspecified)', final: true, overtime: false }), 'FINAL · National');
  assert.equal(w.kickoff({ network: 'Conference/secondary broadcast (network unspecified)', final: false, kickoff_time: null }), 'UPCOMING · Conference / secondary');
  assert.equal(w.kickoff({ network: 'Not shown in screenshot', final: true, overtime: false }), 'FINAL · Not shown in screenshot');
  // The card tag shows the channel name alone — no Projected TV prefix.
  const tag = w.broadcastTag({ projected_network: 'Big Ten Network' });
  assert(tag.includes('broadcast-channel') && tag.includes('>Big Ten Network<'), 'Tag is the bare channel name in a pill');
  assert(!tag.includes('Projected TV'), 'No Projected TV prefix on cards');
  // The game page panel shows category + channel with the estimate disclosure.
  const panel = w.broadcastPanel({ network: 'National broadcast (network unspecified)', projected_network: 'ABC' });
  assert(panel.includes('Broadcast category') && panel.includes('>National<'), 'Panel shows the category');
  assert(panel.includes('>ABC<') && panel.includes('estimated for this simulated season'), 'Panel shows the channel and disclosure');
  assert.equal(w.broadcastPanel({ network: 'National broadcast (network unspecified)' }), '', 'No projection, no panel');
  // Card wiring: match-context prefers the broadcast tag.
  assert(league.includes("g.projected_network?broadcastTag(g):esc(g.event_name||g.network||'')"), 'Cards prefer the broadcast tag');
  assert(league.includes('${broadcastPanel(g)}'), 'Game page includes the broadcast panel');
  const css = read('assets/graphite/site.css');
  assert(css.includes('.broadcast-channel{') && css.includes('.broadcast-panel{'), 'Broadcast styles live in the source CSS');
});
