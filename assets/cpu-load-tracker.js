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
  const rows=audit(context.rows,context.programs,context.week),attention=rows.filter(w=>w.status!=='loaded');
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scope=String(context.scope||'');
  const key=scope+'|'+context.week;
  let selected=el.dataset.cpuScope===key?Number(el.dataset.cpuSelected):NaN;
  if(!rows.some(w=>w.week===selected))selected=(attention[0]||rows[rows.length-1])?.week;
  el.dataset.cpuScope=key;
  const style=`<style>.cpu-week-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:7px;margin:14px 0}.cpu-week-tile{min-height:70px;border:1px solid #94a3b840;border-radius:9px;background:#0a1720;color:#b9c6cf;padding:8px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}.cpu-week-tile strong{font-size:14px}.cpu-week-tile small{font-size:10px}.cpu-week-tile.loaded{border-color:#34d39950;color:#6ee7b7;background:#34d3990a}.cpu-week-tile.missing{border-color:#fbbf2460;color:#fcd34d;background:#fbbf240d}.cpu-week-tile[aria-pressed="true"]{outline:2px solid #e6c780;outline-offset:2px}.cpu-week-tile:focus-visible{outline:2px solid white;outline-offset:2px}.cpu-tracker-summary{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#b5c5cc}.cpu-tracker-summary b{color:#e6c780}.cpu-week-detail{border-top:1px solid #c7a45a30;padding-top:12px}.cpu-week-detail h4{font-size:16px;margin:0 0 7px}.cpu-missing-list{max-height:210px;overflow:auto;padding-left:20px;font-size:13px;color:#b5c5cc}.cpu-missing-list li{margin:7px 0}.cpu-week-detail p{font-size:12px}.cpu-tracker-note{font-size:11px!important;margin:12px 0 0!important;color:#91a7b2}</style>`;
  el.innerHTML=style+`<div class="kicker">COMPUTER SIMULATED GAMES</div><h3>CPU Results to Load</h3><p>${esc(scope)}</p><div class="cpu-tracker-summary"><span><b>${rows.filter(w=>w.status==='missing').length}</b> weeks missing results</span><span><b>${rows.filter(w=>w.status==='verify').length}</b> to verify</span><span><b>${rows.filter(w=>w.status==='loaded').length}</b> loaded</span></div><div class="cpu-week-grid" aria-label="CPU results by week">`+rows.map(w=>`<button type="button" class="cpu-week-tile ${w.status}" data-cpu-week="${w.week}" aria-pressed="false" aria-label="${esc(w.label)}: ${w.status==='loaded'?'loaded':w.status==='missing'?w.missing.length+' missing results':'needs verification'}"><strong>${esc(w.label.replace(/^Week /,'W'))}</strong><small>${w.status==='loaded'?'✓ Loaded':w.status==='missing'?w.missing.length+' missing':'? Verify'}</small></button>`).join('')+`</div><div class="cpu-week-detail"></div><p class="cpu-tracker-note">Week 0 through active week · CPU vs CPU only. Verify weeks with no stored schedule; absent matchups cannot be detected.</p>`;
  function select(week){
   const w=rows.find(w=>w.week===week);if(!w)return;el.dataset.cpuSelected=String(week);
   el.querySelectorAll('[data-cpu-week]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cpuWeek)===week)));
   el.querySelector('.cpu-week-detail').innerHTML=`<h4>${esc(w.label)}${w.week===Number(context.week)?' · Current week':''}</h4>`+(w.status==='verify'?'<p>No CPU matchups stored. Verify the schedule and results import.</p>':w.missing.length?`<p>${w.loaded}/${w.total} stored matchups loaded · ${w.missing.length} final results needed</p><ul class="cpu-missing-list">`+w.missing.map(g=>`<li>${esc(g.team_name||'TBD')} vs ${esc(g.opponent_team||'TBD')}</li>`).join('')+'</ul>':'<p>✓ All '+w.total+' stored CPU matchups have final scores.</p>');
  }
  el.onclick=e=>{const b=e.target.closest('[data-cpu-week]');if(b&&el.contains(b))select(Number(b.dataset.cpuWeek));};
  select(selected);
 }
 const api={audit,render};if(typeof module==='object'&&module.exports)module.exports=api;else root.SFCPULoadTracker=api;
})(typeof window==='object'?window:globalThis);
