/* Keep the visual aligned with the card's away-left / home-right orientation. */
(function(root){
 'use strict';
 function model(game,perspective){
  const raw=perspective?.teamWinProbability;
  if(raw==null||raw===''||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>1)return null;
  const teamPct=Math.round(Number(raw)*100),away=game.home_away==='away';
  const left={name:away?game.team_name:game.opponent_team,pct:away?teamPct:100-teamPct};
  const right={name:away?game.opponent_team:game.team_name,pct:100-left.pct};
  return {left,right,markerPct:right.pct,favorite:left.pct===right.pct?null:left.pct>right.pct?left:right};
 }
 const api={model};if(typeof module==='object'&&module.exports)module.exports=api;else root.SFVegasProbability=api;
})(typeof window==='object'?window:globalThis);
function sfVegasBarMarkup(game,perspective){
 const data=window.SFVegasProbability.model(game,perspective);if(!data)return '';
 const color=name=>{const program=(state.programs||[]).find(p=>String(p.team_name).toLowerCase()===String(name).toLowerCase());const value=window.sfTeamColor?.(name)||program?.primary_color;return /^#[\da-f]{3,8}$/i.test(value||'')?value:'#526773';};
 const leftColor=color(data.left.name),rightColor=color(data.right.name),favorite=data.favorite;
 const logo=favorite?logoFor(favorite.name):'assets/saturday-foundry-shield.webp';
 const caption=favorite?`${favorite.name} favored · ${favorite.pct}% win chance`:'Even matchup · 50% each';
 const accessible=`Dynasty Vegas win probability: ${data.left.name} ${data.left.pct} percent; ${data.right.name} ${data.right.pct} percent. ${caption}.`;
 // A native SVG helmet keeps the team mark crisp and uses the existing logo resolver.
 const helmet=`<span class="sf-vegas-helmet" style="--sf-helmet-color:${favorite?color(favorite.name):'#725d36'}" title="${esc(caption)}"><svg viewBox="0 0 52 44" aria-hidden="true"><path class="sf-helmet-shell" d="M5 26V20C5 10 12 4 23 4c12 0 21 7 22 18l-9 1-3 9H20c-8 0-15-2-15-6Z"/><path class="sf-helmet-shine" d="M10 17C12 10 17 8 24 8"/><path class="sf-helmet-mask" d="m36 24 10 2 2 12H32l-4-7m10-6 1 13m-6-8h14"/><circle cx="30" cy="26" r="3" fill="#d8d5cc"/></svg>${logo?`<span class="sf-helmet-logo" style="background-image:url(&quot;${esc(logo)}&quot;)"></span>`:''}</span>`;
 return `<div class="gotw-prob-wrap sf-vegas-probability" role="img" aria-label="${esc(accessible)}" style="--sf-away-color:${leftColor};--sf-home-color:${rightColor};--sf-prob-split:${data.left.pct}%;--sf-marker-position:${data.markerPct}%">
  <div class="sf-vegas-prob-meta" aria-hidden="true"><span>${esc(data.left.name)} <b>${data.left.pct}%</b></span><span>${esc(data.right.name)} <b>${data.right.pct}%</b></span></div>
  <div class="sf-vegas-prob-track" aria-hidden="true"><div class="sf-vegas-prob-bar"><span class="sf-vegas-segment-left"></span><span class="sf-vegas-segment-right"></span></div><span class="sf-vegas-prob-marker">${helmet}</span></div>
  <div class="gotw-prob-labels"><span>DYNASTY VEGAS <i>·</i> WIN PROBABILITY</span><small>${esc(caption)}</small></div>
 </div>`;
}
