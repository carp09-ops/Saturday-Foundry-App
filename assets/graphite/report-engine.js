/* Deterministic, shared editorial selection. Artwork never supplies facts. */
(function(root){
'use strict';
const cmp=(a,b)=>String(a).localeCompare(String(b),'en');
function build({games=[],programs=[],rankings=[],week=0,h2h={ready:false,results:[]},curation={}}){
 const users=new Map(programs.filter(p=>p.person_id).map(p=>[p.team_id,p]));
 const gs=[...new Map(games.filter(g=>!g.is_bye&&g.status!=='cancelled').map(g=>[g.id,g])).values()].sort((a,b)=>a.week_number-b.week_number||cmp(a.kickoff_time||'',b.kickoff_time||'')||cmp(a.id,b.id));
 const meta=new Map((h2h.results||[]).map(r=>[r.game_id,r]));
 const human=g=>users.has(g.awayId)||users.has(g.homeId);
 const both=g=>users.has(g.awayId)&&users.has(g.homeId)&&users.get(g.awayId).person_id!==users.get(g.homeId).person_id;
 const verified=g=>g.final&&Number.isFinite(Number(g.a))&&Number.isFinite(Number(g.h))&&(!both(g)||(h2h.ready&&(!meta.has(g.id)||['confirmed','resolved'].includes(meta.get(g.id).status))));
 const wins=(g,id)=>g.awayId===id?Number(g.a)>Number(g.h):Number(g.h)>Number(g.a);
 const userIds=g=>[g.awayId,g.homeId].filter(id=>users.has(id));
 const current=gs.filter(g=>g.week_number<=week&&human(g));
 const latest=Math.max(-1,...current.filter(verified).map(g=>Number(g.week_number)));
 const finals=current.filter(g=>verified(g)&&Number(g.week_number)===latest);
 const candidates=[];
 for(const g of finals){
  const winner=Number(g.a)>Number(g.h)?g.awayId:g.homeId;
  const teamId=users.has(winner)?winner:userIds(g)[0],won=wins(g,teamId),name=teamId===g.awayId?g.away:g.home;
  const opponent=teamId===g.awayId?g.home:g.away,ownScore=Number(teamId===g.awayId?g.a:g.h),oppScore=Number(teamId===g.awayId?g.h:g.a);
  let streak=0;
  // An unplayed/unverified intervening game interrupts a claimed streak.
  const history=current.filter(x=>x.awayId===teamId||x.homeId===teamId),end=history.findIndex(x=>x.id===g.id);
  for(let i=end;i>=0;i--){if(!verified(history[i])||!wins(history[i],teamId))break;streak++}
  const ownRank=Number(teamId===g.team_id?g.team_rank:g.opponent_rank)||null,oppRank=Number(teamId===g.team_id?g.opponent_rank:g.team_rank)||null;
  let type='recap',kicker='FINAL WHISTLE',importance=40,headline=won?`${name} gets the win`:`${name} falls to ${opponent}`;
  if(g.game_type==='national_championship'&&won){type='champion';kicker='NATIONAL CHAMPIONS';importance=100;headline=`${name} takes the title`}
  else if(g.game_type==='conference_championship'&&won){type='champion';kicker='CONFERENCE CHAMPIONS';importance=95;headline=`${name} wins the conference title`}
  else if(['playoff','cfp'].includes(g.game_type)){type='postseason';kicker='PLAYOFF RESULT';importance=90;headline=won?`${name} wins in the playoff`:`${name} exits the playoff`}
  else if(won&&oppRank>=1&&oppRank<=25&&(!ownRank||ownRank>oppRank)){type='upset';kicker='STATEMENT WIN';importance=80;headline=`${name} knocks off No. ${oppRank} ${opponent}`}
  else if(both(g)){type='rivalry';kicker='HEAD TO HEAD';importance=75;headline=`${name} wins the user showdown`}
  else if(g.overtime){type='overtime';kicker='EXTRA FOOTBALL';importance=70;headline=won?`${name} survives in overtime`:`${name} falls in overtime`}
  else if(won&&streak>=3){type='streak';kicker='ON A ROLL';importance=65;headline=`${streak} straight. ${name} keeps rolling.`}
  else if(g.game_type==='bowl'){type='postseason';kicker='BOWL RESULT';importance=60;headline=won?`${name} closes with a bowl win`:`${name} falls in the bowl game`}
  candidates.push({id:'game:'+g.id,game_id:g.id,team_id:teamId,team:name,teams:[g.awayId,g.homeId],week:g.week_number,type,kicker,importance,headline,streak:type==='streak'?streak:null,fact:`${users.get(teamId).coach_name} · ${name} ${won?'beat':'lost to'} ${opponent}, ${ownScore}–${oppScore}${g.overtime?' in overtime':''}.`,game:g});
 }
 // Poll movement is factual only when both adjacent recorded polls are complete and unique.
 const polls=new Map();for(const r of rankings){if(r.week_number<=week&&(r.poll_type==null||r.poll_type==='top25')){const w=Number(r.week_number);if(!polls.has(w))polls.set(w,[]);polls.get(w).push(r)}}
 const weeks=[...polls.keys()].sort((a,b)=>b-a),pw=weeks[0],prior=weeks[1];
 const complete=rows=>rows?.length===25&&new Set(rows.map(r=>r.team_id)).size===25&&new Set(rows.map(r=>Number(r.rank))).size===25&&rows.every(r=>Number(r.rank)>=1&&Number(r.rank)<=25);
 if(pw===Number(week)&&complete(polls.get(pw))&&complete(polls.get(prior))){for(const r of polls.get(pw)){const before=polls.get(prior).find(p=>p.team_id===r.team_id);const delta=before?Number(before.rank)-Number(r.rank):null;if(!users.has(r.team_id)||!(delta===null||Math.abs(delta)>=3))continue;const name=users.get(r.team_id).team_name;candidates.push({id:`poll:${r.team_id}:${pw}`,team_id:r.team_id,team:name,teams:[r.team_id],week:pw,type:'poll',kicker:'POLL WATCH',rank:Number(r.rank),importance:55,headline:delta===null?`${name} enters at No. ${r.rank}`:`${name} ${delta>0?'climbs':'slides'} to No. ${r.rank}`,fact:before?`No. ${before.rank} in Week ${prior} → No. ${r.rank} in Week ${pw}.`:`Unranked in Week ${prior}. Ranked No. ${r.rank} in Week ${pw}.`})}}
 const previews=gs.filter(g=>human(g)&&g.status==='scheduled'&&Number(g.week_number)===Number(week)).map(g=>({id:'preview:'+g.id,game_id:g.id,game:g,teams:[g.awayId,g.homeId],team_id:userIds(g)[0],team:users.get(userIds(g)[0]).team_name,week:g.week_number,type:'preview',kicker:both(g)?'USER SHOWDOWN':'NEXT UP',importance:both(g)?35:20,headline:`${g.away} at ${g.home}`,fact:`Week ${g.week_number}${g.is_conference_game?' · Conference matchup':''}`,coach:userIds(g).map(id=>users.get(id).coach_name+' · '+users.get(id).team_name).join(' / ')}));
 candidates.push(...previews);candidates.sort((a,b)=>b.importance-a.importance||b.week-a.week||cmp(a.id,b.id));
 const hidden=new Set(curation.hidden_ids||[]),available=candidates.filter(s=>!hidden.has(s.id));
 const lead=available.find(s=>s.id===curation.pinned_id)||available.find(s=>s.type!=='preview')||available[0]||null;
 const used=new Set(lead?.teams||[]);const supporting=[];
 for(const s of available){if(s.id===lead?.id||s.type==='preview'||s.teams.some(id=>used.has(id)))continue;supporting.push(s);s.teams.forEach(id=>used.add(id));if(supporting.length===2)break}
 const next=available.filter(s=>s.type==='preview'&&s.id!==lead?.id).sort((a,b)=>b.importance-a.importance||cmp(a.id,b.id)).slice(0,2);
 const pending=current.filter(g=>(g.status==='scheduled'&&g.week_number<week)||(g.final&&!verified(g))).map(g=>({game:g,label:meta.get(g.id)?.status==='disputed'?'Result under review':g.final?'Awaiting confirmation':`Week ${g.week_number} result not recorded`}));
 return {candidates,available,lead,supporting,next,pending,week,recapWeek:latest};
}
const api={build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundryReport=api;
})(typeof globalThis==='undefined'?this:globalThis);
