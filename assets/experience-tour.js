/* Isolated sample for experience-tour.html only. NEVER loaded by index.html. */
(function(){
 'use strict';
 function boot(){
  const byId=id=>document.getElementById(id);
  const teams=[['Army','American','ARMY','corey','Corey'],['UConn','American','CONN','pete','Pete'],['Kansas','Big 12','KU','saif','Saif'],['Georgia Tech','ACC','GT','jared','Jared']];
  const currentSeason=d=>({season_id:d+'-current',season_number:1,year:2027,is_active:true,status:'active'});
  let choice=null;
  const programs=d=>teams.map(([team,conference,abbreviation,person,name],i)=>({id:person,program_id:person,person_id:person,coach_name:name,team_id:team.toLowerCase().replace(/ /g,'-'),team_name:team,conference,abbreviation,...(i===1&&choice?{team_id:choice.team_id,team_name:choice.team_name,conference:choice.conference}:{}),season_id:currentSeason(d).season_id,season_number:1,wins:[4,3,3,2][i],losses:[0,1,1,2][i]}));
  const slate=d=>programs(d).flatMap((p,i)=>[
   {...p,id:d+'-past-'+i,week_number:4,opponent_team:['Boston College','North Texas','Houston','SMU'][i],opponent_team_id:'past-'+i,home_away:'away',status:'completed',result:i===3?'L':'W',points_for:[56,47,28,13][i],points_against:[0,3,25,21][i],is_bye:false,game_type:'regular'},
   {...p,id:d+'-next-'+i,week_number:5,opponent_team:['Tulsa','Temple','TCU','Clemson'][i],opponent_team_id:'next-'+i,home_away:'away',status:i===1?'completed':'scheduled',result:i===1?'W':null,points_for:i===1?44:null,points_against:i===1?10:null,is_bye:false,game_type:'regular'}
  ]);
  let claimed=false;
  for(const key of Object.keys(Data))if(typeof Data[key]==='function')Data[key]=async()=>[];
  Data.dynasties=async()=>[{dynasty_id:'tour-foundry',name:'Saturday Foundry 2.0',short_name:'FOUNDRY 2.0',game_edition:'27',role:'member'},{dynasty_id:'tour-rivalry',name:'Saturday Night Lights',short_name:'NIGHT LIGHTS',game_edition:'27',role:'member'}];
  Data.seasons=async d=>[currentSeason(d)];Data.activeWeek=async()=>5;
  Data.myPrograms=async d=>claimed?[programs(d)[1]]:[];
  Data.programs=async d=>programs(d);Data.standings=Data.programs;Data.games=async d=>slate(d);Data.scheduleGames=Data.games;
  Data.career=async()=>teams.map((t,i)=>({person_id:t[3],coach_name:t[4],wins:[24,19,18,15][i],losses:[7,9,12,13][i]}));
  Data.dynastyCoaches=async d=>programs(d);
  Data.teamSelection=async d=>[...programs('tour-foundry').map((p,i)=>({...p,claimed:i!==1,claimed_by:i!==1?p.coach_name:null,claimed_by_me:false})),...['Texas State','North Dakota State','Boise State','Appalachian State','Michigan','Notre Dame','Oregon','Alabama'].map((team,i)=>({team_id:'sample-'+i,team_name:team,conference:['Sun Belt','Independent','Mountain West','Sun Belt','Big Ten','Independent','Big Ten','SEC'][i],claimed:false}))];
  Data.careerHub=async()=>({coach:{name:'Coach'},totals:{wins:0,losses:0},chapters:[],editions:[],timeline:[],honors:[],facts:[]});
  Data.view=async()=>[];
  const button=byId('signInBtn');button.textContent='Explore the preview →';
  byId('loginEmail').value='coach@example.com';byId('loginPassword').value='sample-preview';byId('loginEmail').readOnly=true;byId('loginPassword').readOnly=true;
  document.querySelector('#authPaneSignIn .hq-auth-card-head p').textContent='Sample journey. Continue to explore without an account.';
  async function start(){
   save({access_token:'sample-only',user:{id:'sample-coach',email:'Sample coach'}});
   await enter({user:{id:'sample-coach',email:'Sample coach'}});
  }
  button.onclick=start;
  byId('signUpBtn').onclick=start;
  byId('confirmTeamBtn').onclick=async()=>{
   if(!selectedTeamChoiceId)return;
   choice=teamChoices.find(t=>String(t.team_id)===String(selectedTeamChoiceId));if(!choice||choice.claimed)return;
   claimed=true;
   await loadDynasty(dynasties.findIndex(d=>d.dynasty_id===D.dynasty_id));
   window.SFExperience.navigate('overview');
  };
  byId('signOutBtn').onclick=()=>{claimed=false;save(null);signedOut();};
  byId('chooserSignOutBtn').onclick=byId('signOutBtn').onclick;
  byId('claimBtn').onclick=()=>{byId('claimMessage').classList.remove('hidden');byId('claimMessage').textContent='Sample only. Use “Your dynasties” to continue.';};
  for(const id of ['createDynastyBtn','dynastyHubJoinBtn'])byId(id).onclick=()=>window.CDHQToast?.('Sample only. No dynasty will be created.');
  // Preserve the real UI but stop score controls from opening a save flow in the tour.
  document.addEventListener('click',e=>{
   if(e.target.closest('[data-result-game],[onclick*="openResultModal"],#submitResultBtn,#geSaveBtn')){e.preventDefault();e.stopImmediatePropagation();window.CDHQToast?.('Sample preview: score entry is available in the live-data app.');}
  },true);
  const badge=document.createElement('div');badge.className='sf-x-tour-badge';badge.textContent='INTERACTIVE SAMPLE · NO DATABASE WRITES';
  badge.style.cssText='background:#d5b471;color:#172018;text-align:center;padding:7px 12px;font:600 9px Inter,sans-serif;letter-spacing:.08em';byId('siteHeader').before(badge);
  signedOut();window.SFExperience.refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
