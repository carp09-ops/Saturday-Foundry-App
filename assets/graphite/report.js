/* Preview report: fact-based candidates, shared commissioner choices, prepared artwork. */
let reportControl={key:'',rows:[],ready:false},reportRead=null,reportLastRead=0,reportError='',reportArticle=null;
function reportSelection(){const c=reportControl.key===context()?reportControl.rows.find(r=>Number(r.week_number)===Number(week)):null;return FoundryReport.build({games:games(),programs:model.programs,rankings:model.rankings,week,h2h:h2hMeta,curation:c||{}})}
function reportAction(s){return s.game_id?`openGame('${uid(s.game_id)}')`:`go('rankings')`}
function reportVisual(s){const art=teamArtworkEntry(s.team_id),color=teamArtworkColor(s.team_id);return `<div class="report-art ${art?'':'report-art-mark'}" style="--team-tone:${color}">${art?`<img src="${esc(art.image_url)}" alt="${esc(art.alt_text||s.team+' helmet editorial artwork')}" onerror="reportArtworkFailed(this)">`:''}<div class="report-art-logo ${art?'art-logo-small':''}">${logo(s.team_id)}</div>${s.streak?`<strong class="report-number" aria-label="${s.streak} consecutive wins">${s.streak}</strong>`:s.rank?`<strong class="report-number">${s.rank}<small>TOP 25</small></strong>`:''}<span class="art-credit">${art?'EDITORIAL ART':'THE SATURDAY REPORT'}</span></div>`}
function reportScore(s){const g=s.game;if(!g||s.type==='preview')return '';return `<div class="report-score"><span>${logo(g.awayId)}<b>${esc(g.away)}</b><strong>${g.a}</strong></span><small>FINAL${g.overtime?' · OT':''}</small><span><strong>${g.h}</strong><b>${esc(g.home)}</b>${logo(g.homeId)}</span></div>`}
function reportFeature(s){if(s.type==='preview')return reportMatchup(s,true);return `<article class="report-feature">${reportVisual(s)}<div class="report-copy"><span class="eyebrow">WEEK ${s.week} · ${esc(s.kicker)}</span><h2>${esc(s.headline)}</h2><p>${esc(s.fact)}</p>${reportScore(s)}<button class="report-link" onclick="${reportAction(s)}">${s.game_id?'View game':'View Top 25'} →</button></div></article>`}
function reportMatchup(s,lead=false){const g=s.game;return `<article class="report-matchup ${lead?'matchup-feature':''}"><div class="matchup-mark away" style="--team-tone:${teamArtworkColor(g.awayId,'#293546')}">${logo(g.awayId)}</div><div class="matchup-copy"><span class="eyebrow">${esc(s.kicker)}</span><h3>${esc(s.headline)}</h3><p>${esc(s.fact)}</p><small>${esc(s.coach||'')}</small><button class="report-link" onclick="${reportAction(s)}">Matchup details →</button></div><div class="matchup-mark home" style="--team-tone:${teamArtworkColor(g.homeId,'#343434')}">${logo(g.homeId)}</div></article>`}
function reportSupporting(s){return `<button class="report-brief" onclick="${reportAction(s)}"><span class="brief-mark">${s.rank?`<strong>#${s.rank}</strong>`:logo(s.team_id)}</span><span><small class="eyebrow">${esc(s.kicker)}</small><strong>${esc(s.headline)}</strong><small>${esc(s.fact)}</small></span>${ico('arrow')}</button>`}
function reportStatus(rows){if(!rows.length)return '';return `<div class="report-status"><span class="eyebrow">LEAGUE STATUS</span>${rows.slice(0,3).map(({game:g,label})=>`<button onclick="openGame('${uid(g.id)}')"><span>${esc(g.away)} at ${esc(g.home)}<small>${esc(label)}</small></span>${ico('arrow')}</button>`).join('')}${rows.length>3?button('All scores','scores','textlink'):''}</div>`}
function reportSection(full=false){const r=reportSelection();return `<section id="saturdayReport" class="saturday-report" aria-label="The Saturday report"><div class="sectionhead"><h2>The Saturday report</h2>${full?'':`<button onclick="go('stories')">All stories →</button>`}</div><div class="report-edition"><span>${esc(dynasty.name)} · Week ${week}</span>${canManage()?'<button class="textlink" onclick="openReportEditor()">Edit report</button>':''}</div>${reportError?'<p class="sport-note" role="status">Report refresh is unavailable. Showing the last loaded data.</p>':''}${r.lead?reportFeature(r.lead):empty('Your next story starts with a scheduled matchup or a recorded result.')}<div class="report-briefs">${r.supporting.map(reportSupporting).join('')}</div>${full&&r.next.length?`<h3 class="report-next-title">Next up</h3>${r.next.map(s=>reportMatchup(s)).join('')}`:''}${reportStatus(r.pending)}${full?`<h3 class="report-next-title">More from this edition</h3>${r.available.filter(s=>![r.lead?.id,...r.supporting.map(x=>x.id),...r.next.map(x=>x.id)].includes(s.id)).map(reportSupporting).join('')||'<p class="sport-note">You’re caught up.</p>'}`:''}</section>`}
homeReport=()=>reportSection();
const reportPriorContent=content;
content=function(){if(route==='stories')return reportSection(true);if(route==='article'&&reportArticle){const s=reportSelection().available.find(s=>s.id===reportArticle);return s?reportFeature(s):empty('This story has changed. Return to the report for the latest edition.')}return reportPriorContent()};
function openReportEditor(){if(!canManage())return;const r=reportSelection(),saved=reportControl.rows.find(x=>Number(x.week_number)===Number(week))||{};openSheet('Edit the Saturday report',`<p>Week ${week} · Shared with everyone in this league. Pins expire when the week changes or the story no longer qualifies.</p>${!reportControl.ready?'<p role="alert">Editorial controls could not load. Close this panel and refresh the report.</p>':`<form data-report-editor onsubmit="event.preventDefault()"><p id="reportEditorMessage" role="alert"></p><button class="secondary" onclick="saveReportChoice('auto','',this.form)">Use automatic lead</button>${r.candidates.map(s=>`<div class="editor-story"><strong>${esc(s.headline)}</strong><small>${esc(s.kicker)} · Week ${s.week}${saved.pinned_id===s.id?' · Pinned':''}${saved.hidden_ids?.includes(s.id)?' · Hidden':''}</small><div>${saved.hidden_ids?.includes(s.id)?`<button onclick="saveReportChoice('restore','${s.id}',this.form)">Restore</button>`:`<button onclick="saveReportChoice('pin','${s.id}',this.form)">${saved.pinned_id===s.id?'Pinned':'Feature this'}</button><button onclick="saveReportChoice('hide','${s.id}',this.form)">Hide</button>`}</div></div>`).join('')||'<p>No eligible stories yet.</p>'}</form>`}`)}
async function saveReportChoice(action,id,form){if(!canManage()||!reportControl.ready)return;const saved=reportControl.rows.find(x=>Number(x.week_number)===Number(week)),key=context();await writeAction('set_preview_report_story',{p_season_id:season.season_id,p_week:week,p_action:action,p_story_id:id||null,p_revision:saved?.revision||0},form,async row=>{if(key!==context())return;reportControl.rows=reportControl.rows.filter(x=>Number(x.week_number)!==Number(week));reportControl.rows.push(row);closeSheet();notice='The league report has been updated.';render()})}
WRITE_RPC.add('set_preview_report_story');ALLOWED_RPC.add('set_preview_report_story');
async function loadReportControls(){const key=context(),serial=loadSerial;reportControl={key,rows:[],ready:false};try{const rows=await read('preview_report_curation',`season_id=eq.${uid(season.season_id)}&order=week_number.desc`);if(key!==context()||serial!==loadSerial)return;reportControl={key,rows,ready:true};refreshReportMarkup()}catch{}}
function refreshReportMarkup(){if(mutationPending||busy||$('detailSheet')?.open||document.querySelector('#mainContent form'))return;const host=$('saturdayReport');if(host)host.outerHTML=reportSection(route==='stories')}
const reportSeasonLoaded=afterSeasonLoaded;
afterSeasonLoaded=async function(){reportError='';reportLastRead=Date.now();loadTeamArtwork();loadReportControls();return reportSeasonLoaded()};
async function refreshReport(force=false){if(!season||!session()?.access_token||busy||mutationPending||document.hidden||!['home','stories'].includes(route)||$('detailSheet')?.open||(!force&&Date.now()-reportLastRead<60000))return;loadTeamArtwork();if(reportRead)return reportRead;const key=context(),serial=loadSerial,d=uid(dynasty.dynasty_id),s=uid(season.season_id);reportLastRead=Date.now();reportRead=(async()=>{try{const [schedule,rankings,controls,h2h,activeWeek]=await Promise.all([read('v_schedule_entries',`dynasty_id=eq.${d}&season_id=eq.${s}&order=week_number.asc,id.asc,team_id.asc`),read('weekly_rankings',`dynasty_id=eq.${d}&season_id=eq.${s}&poll_type=eq.top25&order=week_number.desc,rank.asc`),read('preview_report_curation',`season_id=eq.${s}&order=week_number.desc`),readRpc('get_h2h_results',{p_dynasty_id:d,p_season_id:s}),season.is_active?readRpc('get_dynasty_active_week',{p_dynasty_id:d}):Promise.resolve(week)]);if(key!==context()||serial!==loadSerial||mutationPending||busy)return;model.scheduleGames=schedule;model.rankings=rankings;reportControl={key,rows:controls,ready:true};h2hMeta=h2h?.ready?h2h:{ready:false,results:[]};if(activeWeek!=null)week=num(activeWeek);reportError='';if(!['home','stories'].includes(route)||$('detailSheet')?.open||document.querySelector('#mainContent form'))return;const top=$('screenViewport')?.scrollTop;render();if($('screenViewport'))$('screenViewport').scrollTop=top||0}catch(e){if(key===context()&&serial===loadSerial){reportError=e.message;refreshReportMarkup()}}finally{reportRead=null}})();return reportRead}
setInterval(()=>refreshReport(),60000);
window.addEventListener('focus',()=>refreshReport());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshReport()});

