(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validName=name=>!!String(name||'').trim()&&!/^(coach|unknown|unassigned|cpu|computer|apple\s*review)$/i.test(String(name).trim());
function model(state,season,dynasty,activeWeek){
 const sid=String(season?.season_id||''),did=String(dynasty?.dynasty_id||'');
 const scope=g=>(!sid||!g.season_id||String(g.season_id)===sid)&&(!did||!g.dynasty_id||String(g.dynasty_id)===did);
 const source=[...(state.games||[]),...(state.scheduleGames||[])].filter(g=>scope(g)&&!g.is_bye&&g.status!=='cancelled');
 const users=new Map(),programs=(state.programs||[]).filter(scope);
 const add=(id,name,team,teamId,logo)=>{if(!id||!validName(name)||String(id)==='9d5069d5-7dd3-43cf-ae79-1adb269d3201')return null;id=String(id);if(!users.has(id))users.set(id,{id,name:String(name),team:team||'Program',teamId:teamId||null,logo:logo||null,wins:0,losses:0,results:[],series:new Map()});return users.get(id);};
 programs.forEach(p=>add(p.person_id,p.coach_name,p.team_name,p.team_id,p.logo_url||p.team_logo_url));
 source.forEach(g=>add(g.person_id,g.coach_name,g.team_name,g.team_id,g.team_logo_url));
 const same=(id,name,otherId,otherName)=>id&&otherId?String(id)===String(otherId):String(name||'').trim().toLowerCase()===String(otherName||'').trim().toLowerCase();
 const groups=new Map();
 source.forEach(g=>{const week=Number(g.week_number);if(!Number.isInteger(week)||g.week_number==null)return;const teams=[g.team_id||g.team_name,g.opponent_team_id||g.opponent_team].map(x=>String(x||'').toLowerCase()).sort();if(!teams[0]||!teams[1]||teams[0]===teams[1])return;const key=[sid||g.season_id||g.season_number||'',week,...teams].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(g);});
 const all=[];
 groups.forEach(rows=>{
  const quality=g=>g.status==='completed'&&g.points_for!=null&&g.points_against!=null?(/hq|manual|played|user/.test(String(g.source||g.result_method||''))?3:2):1;
  rows.sort((a,b)=>quality(b)-quality(a));const g=rows[0];
  function owner(id,name){const p=programs.find(p=>same(id,name,p.team_id,p.team_name)&&users.has(String(p.person_id)));if(p)return users.get(String(p.person_id));const r=rows.find(r=>same(id,name,r.team_id,r.team_name)&&users.has(String(r.person_id)));return r?users.get(String(r.person_id)):null;}
  const a=owner(g.team_id,g.team_name),b=owner(g.opponent_team_id,g.opponent_team);if(!a||!b||a.id===b.id)return;
  const pf=g.points_for==null||g.points_for===''?NaN:Number(g.points_for),pa=g.points_against==null||g.points_against===''?NaN:Number(g.points_against);
  const complete=g.status==='completed'&&Number.isFinite(pf)&&Number.isFinite(pa)&&pf>=0&&pa>=0&&pf!==pa;
  const row={g,a,b,week:Number(g.week_number),complete,scoreA:pf,scoreB:pa,winner:complete?(pf>pa?a:b):null,loser:complete?(pf>pa?b:a):null,margin:complete?Math.abs(pf-pa):null};all.push(row);
 });
 const finals=all.filter(r=>r.complete).sort((a,b)=>b.week-a.week||String(a.g.id).localeCompare(String(b.g.id)));
 finals.forEach(r=>{r.winner.wins++;r.loser.losses++;for(const [u,other] of [[r.a,r.b],[r.b,r.a]]){const won=u.id===r.winner.id;u.results.push({won,row:r});if(!u.series.has(other.id))u.series.set(other.id,{wins:0,losses:0});u.series.get(other.id)[won?'wins':'losses']++;}});
 const roster=[...users.values()].sort((a,b)=>a.name.localeCompare(b.name));
 roster.forEach(u=>{if(!u.results.length){u.streak='—';return;}const won=u.results[0].won;let n=0;for(const r of u.results){if(r.won!==won)break;n++;}u.streak=(won?'W':'L')+n;});
 const played=roster.filter(u=>u.wins+u.losses>0),ranked=[...played].sort((a,b)=>b.wins/(b.wins+b.losses)-a.wins/(a.wins+a.losses)||b.wins-a.wins);
 const top=ranked[0];const leaders=top?ranked.filter(u=>u.wins/(u.wins+u.losses)===top.wins/(top.wins+top.losses)&&u.wins===top.wins).map(u=>u.id):[];
 const upcoming=all.filter(r=>r.g.status==='scheduled'&&r.week>=Number(activeWeek||0)).sort((a,b)=>a.week-b.week);
 const moment=[...finals].sort((a,b)=>b.margin-a.margin||b.week-a.week)[0]||null;
 return {roster,finals,upcoming,leaders,moment,incomplete:all.filter(r=>r.g.status==='completed'&&!r.complete).length};
}
const api={model,esc};if(typeof module==='object'&&module.exports){module.exports=api;return;}root.SFRivalryCenter=api;
const rt=root.CDHQ_RUNTIME;if(!rt)return;
let selected=null,scopeKey=null,limit=3;
api.render=function(){
 const host=document.getElementById('rivalryLeagueCenter');if(!host)return;
 const state=rt.getState(),season=rt.getSeason(),dynasty=rt.getDynasty();if(!season||!dynasty)return;
 const key=dynasty.dynasty_id+'|'+season.season_id;if(key!==scopeKey){selected=null;limit=3;scopeKey=key;}
 const data=model(state,season,dynasty,rt.currentWeek());if(!data.roster.some(u=>u.id===selected))selected=null;
 const chosen=data.roster.find(u=>u.id===selected),finals=data.finals.filter(r=>!selected||r.a.id===selected||r.b.id===selected),next=data.upcoming.find(r=>!selected||r.a.id===selected||r.b.id===selected);
 const image=u=>{const src=u.logo||root.CDHQLogoResolver?.knownLogo?.(u.team);return src?`<img src="${esc(src)}" alt="${esc(u.team)} logo" loading="lazy">`:`<span aria-hidden="true">${esc(u.name.slice(0,1))}</span>`;};
 function validation(r){const v=r.g.h2h_validation;const person=state.myPrograms?.find(p=>String(p.season_id)===String(season.season_id))?.person_id;if(root.SFH2H?.canValidate(v,person))return `<button type="button" data-h2h-validate="${esc(r.g.id)}">Validate final</button>`;return `<small class="rc-validation ${esc(v?.status||'')}">${esc(root.SFH2H?.label(r.g,v)||'Final')}</small>`;}
 host.innerHTML=`<div class="rc-heading"><div><span class="rc-kicker">RIVALRY CENTER</span><h2>Who owns the league?</h2><p>Your record against the other users.</p></div><div class="rc-scope">${esc(dynasty.short_name||dynasty.name||'Selected league')}<small>Season ${esc(season.season_number||'')}</small></div></div><div class="rc-users">`+data.roster.map(u=>`<button type="button" class="rc-user ${data.leaders.includes(u.id)?'leader':''}" data-rc-user="${esc(u.id)}" aria-pressed="${selected===u.id}" aria-controls="rcUserDetail rcResults"><div class="rc-leader">${data.leaders.includes(u.id)?(data.leaders.length>1?'CO-LEADER':'LEADER'):'&nbsp;'}</div><div class="rc-logo">${image(u)}</div><strong>${esc(u.name)}</strong><span class="rc-team">${esc(u.team)}</span><b class="rc-record">${u.wins}–${u.losses}</b><small>vs users</small><span class="rc-streak">Streak · ${esc(u.streak)}</span></button>`).join('')+`</div>${!data.roster.length?'<div class="rc-empty">No user programs are linked to this season yet.</div>':''}<div id="rcUserDetail" class="rc-detail" ${chosen?'':'hidden'}>${chosen?`<strong>${esc(chosen.name)}</strong> · `+data.roster.filter(u=>u.id!==chosen.id).map(u=>{const s=chosen.series.get(u.id)||{wins:0,losses:0};return `vs ${esc(u.name)}: ${s.wins}–${s.losses}`;}).join(' · '):''}</div><div class="rc-section"><h3>${chosen?esc(chosen.name)+'’s user games':'User-game results'}</h3><span>${finals.length} game${finals.length===1?'':'s'}</span></div><div id="rcResults">`+finals.slice(0,limit).map(r=>`<div class="rc-result"><span class="rc-week">${esc(r.g.week_label||'Week '+r.week)}</span><div class="rc-result-copy"><strong>${esc(r.winner.name)}</strong> defeated ${esc(r.loser.name)}<small>${esc(r.g.team_name)} vs ${esc(r.g.opponent_team)}</small></div><div class="rc-score">${Math.max(r.scoreA,r.scoreB)}–${Math.min(r.scoreA,r.scoreB)}${validation(r)}</div></div>`).join('')+`${!finals.length?'<div class="rc-empty">No completed user vs user games in this view yet.</div>':''}</div>${finals.length>limit?`<button type="button" class="rc-more" data-rc-more>Show more games (${finals.length-limit} remaining)</button>`:''}${data.incomplete?`<p class="rc-data-note">${data.incomplete} user game${data.incomplete===1?'':'s'} with incomplete final scores excluded from records.</p>`:''}<div class="rc-section"><h3>Next showdown</h3><span>Scheduled user game</span></div>${next?`<button type="button" class="rc-next" data-rc-next="${next.week}"><div><small>${esc(next.g.team_name)} vs ${esc(next.g.opponent_team)}</small><strong>${esc(next.a.name)} vs ${esc(next.b.name)}</strong></div><span>${esc(next.g.week_label||'Week '+next.week)} →</span></button>`:'<div class="rc-empty rc-next-empty">No upcoming user vs user matchup is stored for this view.</div>'}${data.moment?`<aside class="rc-moment"><small>BRAGGING RIGHTS · BIGGEST STATEMENT</small><strong>${esc(data.moment.winner.name)} won by ${data.moment.margin}.</strong><p>${esc(data.moment.g.team_name)} vs ${esc(data.moment.g.opponent_team)} · ${esc(data.moment.g.week_label||'Week '+data.moment.week)} · ${Math.max(data.moment.scoreA,data.moment.scoreB)}–${Math.min(data.moment.scoreA,data.moment.scoreB)}</p></aside>`:''}<div class="rc-foot">${data.roster.length} users · Current season · User vs user games only</div>`;
 host.onclick=e=>{const b=e.target.closest('[data-rc-user],[data-rc-more],[data-rc-next]');if(!b)return;if(b.hasAttribute('data-rc-user')){selected=selected===b.dataset.rcUser?null:b.dataset.rcUser;limit=3;api.render();host.querySelector(`[data-rc-user="${CSS.escape(b.dataset.rcUser)}"]`)?.focus({preventScroll:true});}else if(b.hasAttribute('data-rc-more')){limit+=6;api.render();}else{rt.setSelectedWeek(Number(b.dataset.rcNext));rt.switchView('schedule');rt.renderSchedule();}};
};
api.render();
})(typeof window==='object'?window:globalThis);
