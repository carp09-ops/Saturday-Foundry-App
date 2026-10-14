(function(root){
'use strict';
const helmet='<svg viewBox="0 0 52 44" aria-hidden="true"><path fill="#080c11" stroke="#e9c45f" stroke-width="2" d="M5 26V20C5 10 12 4 23 4c12 0 21 7 22 18l-9 1-3 9H20c-8 0-15-2-15-6Z"/><path fill="none" stroke="#f9dc88" stroke-width="2.5" stroke-linecap="round" d="M10 17C12 10 17 8 24 8"/><path fill="none" stroke="#d6af55" stroke-width="2.4" stroke-linejoin="round" d="m36 24 10 2 2 12H32l-4-7m10-6 1 13m-6-8h14"/><circle cx="29" cy="25" r="3" fill="#e9c45f"/><path stroke="#b28c35" stroke-width="2" d="M21 5v24"/></svg>';
function badge(two){const label=two?'User vs user':'User vs computer';return `<span class="sf-user-helmets ${two?'paired':'single'}" role="img" aria-label="${label}" title="${label}"><span>${helmet}</span>${two?'<span class="sf-helmet-opponent">'+helmet+'</span>':''}</span>`;}
function owners(g,programs){const match=(id,name)=>(programs||[]).find(p=>p.person_id&&(id?String(p.team_id)===String(id):String(p.team_name||'').toLowerCase()===String(name||'').toLowerCase()));return [match(g.team_id,g.team_name),match(g.opponent_team_id,g.opponent_team)].filter(Boolean);}
function record(g,id,name,state){
 const week=Number(g.week_number);if(!Number.isInteger(week))return null;
 const matches=(tid,tname)=>id?String(tid||'')===String(id):String(tname||'').toLowerCase()===String(name||'').toLowerCase();
 const polls=(state.rankings||[]).filter(r=>(!g.season_id||!r.season_id||String(r.season_id)===String(g.season_id))&&Number(r.week_number)<=week&&matches(r.team_id,r.team?.name)&&Number.isInteger(Number(r.wins))&&r.wins!=null&&Number.isInteger(Number(r.losses))&&r.losses!=null).sort((a,b)=>Number(b.week_number)-Number(a.week_number));
 const baseline=polls[0];let wins=baseline?Number(baseline.wins):0,losses=baseline?Number(baseline.losses):0,count=0;const seen=new Set();
 const rows=[...(state.scheduleGames||[]),...(state.games||[])];
 for(const row of rows){const w=Number(row.week_number);if(g.season_id&&row.season_id&&String(g.season_id)!==String(row.season_id))continue;if(row.status!=='completed'||row.is_bye||!Number.isInteger(w)||w>week||(baseline&&w<Number(baseline.week_number)))continue;
  const team=matches(row.team_id,row.team_name),opp=matches(row.opponent_team_id,row.opponent_team);if(!team&&!opp)continue;
  const rawFor=team?row.points_for:row.points_against,rawAgainst=team?row.points_against:row.points_for;
  if(rawFor==null||rawAgainst==null||rawFor===''||rawAgainst==='')continue;const pf=Number(rawFor),pa=Number(rawAgainst);if(!Number.isFinite(pf)||!Number.isFinite(pa)||pf===pa)continue;
  const key=String(row.id||row.game_id||w+'|'+[row.team_id||row.team_name,row.opponent_team_id||row.opponent_team].sort().join('|'));if(seen.has(key))continue;seen.add(key);count++;if(pf>pa)wins++;else losses++;
 }
 return baseline||count||week===0?`${wins}–${losses}`:null;
}
const api={badge,owners,record};if(typeof module==='object'&&module.exports)module.exports=api;else root.SFScorecards=api;
})(typeof window==='object'?window:globalThis);
