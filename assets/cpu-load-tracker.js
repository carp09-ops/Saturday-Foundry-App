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
 function render(el,context){
  const rows=audit(context.rows,context.programs,context.week);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scope=String(context.scope||'');
  const style=`<style>.cpu-week-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:7px;margin:14px 0}.cpu-week-tile{min-height:70px;border:1px solid #94a3b840;border-radius:9px;background:#0a1720;color:#b9c6cf;padding:8px 4px;display:flex;flex-direction:column;align-items:center;gap:4px}.cpu-week-tile strong{font-size:14px}.cpu-week-tile small{font-size:10px}.cpu-week-tile.loaded{border-color:#34d39950;color:#6ee7b7;background:#34d3990a}.cpu-week-tile.missing{border-color:#fbbf2460;color:#fcd34d;background:#fbbf240d}.cpu-tracker-summary{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#b5c5cc}.cpu-tracker-summary b{color:#e6c780}.cpu-tracker-note{font-size:11px!important;margin:12px 0 0!important;color:#91a7b2}</style>`;
  el.innerHTML=style+`<div class="kicker">COMPUTER SIMULATED GAMES</div><h3>CPU Results to Load</h3><p>${esc(scope)}</p><div class="cpu-tracker-summary"><span><b>${rows.filter(w=>w.status==='missing').length}</b> weeks missing results</span><span><b>${rows.filter(w=>w.status==='verify').length}</b> to verify</span><span><b>${rows.filter(w=>w.status==='loaded').length}</b> loaded</span></div><div class="cpu-week-grid" aria-label="CPU results by week">`+rows.map(w=>`<div class="cpu-week-tile ${w.status}" aria-label="${esc(w.label)}: ${w.status==='loaded'?'loaded':w.status==='missing'?w.missing.length+' missing results':'needs verification'}"><strong>${esc(w.label.replace(/^Week /,'W'))}</strong><small>${w.status==='loaded'?'✓ Loaded':w.status==='missing'?w.missing.length+' missing':'? Verify'}</small></div>`).join('')+`</div><p class="cpu-tracker-note">Week 0 through active week · CPU vs CPU only. Verify weeks with no stored schedule; absent matchups cannot be detected.</p>`;

 }
 const api={audit,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.SFCPULoadTracker=api;
})(typeof window==='object'?window:globalThis);
