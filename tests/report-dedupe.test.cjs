const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('home report does not repeat this week\'s games as Next up cards', () => {
  const report = read('assets/graphite/report.js');
  assert(report.includes('function reportSection(full=false)'), 'Report section takes the full-page flag');
  assert(report.includes("${full&&r.next.length?`<h3 class=\"report-next-title\">Next up</h3>"), 'Next up block should render only on the full stories page');
  assert(report.includes("homeReport=()=>reportSection();"), 'Home uses the compact report section');
  assert(report.includes("if(route==='stories')return reportSection(true);"), 'Stories page uses the full report section');
  const wf = read('assets/graphite/workflows.js');
  assert(wf.includes("section('This week in your league','scores','All scores')"), 'Home keeps the full this-week score cards');
});