/* Bottom Line ticker: league-wide scores, headlines, coach carousel and
   standings snapshots for the standalone ribbon. Every section is guarded:
   a ticker failure must never break rendering, so any error falls back to
   the static brand line. */
function tickerItems(){
 const items=[];
 try{ /* Latest finals across the whole league, user and CPU teams alike. */
  const gs=(typeof games==='function'?games():[])||[];
  const finals=gs.filter(g=>g&&!g.is_bye&&g.final&&Number.isFinite(Number(g.a))&&Number.isFinite(Number(g.h)));
  if(finals.length){
   const wk=Math.max(...finals.map(g=>Number(g.week_number)||0));
   const users=new Set((model.programs||[]).filter(p=>p.person_id).map(p=>String(p.team_id)));
   const heat=g=>((users.has(String(g.awayId))||users.has(String(g.homeId)))?2:0)+(['national_championship','conference_championship','playoff','cfp'].includes(g.game_type)?1:0);
   const rows=finals.filter(g=>Number(g.week_number)===wk).sort((x,y)=>heat(y)-heat(x));
   for(const g of rows.slice(0,10))items.push({k:'Final',t:`${g.away} ${g.a}, ${g.home} ${g.h}${g.overtime?' · OT':''}`});
  }
 }catch(e){}
 try{ /* Saturday Report headlines and next matchups. */
  const r=reportSelection();
  for(const s of (r.available||[]).filter(s=>s.type!=='preview').slice(0,5))items.push({k:s.kicker,t:s.headline});
  for(const s of (r.next||[]).slice(0,2)){const g=s.game;if(g)items.push({k:'Next up',t:`${g.away} at ${g.home} · Week ${g.week_number}`})}
 }catch(e){}
 try{ /* Coach carousel: a current assignment that follows a different program. */
  const byCoach=new Map();
  for(const s of (model.stops||[])){if(!s||!s.person_id)continue;if(!byCoach.has(s.person_id))byCoach.set(s.person_id,[]);byCoach.get(s.person_id).push(s)}
  const names=new Map((model.programs||[]).filter(p=>p.person_id).map(p=>[String(p.person_id),p.coach_name]));
  for(const [pid,stops] of byCoach){
   const sorted=[...stops].sort((a,b)=>Number(b.season_number)-Number(a.season_number));
   const cur=sorted.find(s=>s.current_assignment)||sorted[0];
   if(!cur||!names.get(String(pid)))continue;
   const prev=sorted.find(s=>String(s.team_id)!==String(cur.team_id));
   if(prev&&Number(cur.season_number)>Number(prev.season_number))items.push({k:'Coach carousel',t:`${names.get(String(pid))} takes over at ${cur.team_name}`});
  }
 }catch(e){}
 try{ /* Conference leaders snapshot. */
  const cm=conferenceModel(model),byConf=new Map();
  for(const t of (cm.teams||[])){if(!t||!t.conf)continue;if(!byConf.has(t.conf))byConf.set(t.conf,[]);byConf.get(t.conf).push(t)}
  for(const conf of [...byConf.keys()].sort()){
   const lead=[...byConf.get(conf)].sort(cm.sortRows||((a,b)=>b.w-a.w||b.cw-a.cw))[0];
   if(lead&&(lead.w>0||lead.l>0))items.push({k:conf,t:`${lead.name} ${lead.w}–${lead.l} leads the way`});
  }
 }catch(e){}
 return items.slice(0,22);
}
const sfTicker={items:[],idx:0,timer:null,swap:null};
function tickerCardHTML(it){return `<b>${esc(it.k)}</b><span class="sf-tk-view"><span class="sf-tk-inner">${esc(it.t)}</span></span>`}
function tickerFit(){
 const card=document.querySelector('.sf-bottom-ribbon .sf-ticker-card');
 if(!card)return;
 const view=card.querySelector('.sf-tk-view'),inner=card.querySelector('.sf-tk-inner');
 if(!view||!inner)return;
 card.classList.remove('sf-tick-scroll');
 card.style.removeProperty('--sf-tick-shift');
 card.style.removeProperty('--sf-tick-dur');
 let size=10;card.style.fontSize=size+'px';
 while(inner.scrollWidth>view.clientWidth&&size>8){size-=0.5;card.style.fontSize=size+'px'}
 if(inner.scrollWidth<=view.clientWidth)return;
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 card.style.fontSize='9px';
 card.classList.add('sf-tick-scroll');
 const shift=inner.scrollWidth-view.clientWidth+6;
 if(shift<=0){card.classList.remove('sf-tick-scroll');return}
 card.style.setProperty('--sf-tick-shift',shift+'px');
 card.style.setProperty('--sf-tick-dur',Math.min(4.4,Math.max(2.2,shift/75)).toFixed(2)+'s');
}
function tickerStep(){
 const card=document.querySelector('.sf-bottom-ribbon .sf-ticker-card');
 if(!card||sfTicker.items.length<2||document.hidden)return;
 sfTicker.idx=(sfTicker.idx+1)%sfTicker.items.length;
 const next=sfTicker.items[sfTicker.idx];
 if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches){card.innerHTML=tickerCardHTML(next);tickerFit();return}
 card.classList.add('sf-tick-out');
 clearTimeout(sfTicker.swap);
 sfTicker.swap=setTimeout(()=>{const c=document.querySelector('.sf-bottom-ribbon .sf-ticker-card');if(c){c.innerHTML=tickerCardHTML(next);c.classList.remove('sf-tick-out');tickerFit()}},290);
}
function tickerInner(){
 const tag='Your dynasty, forged on Saturdays';
 let items=[];
 try{items=tickerItems()}catch(e){items=[]}
 if(!items.length)return `<span class="sf-bottom-ribbon-mark" aria-hidden="true">SF</span><span class="sf-bottom-ribbon-text">${tag}</span>`;
 items.push({k:'Saturday Foundry',t:tag});
 sfTicker.items=items;
 if(sfTicker.idx>=items.length)sfTicker.idx=0;
 clearInterval(sfTicker.timer);
 sfTicker.timer=items.length>1?setInterval(tickerStep,5000):null;
 setTimeout(()=>{try{tickerFit()}catch(e){}},60);
 return `<span class="sf-ticker-brand" aria-hidden="true"><img class="sf-ticker-logo" src="${BRAND_ASSET}foundry-shield.webp" alt=""><span class="sf-ticker-brand-text">The Line</span></span><span class="sf-ticker-stage" aria-hidden="true"><span class="sf-ticker-card">${tickerCardHTML(items[sfTicker.idx])}</span></span>`;
}
