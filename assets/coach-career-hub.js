/* Saturday Foundry QA 9.9.3 — authenticated coach career landing. */
let sfCareerHubData=null;
let sfCareerRequest=0;
function sfEditionYear(value){const digits=String(value||'').replace(/\D/g,'');const n=Number(digits);return n>0&&n<100?2000+n:n;}
function sfActiveDynasties(rows,edition){return (Array.isArray(rows)?rows:[]).filter(d=>String(d.status).toLowerCase()==='active'&&sfEditionYear(d.game_edition)===Number(edition));}
function sfCareerRecord(row){return `${Number(row.wins||0)}–${Number(row.losses||0)}${Number(row.ties)?`–${Number(row.ties)}`:''}`;}
function sfCareerMetric(value,label){return `<div class="sf-career-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;}
function sfCareerBadge(chapter){return chapter.retired?'<span class="sf-career-retired">RETIRED</span>':chapter.status==='archived'?'<span class="sf-career-archive">ARCHIVE</span>':'';}
function sfRenderCareerHub(hub){
 const host=document.getElementById('sfCareerHub');if(!host)return;
 sfCareerHubData=hub;
 if(!hub?.coach){host.innerHTML='<div class="sf-career-panel"><h3>Your career starts here</h3><p>Join a dynasty and claim your coach to start building your legacy.</p></div>';return;}
 const coach=hub.coach,t=hub.totals||{},key=coachCardKey(coach.name),portrait=COACH_CARD_PORTRAITS[key]||coach.avatar_url||'assets/saturday-foundry-shield.webp';
 const editions=hub.editions||[],chapters=hub.chapters||[],timeline=hub.timeline||[],honors=hub.honors||[],facts=hub.facts||[];
 const teamRecords=new Map();
 for(const stop of timeline){const teamKey=String(stop.team_id||stop.team_name);if(!teamRecords.has(teamKey))teamRecords.set(teamKey,{name:stop.team_name,logo:stop.logo_url,wins:0,losses:0,editions:new Set(),seasons:new Set()});const team=teamRecords.get(teamKey);team.wins+=Number(stop.wins||0);team.losses+=Number(stop.losses||0);team.editions.add(stop.game_edition_year);team.seasons.add(stop.season_id);}
 const coachedTeams=[...teamRecords.values()].sort((a,b)=>(b.wins+b.losses)-(a.wins+a.losses)||a.name.localeCompare(b.name));
 const factRows=kind=>facts.filter(f=>f.kind===kind).map(f=>`<li><b>${esc(f.recipient_name||f.label)}</b><span>${esc(f.label)}${f.value!=null?` · ${kind==='draft_pick'?'Round ':''}${esc(f.value)}`:''}${kind==='draft_pick'&&f.metadata?.pick?` · Pick ${esc(f.metadata.pick)}`:''}</span><small>CFB ${esc(f.game_edition_year)} · ${esc(f.year)} season</small></li>`).join('');
 const wins=Number(t.wins||0),losses=Number(t.losses||0),ties=Number(t.ties||0),gp=wins+losses+ties;
 host.innerHTML=`<article class="sf-career-card"><div class="sf-career-portrait"><img src="${esc(portrait)}" alt="Coach ${esc(coach.name)}" decoding="async"></div><div class="sf-career-card-body"><span class="sf-career-kicker">YOUR ALL-TIME LEGACY</span><h3>Coach ${esc(coach.name)}</h3><p>${esc(COACH_CARD_IDENTITIES[key]?.archetype||'Building a legacy')} · Every league. Every edition.</p><div class="sf-career-metrics">${sfCareerMetric(sfCareerRecord(t),'Career record')}${sfCareerMetric(t.national_titles||0,'National titles')}${sfCareerMetric(t.conference_titles||0,'Conference titles')}${sfCareerMetric(t.heismans||0,'Heismans')}</div><a class="sf-career-profile-link" href="#sfCareerProfile" data-career-expand>Explore your career ↓</a></div></article>
 <div class="sf-career-edition-head"><h3>Edition over edition</h3><span>Recorded career totals</span></div><div class="sf-career-editions">${editions.map(e=>`<article class="sf-career-edition"><span>COLLEGE FOOTBALL ${esc(e.game_edition_year)}</span><b>${esc(sfCareerRecord(e))}</b><p>${esc(e.national_titles)} national · ${esc(e.conference_titles)} conference · ${esc(e.heismans)} Heismans</p></article>`).join('')||'<p>No completed games recorded yet.</p>'}</div>
 <details id="sfCareerProfile" class="sf-career-profile"><summary>Full career profile <span>Journey · Honors · Draft · Stats</span></summary><div class="sf-career-profile-body"><p class="sf-career-note">Totals include verified, completed user games. Seasons still in progress are included; missing scores are omitted from scoring averages. Awards reflect the honors recorded in each league.</p><div class="sf-career-metrics sf-career-extra">${sfCareerMetric(gp?`${((wins+ties/2)/gp*100).toFixed(1)}%`:'N/A','Win percentage')}${sfCareerMetric(t.draft_picks||0,'Draft picks')}${sfCareerMetric(t.awards||0,'Player / coach awards')}${sfCareerMetric(t.seasons||0,'Seasons')}${sfCareerMetric(`${t.bowl_wins||0}–${t.bowl_losses||0}`,'Bowl record')}${sfCareerMetric(`${t.playoff_wins||0}–${t.playoff_losses||0}`,'Playoff record')}${sfCareerMetric(t.scored_games?((t.points_for||0)/t.scored_games).toFixed(1):'N/A','Points per game')}${sfCareerMetric(t.scored_games?((t.points_against||0)/t.scored_games).toFixed(1):'N/A','Points allowed')}</div>
 <details open class="sf-career-team-records"><summary>Teams coached &amp; records (${coachedTeams.length})</summary><ul class="sf-career-journey">${coachedTeams.map(team=>`<li>${team.logo?`<img src="${esc(team.logo)}" alt="" loading="lazy">`:''}<div><b>${esc(team.name)}</b><span>${esc(team.seasons.size)} seasons · ${[...team.editions].sort((a,b)=>b-a).map(e=>`CFB ${esc(e)}`).join(' / ')}</span></div><strong>${esc(sfCareerRecord(team))}</strong></li>`).join('')||'<li>No teams recorded yet.</li>'}</ul></details>
 <h4>League chapters</h4><div class="sf-career-chapters">${chapters.map(c=>`<article><div><b>${esc(c.dynasty_name)}</b>${sfCareerBadge(c)}</div><p>CFB ${esc(c.game_edition_year)} · ${esc(sfCareerRecord(c))} · ${esc(c.national_titles)} national titles</p></article>`).join('')}</div>
 <details open><summary>Coaching journey</summary><ol class="sf-career-journey">${timeline.map(s=>`<li>${s.logo_url?`<img src="${esc(s.logo_url)}" alt="" loading="lazy">`:''}<div><b>${esc(s.team_name)}</b><span>${esc(s.dynasty_name)} · CFB ${esc(s.game_edition_year)} · ${esc(s.year)} season</span></div><strong>${esc(sfCareerRecord(s))}</strong></li>`).join('')||'<li>No assignments recorded.</li>'}</ol></details>
 <details><summary>Honors &amp; championships (${honors.length})</summary><ul class="sf-career-facts">${honors.map(a=>`<li><b>${esc(a.name||String(a.type).replace(/_/g,' '))}</b><span>${esc(a.recipient_name||a.player_name||a.team_name||'')}</span><small>CFB ${esc(a.game_edition_year)} · ${esc(a.year)} season</small></li>`).join('')||'<li>No honors recorded yet.</li>'}</ul></details>
 <details><summary>Draft history (${facts.filter(f=>f.kind==='draft_pick').length})</summary><ul class="sf-career-facts">${factRows('draft_pick')||'<li>No draft picks recorded yet.</li>'}</ul></details>
 <details><summary>Statistical leaders (${facts.filter(f=>f.kind==='stat_leader').length})</summary><ul class="sf-career-facts">${factRows('stat_leader')||'<li>No statistical leaders recorded yet.</li>'}</ul></details></div></details>`;
 host.querySelector('[data-career-expand]')?.addEventListener('click',e=>{e.preventDefault();const profile=host.querySelector('#sfCareerProfile');profile.open=true;profile.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
}
async function sfLoadCareerHub(silent=false){
 const request=++sfCareerRequest,host=document.getElementById('sfCareerHub');if(!host)return;
 if(!silent)host.innerHTML='<div class="sf-career-panel" role="status">Forging your career profile…</div>';
 try{const hub=await Data.careerHub();if(request===sfCareerRequest){if(JSON.stringify(hub)!==JSON.stringify(sfCareerHubData)||!host.querySelector('.sf-career-card')){const expanded=[...host.querySelectorAll('details')].map(d=>d.open);sfRenderCareerHub(hub);if(silent)host.querySelectorAll('details').forEach((d,i)=>{if(i<expanded.length)d.open=expanded[i];});}sfCareerSyncLabel(sfCareerSocket?.readyState===1?'Live updates connected':'Auto-refresh active');}}
 catch(error){if(request!==sfCareerRequest)return;if(silent){sfCareerSyncLabel('Connection interrupted · retrying automatically');return;}host.innerHTML='<div class="sf-career-panel" role="status"><p>Your career profile could not load. Your dynasties are still available below.</p><button class="dynasty-chooser-action" type="button">Retry career profile</button></div>';host.querySelector('button').onclick=sfLoadCareerHub;console.warn('Career profile unavailable:',error);}
}
// Private notifications contain no game/coach data; always re-read through the authenticated RPC.
let sfCareerSocket=null,sfCareerHeartbeat=null,sfCareerFallback=null,sfCareerReconnect=null,sfCareerDebounce=null;
let sfCareerLiveGeneration=0,sfCareerRefreshing=false,sfCareerRefreshAgain=false;
function sfCareerSyncLabel(text){const label=document.getElementById('sfCareerSync');if(label)label.textContent=text;}
function sfCareerIsVisible(){return document.visibilityState!=='hidden'&&document.body.classList.contains('dynasty-chooser-active')&&!!session()?.access_token;}
function sfStopCareerLive(){
 sfCareerLiveGeneration++;sfCareerRequest++;sfCareerRefreshing=false;sfCareerRefreshAgain=false;
 clearInterval(sfCareerHeartbeat);clearInterval(sfCareerFallback);clearTimeout(sfCareerReconnect);clearTimeout(sfCareerDebounce);
 sfCareerHeartbeat=sfCareerFallback=sfCareerReconnect=sfCareerDebounce=null;
 if(sfCareerSocket){const socket=sfCareerSocket;sfCareerSocket=null;socket.onclose=null;socket.close();}
}
async function sfRefreshCareerLanding(){
 if(!sfCareerIsVisible())return;
 if(sfCareerRefreshing){sfCareerRefreshAgain=true;return;}
 const generation=sfCareerLiveGeneration;sfCareerRefreshing=true;
 try{const rows=await Data.dynasties();if(generation!==sfCareerLiveGeneration||!sfCareerIsVisible())return;dynasties=rows;await renderDynastyChooser({silent:true});}
 catch(error){sfCareerSyncLabel('Connection interrupted · retrying automatically');}
 finally{if(generation===sfCareerLiveGeneration){sfCareerRefreshing=false;if(sfCareerRefreshAgain){sfCareerRefreshAgain=false;sfScheduleCareerRefresh();}}}
}
function sfScheduleCareerRefresh(){clearTimeout(sfCareerDebounce);sfCareerDebounce=setTimeout(sfRefreshCareerLanding,350);}
function sfStartCareerLive(){
 if(sfCareerFallback||!sfCareerIsVisible())return;
 sfCareerFallback=setInterval(()=>{if(sfCareerIsVisible())sfRefreshCareerLanding();},30000);
 sfConnectCareerLive();
}
function sfConnectCareerLive(){
 if(!sfCareerIsVisible()||sfCareerSocket)return;
 const generation=sfCareerLiveGeneration,s=session(),topic=`realtime:coach-career:${s.user.id}`;
 let ref=0,token=s.access_token;
 const socket=new WebSocket(`${URL.replace(/^https:/,'wss:')}/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`);sfCareerSocket=socket;
 const send=(event,payload={},target=topic)=>{if(socket.readyState===1)socket.send(JSON.stringify({topic:target,event,payload,ref:String(++ref),join_ref:target===topic?'1':null}));};
 socket.onopen=()=>{
  if(generation!==sfCareerLiveGeneration){socket.close();return;}
  send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:true},access_token:token});
  sfCareerHeartbeat=setInterval(()=>{const current=session();if(current?.access_token!==token&&current?.access_token){token=current.access_token;send('access_token',{access_token:token});}send('heartbeat',{},'phoenix');},25000);
 };
 socket.onmessage=e=>{
  if(generation!==sfCareerLiveGeneration)return;
  let message;try{message=JSON.parse(e.data);}catch{return;}
  if(message.event==='phx_reply'&&message.ref==='1'){
   if(message.payload?.status==='ok'){sfCareerSyncLabel('Live updates connected');sfScheduleCareerRefresh();}
   else{sfCareerSyncLabel('Auto-refresh active');socket.close();}
  }
  if(message.event==='broadcast'&&message.payload?.event==='career_changed')sfScheduleCareerRefresh();
  if(message.event==='phx_error'||message.event==='phx_close')socket.close();
 };
 socket.onerror=()=>{sfCareerSyncLabel('Auto-refresh active');socket.close();};
 socket.onclose=()=>{if(generation!==sfCareerLiveGeneration)return;sfCareerSocket=null;clearInterval(sfCareerHeartbeat);sfCareerHeartbeat=null;sfCareerSyncLabel('Auto-refresh active');sfCareerReconnect=setTimeout(sfConnectCareerLive,5000);};
}
if(typeof document!=='undefined'){
 document.addEventListener('visibilitychange',()=>{if(sfCareerIsVisible()){sfStartCareerLive();sfScheduleCareerRefresh();}else if(document.visibilityState==='hidden')sfStopCareerLive();});
 window.addEventListener('online',()=>{if(sfCareerIsVisible()){sfStartCareerLive();sfScheduleCareerRefresh();}});
 window.addEventListener('focus',()=>{if(sfCareerIsVisible()){sfStartCareerLive();sfScheduleCareerRefresh();}});
 window.addEventListener('pagehide',sfStopCareerLive);
 window.addEventListener('pageshow',()=>{if(sfCareerIsVisible()){sfStartCareerLive();sfScheduleCareerRefresh();}});
}
