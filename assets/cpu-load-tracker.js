(function(root){
 'use strict';
 function audit(rows,programs,throughWeek){
  const ids=new Set((programs||[]).filter(p=>p.person_id).map(p=>String(p.team_id||'')).filter(Boolean));
  const names=new Set((programs||[]).filter(p=>p.person_id).map(p=>String(p.team_name||'').trim().toLowerCase()).filter(Boolean));
  const human=(id,name)=>ids.has(String(id||''))||names.has(String(name||'').trim().toLowerCase());
  const weeks=new Map();
  for(let w=0;w<=Math.min(99,Math.max(0,Number(throughWeek)||0));w++)weeks.set(w,{week:w,label:`Week ${w}`,games:new Map()});
  for(const g of rows||[]){
   const w=Number(g.week_number);if(g.week_number==null||!Number.isInteger(w)||!weeks.has(w))continue;
   const bucket=weeks.get(w);if(g.week_label)bucket.label=g.week_label;
   if(g.is_bye||g.status==='cancelled'||g.person_id||g.opponent_person_id||human(g.team_id,g.team_name)||human(g.opponent_team_id,g.opponent_team))continue;
   const key=String(g.id||g.game_id||[g.team_id||g.team_name,g.opponent_team_id||g.opponent_team].sort().join('|'));
   const score=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))&&Number(x)>=0;
   const complete=g.status==='completed'&&score(g.points_for??g.home_score)&&score(g.points_against??g.away_score);
   const prior=bucket.games.get(key);if(!prior||complete)bucket.games.set(key,{...g,complete});
  }
  return [...weeks.values()].map(w=>{const games=[...w.games.values()],missing=games.filter(g=>!g.complete);return {week:w.week,label:w.label,total:games.length,loaded:games.length-missing.length,missing,status:!games.length?'verify':missing.length?'missing':'loaded'};});
 }
 const api={audit};if(typeof module==='object'&&module.exports)module.exports=api;else root.SFCPULoadTracker=api;
})(typeof window==='object'?window:globalThis);
