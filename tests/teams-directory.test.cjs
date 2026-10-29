const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Teams directory lists only currently coach-managed programs as Foundry programs',()=>{
 const league=read('assets/graphite/league.js');
 const start=league.indexOf('function teams(){');
 assert(start>=0,'teams() should exist');
 const body=league.slice(start,league.indexOf('\nfunction ',start+10));
 const model={programs:[
  {team_id:'fla',team_name:'Florida',coach_name:'Corey',person_id:'corey'},
  {team_id:'gt',team_name:'Georgia Tech',coach_name:'Jared',person_id:'jared'},
  {team_id:'unc',team_name:'North Carolina',coach_name:null,person_id:null},
  {team_id:'cal',team_name:'California',coach_name:null,person_id:null}]};
 const games=()=>[
  {awayId:'unc',homeId:'fla'},{awayId:'cal',homeId:'gt'},{awayId:'af',homeId:'unc'}];
 const names={fla:{name:'Florida',conference:'SEC'},gt:{name:'Georgia Tech',conference:'ACC'},unc:{name:'North Carolina',conference:'ACC'},cal:{name:'California',conference:'ACC'},af:{name:'Air Force',conference:'Mountain West'}};
 const esc=s=>String(s??''),uid=s=>String(s),ico=()=>'',empty=t=>t;
 const dynasty={name:"WE'RE SO BACK"};
 const title=(a,b)=>`<h1>${b}</h1>`,section=t=>`<h2>${t}</h2>`;
 const logo=()=>'<img>',teamData=id=>names[id]||{name:id},myTeam=()=>'fla';
 const teams=eval(`(function(){${body};return teams})`)();
 const html=teams();
 const foundry=html.slice(html.indexOf('Foundry programs'),html.indexOf('Around the country'));
 const country=html.slice(html.indexOf('Around the country'));
 assert(foundry.includes('Florida')&&foundry.includes('Georgia Tech'),'Managed programs stay in Foundry programs');
 assert(!foundry.includes('North Carolina')&&!foundry.includes('California'),'Vacated programs must not appear as Foundry programs');
 assert(country.includes('North Carolina')&&country.includes('California'),'Vacated programs move to Around the country');
 assert(country.includes('Air Force'),'Unmanaged teams stay in Around the country');
 assert(!html.includes('Coach not assigned'),'No program should be presented with a missing coach');
});
