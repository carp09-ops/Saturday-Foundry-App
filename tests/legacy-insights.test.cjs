const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Legacy page ports the dynasty insights sections from the legacy app',()=>{
 const league=read('assets/graphite/league.js');
 for(const fn of ['throneHTML','tiersHTML','droughtsHTML','milestonesHTML']){
  assert(league.includes(`function ${fn}(`),`${fn} should be defined`);
 }
 assert(league.includes('${throneHTML()}'),'Legacy should render the throne');
 assert(league.includes('${tiersHTML()}${droughtsHTML()}${milestonesHTML()}'),'Legacy should render tiers, droughts and milestones');
 assert(league.includes("'All-time tiers'")&&league.includes("'The droughts'")&&league.includes("'Milestone watch'"),'Section headings should ship');
 const index=read('index.html');
 assert(index.includes('throne-card')&&index.includes('tier-card')&&index.includes('ms-bar'),'Generated bundle should include the insights markup and styles');
});
