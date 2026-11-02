'use strict';
/* Title-based league matching for the stream checker (2026-11-02): coaches
   name their team in the stream title, and the stream counts as live only in
   the league whose active-season team the title names. These tests slice the
   REAL matching functions out of the Edge Function source and run them —
   the same approach as the recents harness that verified last_* handling. */
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs');
const ts = fs.readFileSync('supabase/live-alerts/functions/stream-live-check/index.ts', 'utf8');
const start = ts.indexOf('const TEAM_ALIASES');
const end = ts.indexOf('Deno.serve');
assert.ok(start > -1 && end > start, 'matching block found in checker source');
const src = ts.slice(start, end)
  .replace(': Record<string, string[]>', '')
  .replace('function normTitleText(s: string): string', 'function normTitleText(s)')
  .replace(/function titleMatchesTeam\([^)]*\): boolean/, 'function titleMatchesTeam(title, teamName, abbr, slug)')
  .replace('new Set<string>()', 'new Set()');
const fn = new Function(src + '; return { titleMatchesTeam, normTitleText };')();
const m = fn.titleMatchesTeam;

// Corey's two leagues: Florida (WE'RE SO BACK) vs UConn (DyNASTY 2.0)
test('a Florida title matches Florida and not UConn', () => {
  assert.equal(m('Florida Gators vs Georgia Tech — Week 9', 'Florida', null, 'florida'), true);
  assert.equal(m('Florida Gators vs Georgia Tech — Week 9', 'UConn', 'CONN', 'uconn'), false);
});
test('a UConn title matches UConn and not Florida', () => {
  assert.equal(m('UCONN 🐺 Dynasty — Week 5', 'UConn', 'CONN', 'uconn'), true);
  assert.equal(m('UCONN 🐺 Dynasty — Week 5', 'Florida', null, 'florida'), false);
});
test('nicknames and abbreviations match their own team only', () => {
  assert.equal(m('GATORS 🐊', 'Florida', null, 'florida'), true);
  assert.equal(m('GATORS 🐊', 'UConn', 'CONN', 'uconn'), false);
  assert.equal(m('WVU vs Kansas', 'West Virginia', null, 'west-virginia'), true);
  assert.equal(m('WVU vs Kansas', 'Kansas', null, 'kansas'), true); // Saif coaches Kansas in the other league; per-person rows keep this safe
  assert.equal(m('🪖ARMY Dynasty', 'Army', null, 'army'), true);
});
test('an opponent-only title matches neither of the coach teams (falls back upstream)', () => {
  assert.equal(m('MIZZOU', 'UConn', 'CONN', 'uconn'), false);
  assert.equal(m('MIZZOU', 'Florida', null, 'florida'), false);
  assert.equal(m('NCAA', 'Kansas', null, 'kansas'), false);
  assert.equal(m('', 'Kansas', null, 'kansas'), false);
  assert.equal(m(undefined, 'Kansas', null, 'kansas'), false);
});
test('word boundaries prevent substring accidents', () => {
  assert.equal(m('CALL OF DUTY NIGHT', 'California', 'CAL', 'california'), false);
  assert.equal(m('CAL STANFORD RIVALRY', 'California', 'CAL', 'california'), true);
});
test('checker wires the fallback: unmatched titles keep every league', () => {
  assert.ok(ts.includes('matched.length ? matched : rows'), 'fallback to all rows when nothing matches');
  assert.ok(ts.includes('team_name,team_slug,abbreviation'), 'checker reads the team columns');
});

test('serve loop decides live dynasties per coach from the probed title', async () => {
  const loopStart = ts.indexOf('const byPerson');
  const loopEnd = ts.indexOf('for (const c of rows) {');
  assert.ok(loopStart > -1 && loopEnd > loopStart, 'decision block found');
  const block = ts.slice(loopStart, loopEnd)
    .replace('new Map<string, any[]>()', 'new Map()')
    .replace(/\(c: any\)/g, '(c)')
    .replace('byPerson.get(c.person_id)!.push', 'byPerson.get(c.person_id).push')
    .replace(/const first = rows\[0\];[\s\S]*?\} else continue;/, 'const first = rows[0]; const probe = globalThis.__probe;');
  const WSB = 'wsb', D2 = 'd2';
  const channels = [
    { dynasty_id: WSB, person_id: 'corey', platform: 'youtube', stream_url: 'https://youtube.com/@JWUSpartan', team_name: 'Florida', team_slug: 'florida', abbreviation: null },
    { dynasty_id: D2, person_id: 'corey', platform: 'youtube', stream_url: 'https://youtube.com/@JWUSpartan', team_name: 'UConn', team_slug: 'uconn', abbreviation: 'CONN' },
  ];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const decide = new AsyncFunction('channels', 'titleMatchesTeam', `
    ${block}
    return [...liveDynasties];
    }
  `);
  // Florida title -> only WSB is live
  globalThis.__probe = { live: true, title: 'Florida vs Georgia Tech', url: 'https://www.youtube.com/watch?v=ABCDEFGHIJK' };
  assert.deepEqual(await decide(channels, fn.titleMatchesTeam), [WSB]);
  // UConn title -> only D2 is live
  globalThis.__probe = { live: true, title: 'UCONN 🐺', url: 'https://www.youtube.com/watch?v=ABCDEFGHIJK' };
  assert.deepEqual(await decide(channels, fn.titleMatchesTeam), [D2]);
  // Title names neither team -> fallback keeps both leagues
  globalThis.__probe = { live: true, title: 'NCAA', url: 'https://www.youtube.com/watch?v=ABCDEFGHIJK' };
  assert.deepEqual((await decide(channels, fn.titleMatchesTeam)).sort(), [D2, WSB]);
});
