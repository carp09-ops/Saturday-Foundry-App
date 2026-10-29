const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('commissioner desk is native: allowlists, handlers, no admin embed callers', () => {
  const wf = read('assets/graphite/workflows.js');
  for (const rpc of ['revoke_dynasty_invite', 'set_coach_stream', 'commissioner_change_coach_program',
    'create_next_season_with_programs', 'release_team', 'create_heisman_award', 'delete_heisman_award',
    'generate_dynasty_vegas_week', 'generate_dynasty_vegas_line'])
    assert(wf.includes(`'${rpc}'`), `WRITE allowlist should include ${rpc}`);
  for (const rpc of ['list_dynasty_invites', 'list_heisman_awards', 'get_coach_program_moves'])
    assert(wf.includes(`'${rpc}'`), `Read allowlist should include ${rpc}`);
  for (const fn of ['function officePage(', 'function loadOfficeData(', 'function fillOfficeData(',
    'function revokeInvite(', 'function saveStream(', 'function beginCorrection(', 'function generateVegasWeek(',
    'function generateVegasLine(', 'function addHeisman(', 'function deleteHeisman(', 'function changeProgram(',
    'function retireCoach(', 'function submitRollover('])
    assert(wf.includes(fn), `Missing native handler ${fn}`);
  assert(!wf.includes("openAdvanced('admin'"), 'No caller should deep-link into the legacy admin embed');
  assert(!wf.includes('advanced league tools to view it'), 'Invite copy should point at the native list');
  // Correction flow reuses the native result editor with a commissioner guard.
  assert(wf.includes('correction:true'), 'beginCorrection should mark the draft as a correction');
  assert(wf.includes("d.correction?!(canManage()&&activeSeason()&&g):!scoreEntryAllowed(g)"),
    'saveResult should gate corrections on the commissioner role instead of own-game entry');
  // Rollover ports the bridge flow: assignments payload + duplicate guard.
  assert(wf.includes('p_expected_season_id:season.season_id'), 'Rollover should pin the expected season');
  assert(wf.includes('A school can only be assigned to one coach'), 'Rollover should reject duplicate schools');
});

test('fillOfficeData renders invites, moves and rollover selectors', () => {  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('let officeData='), wf.indexOf('async function revokeInvite'));
  const dom = new JSDOM('<!doctype html><body><div id="officeInvites"></div><div id="officeHeismans"></div><div id="officeMoves"></div><select id="moveTeam"></select><div id="rolloverPanel"></div></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(`
    var $=id=>document.getElementById(id);
    var esc=s=>String(s??'');
    var uid=s=>String(s??'');
    var model={coachStreams:[{person_id:'p1',coach_name:'Corey',current_season_id:'s1',current_team_id:'t1',current_team_name:'Florida'}]};
    var season={season_id:'s1'};
    ${src}
    officeData={
      invites:[{invite_id:'i1',active:true,use_count:1,max_uses:3,role:'member',created_at:'2026-10-01'}],
      heismans:[{award_id:'a1',award_name:'Heisman Trophy',season_number:5,player_name:'J. Smith',position:'QB',coach_name:'Corey',team_name:'Florida'}],
      moves:[{coach_name:'Saif',from_team_name:'California',to_team_name:'West Virginia',season_number:5,reason:null}],
      teamRows:[{team_id:'t1',team_name:'Florida',claimed:true,claimed_by:'Corey'},{team_id:'t2',team_name:'Georgia',claimed:false}]
    };
    fillOfficeData();
  `);
  const doc = dom.window.document;
  assert(doc.getElementById('officeInvites').innerHTML.includes('2/3 uses remaining'), 'Invite row should show remaining uses');
  assert(doc.getElementById('officeInvites').innerHTML.includes('revokeInvite'), 'Invite row should offer revoke');
  assert(doc.getElementById('officeHeismans').innerHTML.includes('J. Smith'), 'Award row should show the player');
  assert(doc.getElementById('officeMoves').innerHTML.includes('West Virginia'), 'Moves feed should show the destination');
  const moveTeam = doc.getElementById('moveTeam');
  assert.equal(moveTeam.options.length, 2, 'Destination list should exclude claimed programs (plus placeholder)');
  const roll = doc.querySelector('select[data-rollover-coach]');
  assert(roll, 'Rollover selector should render for the active coach');
  assert([...roll.options].some(o => o.text.startsWith('Stay · Florida')), 'Rollover should offer Stay for the current program');
  assert([...roll.options].some(o => o.text.startsWith('Change · Georgia')), 'Rollover should offer Change for other programs');
});

test('auto-generation fills missing active-week lines once, commissioners only', async () => {
  const wf = read('assets/graphite/workflows.js');
  const src = wf.slice(wf.indexOf('async function maybeAutoGenerateLines'), wf.indexOf('async function openMarket'));  
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.__calls = [];
  const calls = w.__calls;
  w.eval(`
    var marketStatus='loaded', marketAutoGenFor='', marketContext='x', marketRequest={};
    var mutationPending=false, week=9;
    var dynasty={dynasty_id:'d1'}, season={season_id:'s1', is_active:true};
    var commissioner=true, lined=new Set(['g1']);
    var canManage=()=>commissioner;
    var context=()=>'d1:s1';
    var session=()=>({access_token:'t'});
    var games=()=>[{id:'g1',week_number:9,is_bye:false},{id:'g2',week_number:9,is_bye:false},{id:'g3',week_number:8,is_bye:false},{id:'g4',week_number:9,is_bye:true}];
    var marketLineFor=g=>lined.has(g.id)?{spread_home:-3,total_line:45}:null;
    var lineNumber=v=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?null:Number(v);
    var req=async(url,opts)=>{window.__calls.push({url,body:opts.body});return {}};
    var loadMarketLines=async()=>{};
    ${src}
  `);
  await w.maybeAutoGenerateLines();
  assert.equal(calls.length, 1, 'One generation call for the week with a missing line');
  assert(calls[0].url.includes('generate_dynasty_vegas_week'), 'Uses the weekly generation RPC');
  assert.equal(calls[0].body.p_week_number, 9, 'Generates the active week');
  await w.maybeAutoGenerateLines();
  assert.equal(calls.length, 1, 'Does not generate twice for the same week');
  // All lines present: no generation.
  w.eval(`lined=new Set(['g1','g2']); marketAutoGenFor='';`);
  await w.maybeAutoGenerateLines();
  assert.equal(calls.length, 1, 'No generation when every active-week game has a line');
  // Members never trigger generation.
  w.eval(`lined=new Set(['g1']); marketAutoGenFor=''; commissioner=false;`);
  await w.maybeAutoGenerateLines();
  assert.equal(calls.length, 1, 'No generation for non-commissioners');
});
