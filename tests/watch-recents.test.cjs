'use strict';
/* Recent broadcasts (10.1.50): when the checker records a coach's last
   finished broadcast (model.recentBroadcasts from v_coach_live last_*
   columns), the Watch tab shows a Recent broadcasts section inside the tab,
   the offline slate names the last stream, and tapping a recent puts the
   replay on stage (YouTube embeds; Twitch links to the channel's videos). */
const test = require('node:test'), assert = require('node:assert'), fs = require('node:fs');
const { JSDOM } = require('jsdom');
const wf = fs.readFileSync('assets/graphite/workflows.js', 'utf8');
const start = wf.indexOf('let watchPick');
const src = wf.slice(start, wf.indexOf('function explorePage', start));
const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://x/' });
const w = dom.window;
w.eval(`
  var esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  var ico = () => '', uid = s => String(s), logo = () => '[logo]';
  var section = t => '<h2>' + t + '</h2>', title = (a, b) => '<h1>' + b + '</h1>', empty = t => '<p>' + t + '</p>';
  var card = () => '[card]', platformIcon = () => '[icon]', kickoff = () => 'Sat 7:00 PM';
  var week = 3, season = { season_id: 's1', is_active: true };
  var games = () => [], num = v => Number(v) || 0, render = () => {};
  var safeStreamUrl = u => { try { const x = new URL(u); return x.protocol.startsWith('http') ? u : ''; } catch { return ''; } };
  var liveRowFor = id => (model.liveStatus || []).find(r => r && String(r.person_id) === String(id) && r.is_live) || null;
  var myCoach = () => 'corey';
  var model = {
    coachStreams: [
      { person_id: 'corey', coach_name: 'Corey', current_season_id: 's1', current_team_id: 'fla', current_team_name: 'Florida', stream_platform: 'youtube', stream_url: 'https://youtube.com/@JWUSpartan' },
      { person_id: 'saif', coach_name: 'Saif', current_season_id: 's1', current_team_id: 'wvu', current_team_name: 'West Virginia', stream_platform: 'twitch', stream_url: 'https://www.twitch.tv/saifkawash' }
    ],
    liveStatus: [],
    recentBroadcasts: [
      { person_id: 'corey', coach_name: 'Corey', is_live: false, last_title: 'GATORS', last_url: 'https://www.youtube.com/watch?v=mA-WFu7T6cs', last_started_at: new Date(Date.now() - 3600e3).toISOString(), last_ended_at: new Date(Date.now() - 1800e3).toISOString() }
    ]
  };
  ${src}
`);
const corey = () => w.watchCoaches().find(c => c.person_id === 'corey');

test('watch page shows a Recent broadcasts section with title and duration', () => {
  const out = w.watchPage();
  assert.ok(out.includes('Recent broadcasts'), 'section renders');
  assert.ok(out.includes('GATORS'), 'broadcast title shows');
  assert.ok(out.includes('Corey'), 'coach named');
  assert.ok(out.includes('30m'), 'duration from started/ended stamps');
});

test('offline slate names the last stream', () => {
  w.selectWatch('corey');
  const out = w.watchStage(corey());
  assert.ok(out.includes('Last streamed:'), 'slate carries the last-streamed line');
  assert.ok(out.includes('GATORS'), 'with its title');
});

test('tapping a recent puts the YouTube replay on stage', () => {
  w.selectRecent('corey');
  const out = w.watchStage(corey());
  assert.ok(out.includes('watch-stage'), 'embed stage renders');
  assert.ok(out.includes('mA-WFu7T6cs'), 'embeds the recorded broadcast');
  assert.ok(out.includes('REPLAY'), 'badged as a replay, not live');
});

test('a Twitch recent stages a replay slate linking to the channel videos', () => {
  w.eval(`model.recentBroadcasts.push({ person_id: 'saif', coach_name: 'Saif', is_live: false, last_title: 'WVU night', last_url: 'https://www.twitch.tv/saifkawash', last_started_at: new Date(Date.now() - 7200e3).toISOString(), last_ended_at: new Date(Date.now() - 3600e3).toISOString() });`);
  w.selectRecent('saif');
  const saif = w.watchCoaches().find(c => c.person_id === 'saif');
  const out = w.watchStage(saif);
  assert.ok(out.includes('Watch replay'), 'replay action offered');
  assert.ok(out.includes('https://www.twitch.tv/saifkawash/videos'), 'links to the videos page');
});

test('no recents, no section and no slate line', () => {
  w.eval('model.recentBroadcasts = []');
  w.selectWatch('corey');
  assert.ok(!w.watchPage().includes('Recent broadcasts'), 'section hidden');
  assert.ok(!w.watchStage(corey()).includes('Last streamed:'), 'slate line hidden');
});

test('stage embeds Twitch from the channel URL even when the stored platform text is off', () => {
  w.eval(`model.liveStatus = [{ person_id: 'saif', coach_name: 'Saif', is_live: true, live_title: 'NCAA', live_url: 'https://www.twitch.tv/saifkawash' }]; model.coachStreams.find(c => c.person_id === 'saif').stream_platform = 'Twitch.tv';`);
  w.selectWatch('saif');
  const saif = w.watchCoaches().find(c => c.person_id === 'saif');
  const out = w.watchStage(saif);
  assert.ok(out.includes('<iframe'), 'stage is the player, not the slate');
  assert.ok(out.includes('player.twitch.tv'), 'twitch player embeds');
});
