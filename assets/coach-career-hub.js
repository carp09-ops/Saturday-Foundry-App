/* Saturday Foundry PROD 9.9.3 — authenticated coach career landing. */
let sfCareerHubData=null;
let sfCareerRequest=0;
function sfEditionYear(value){const digits=String(value||'').replace(/\D/g,'');const n=Number(digits);return n>0&&n<100?2000+n:n;}
function sfActiveDynasties(rows,edition){return (Array.isArray(rows)?rows:[]).filter(d=>String(d.status).toLowerCase()==='active'&&sfEditionYear(d.game_edition)===Number(edition));}
function sfCareerRecord(row){return `${Number(row.wins||0)}–${Number(row.losses||0)}${Number(row.ties)?`–${Number(row.ties)}`:''}`;}
function sfCareerMetric(value,label){return `<div class="sf-career-metric"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;}
function sfCareerBadge(chapter){return chapter.retired?'<span class="sf-career-retired">RETIRED</span>':chapter.status==='archived'?'<span class="sf-career-archive">ARCHIVE</span>':'';}
// Each edition contains independent league rails; seasons never cross league boundaries.
function sfCareerJourneyGroups(timeline,chapters=[]){
 const editions=new Map();
 for(const stop of timeline){
  const edition=sfEditionYear(stop.game_edition_year)||0;
  if(!editions.has(edition))editions.set(edition,new Map());
  const leagues=editions.get(edition),key=String(stop.dynasty_id??stop.dynasty_name??'unknown');
  if(!leagues.has(key)){
   const chapter=chapters.find(c=>sfEditionYear(c.game_edition_year)===edition&&String(c.dynasty_id??c.dynasty_name??'unknown')===key);
   leagues.set(key,{key:JSON.stringify([edition,key]),name:stop.dynasty_name||chapter?.dynasty_name||'Unnamed league',chapter,stops:[]});
  }
  leagues.get(key).stops.push(stop);
 }
 return [...editions].sort((a,b)=>b[0]-a[0]).map(([edition,leagues])=>({edition,leagues:[...leagues.values()].sort((a,b)=>a.name.localeCompare(b.name)).map(league=>({...league,stops:[...league.stops].sort((a,b)=>{
  const ay=Number(a.year)||0,by=Number(b.year)||0;
  // Undated seasons remain visible without inventing a year or a place in chronology.
  return ay&&by?ay-by:ay?-1:by?1:0;
 })}))}));
}
function sfCareerJourneyMarkup(timeline,chapters=[]){
 const groups=sfCareerJourneyGroups(timeline,chapters);
 if(!groups.length)return '<p class="sf-career-note">No assignments recorded.</p>';
 return `<p class="sf-journey-guide">One timeline per league. Swipe to explore earlier seasons.</p>${groups.map(group=>`<section class="sf-journey-edition"><header class="sf-journey-edition-head"><h4>${group.edition?`College Football ${esc(group.edition)}`:'Game edition not recorded'}</h4><span>${group.leagues.length} league${group.leagues.length===1?'':'s'}</span></header>${group.leagues.map(league=>{
  const totals=league.stops.reduce((t,s)=>({wins:t.wins+Number(s.wins||0),losses:t.losses+Number(s.losses||0),ties:t.ties+Number(s.ties||0)}),{wins:0,losses:0,ties:0});
  const dated=league.stops.filter(s=>Number(s.year)>0),latest=Number(dated.at(-1)?.year)||0;
  return `<section class="sf-journey-league"><header class="sf-journey-league-head"><div><h5>${esc(league.name)}</h5>${sfCareerBadge(league.chapter||{})}<p>${esc(sfCareerRecord(totals))} recorded · ${new Set(league.stops.map(s=>s.season_id??s.year??'undated')).size} seasons</p></div><nav aria-label="Timeline navigation for ${esc(league.name)}"><button type="button" data-journey-step="-1" aria-label="Earlier seasons in ${esc(league.name)}">←</button><button type="button" data-journey-step="1" aria-label="Later seasons in ${esc(league.name)}">→</button></nav></header><ol class="sf-journey-rail" data-journey-key="${esc(league.key)}" tabindex="0" aria-label="${esc(league.name)} · ${group.edition?`College Football ${esc(group.edition)}`:'Unknown edition'} season timeline">${league.stops.map((stop,i)=>{
   const year=Number(stop.year)||0,previous=league.stops[i-1],teamKey=s=>String(s.team_id??s.team_name??'');
   const moved=year&&Number(previous?.year)&&year>Number(previous.year)&&teamKey(stop)&&teamKey(previous)&&teamKey(stop)!==teamKey(previous);
   return `<li class="sf-journey-stop${year&&year===latest?' is-latest':''}"><div class="sf-journey-year">${year?esc(year):'Year not recorded'}<span>${year&&year===latest?'Latest recorded':year?'Season':'Undated season'}</span></div><div class="sf-journey-node" aria-hidden="true"></div><article class="sf-journey-season">${stop.logo_url?`<img src="${esc(stop.logo_url)}" alt="" loading="lazy">`:'<span class="sf-journey-team-mark" aria-hidden="true">SF</span>'}<b>${esc(stop.team_name||'Team not recorded')}</b><strong>${esc(sfCareerRecord(stop))}</strong><span class="sf-journey-record-label">Recorded record</span>${moved?'<span class="sf-journey-move">New team</span>':''}</article></li>`;
  }).join('')}</ol></section>`;
 }).join('')}</section>`).join('')}`;
}
function sfSetupCareerJourney(host,positions=new Map()){
 const rails=[...host.querySelectorAll('.sf-journey-rail')];
 const initialize=()=>{for(const rail of rails){if(rail.clientWidth&&!rail.dataset.positioned){rail.scrollLeft=positions.has(rail.dataset.journeyKey)?positions.get(rail.dataset.journeyKey):rail.scrollWidth-rail.clientWidth;rail.dataset.positioned='true';}if(rail.clientWidth){const buttons=rail.closest('.sf-journey-league').querySelectorAll('[data-journey-step]');buttons[0].disabled=rail.scrollLeft<=1;buttons[1].disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-1;}}};
 for(const rail of rails)rail.addEventListener('scroll',initialize,{passive:true});
 for(const button of host.querySelectorAll('[data-journey-step]'))button.addEventListener('click',()=>{const rail=button.closest('.sf-journey-league').querySelector('.sf-journey-rail');rail.scrollBy({left:Number(button.dataset.journeyStep)*Math.max(rail.clientWidth*.8,190),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
 host.querySelector('#sfCareerProfile')?.addEventListener('toggle',initialize);
 host.querySelector('#sfCareerJourney')?.addEventListener('toggle',initialize);
 initialize();
}
function sfRenderCareerHub(hub){
 const host=document.getElementById('sfCareerHub');if(!host)return;
 const journeyPositions=new Map([...host.querySelectorAll('.sf-journey-rail[data-positioned]')].map(rail=>[rail.dataset.journeyKey,rail.scrollLeft]));
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
 <details class="sf-career-profile" id="sfCareerTrophyArchive"><summary>Archive Trophy Room <span>Hardware from past game editions</span></summary><div id="sfCareerTrophyArchiveBody" class="sf-career-profile-body"></div></details>
 <div class="sf-career-edition-head"><h3>Edition over edition</h3><span>Recorded career totals</span></div><div class="sf-career-editions">${editions.map(e=>`<article class="sf-career-edition"><span>COLLEGE FOOTBALL ${esc(e.game_edition_year)}</span><b>${esc(sfCareerRecord(e))}</b><p>${esc(e.national_titles)} national · ${esc(e.conference_titles)} conference · ${esc(e.heismans)} Heismans</p></article>`).join('')||'<p>No completed games recorded yet.</p>'}</div>
 <details id="sfCareerProfile" class="sf-career-profile"><summary>Full career profile <span>Journey · Honors · Draft · Stats</span></summary><div class="sf-career-profile-body"><p class="sf-career-note">Totals include verified, completed user games. Seasons still in progress are included; missing scores are omitted from scoring averages. Awards reflect the honors recorded in each league.</p><div class="sf-career-metrics sf-career-extra">${sfCareerMetric(gp?`${((wins+ties/2)/gp*100).toFixed(1)}%`:'N/A','Win percentage')}${sfCareerMetric(t.draft_picks||0,'Draft picks')}${sfCareerMetric(t.awards||0,'Player / coach awards')}${sfCareerMetric(t.seasons||0,'Seasons')}${sfCareerMetric(`${t.bowl_wins||0}–${t.bowl_losses||0}`,'Bowl record')}${sfCareerMetric(`${t.playoff_wins||0}–${t.playoff_losses||0}`,'Playoff record')}${sfCareerMetric(t.scored_games?((t.points_for||0)/t.scored_games).toFixed(1):'N/A','Points per game')}${sfCareerMetric(t.scored_games?((t.points_against||0)/t.scored_games).toFixed(1):'N/A','Points allowed')}</div>
 <details open class="sf-career-team-records"><summary>Teams coached &amp; records (${coachedTeams.length})</summary><ul class="sf-career-journey">${coachedTeams.map(team=>`<li>${team.logo?`<img src="${esc(team.logo)}" alt="" loading="lazy">`:''}<div><b>${esc(team.name)}</b><span>${esc(team.seasons.size)} seasons · ${[...team.editions].sort((a,b)=>b-a).map(e=>`CFB ${esc(e)}`).join(' / ')}</span></div><strong>${esc(sfCareerRecord(team))}</strong></li>`).join('')||'<li>No teams recorded yet.</li>'}</ul></details>
 <h4>League chapters</h4><div class="sf-career-chapters">${chapters.map(c=>`<article><div><b>${esc(c.dynasty_name)}</b>${sfCareerBadge(c)}</div><p>CFB ${esc(c.game_edition_year)} · ${esc(sfCareerRecord(c))} · ${esc(c.national_titles)} national titles</p></article>`).join('')}</div>
 <details open id="sfCareerJourney"><summary>Coaching journey</summary><div class="sf-journey-timelines">${sfCareerJourneyMarkup(timeline,chapters)}</div></details>
 <details><summary>Honors &amp; championships (${honors.length})</summary><ul class="sf-career-facts">${honors.map(a=>`<li><b>${esc(a.name||String(a.type).replace(/_/g,' '))}</b><span>${esc(a.recipient_name||a.player_name||a.team_name||'')}</span><small>CFB ${esc(a.game_edition_year)} · ${esc(a.year)} season</small></li>`).join('')||'<li>No honors recorded yet.</li>'}</ul></details>
 <details><summary>Draft history (${facts.filter(f=>f.kind==='draft_pick').length})</summary><ul class="sf-career-facts">${factRows('draft_pick')||'<li>No draft picks recorded yet.</li>'}</ul></details>
 <details><summary>Statistical leaders (${facts.filter(f=>f.kind==='stat_leader').length})</summary><ul class="sf-career-facts">${factRows('stat_leader')||'<li>No statistical leaders recorded yet.</li>'}</ul></details></div></details>`;
 sfRenderCareerTrophyArchive(hub);
 sfSetupCareerJourney(host,journeyPositions);
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

// Archived hardware stays on the cross-edition coach landing, outside active leagues.
const sfCareerArchiveSelection={edition:'',dynasty:'all',type:'all'};
function sfRenderCareerTrophyArchive(hub){
 const root=document.getElementById('sfCareerTrophyArchiveBody');if(!root)return;
 const v=sfCareerArchiveSelection;
 const editions=[...new Set([...(hub.chapters||[]),...(hub.honors||[])].map(x=>Number(x.game_edition_year)).filter(x=>x>0&&x<Number(window.sfActiveGameEdition)))].sort((a,b)=>b-a);
 if(!editions.includes(Number(v.edition)))v.edition=String(editions[0]||'');
 const chapters=(hub.chapters||[]).filter(x=>Number(x.game_edition_year)===Number(v.edition));
 if(v.dynasty!=='all'&&!chapters.some(x=>String(x.dynasty_id)===v.dynasty))v.dynasty='all';
 const all=sfArchiveEntries(hub,v.edition,v.dynasty),shown=all.filter(x=>v.type==='all'||x.category===v.type);
 const option=(value,label,current)=>`<option value="${esc(value)}"${String(value)===String(current)?' selected':''}>${esc(label)}</option>`;
 if(!editions.length){root.innerHTML='<p class="sf-career-note">No past game editions recorded yet.</p>';return;}
 root.innerHTML=`<p class="sf-career-note">Your recorded hardware from past game editions. Choose an edition and dynasty to explore.</p><div class="sf-vault-filters"><label>Game edition<select id="sfCareerArchiveEdition">${editions.map(e=>option(e,'College Football '+e,v.edition)).join('')}</select></label><label>Dynasty<select id="sfCareerArchiveDynasty">${option('all','All archived dynasties',v.dynasty)}${chapters.map(c=>option(c.dynasty_id,c.dynasty_name+(c.retired?' · Retired':''),v.dynasty)).join('')}</select></label></div><div class="sf-vault-summary">${[['national','National titles'],['conference','Conference titles'],['bowl','Bowl trophies'],['award','Individual awards']].map(([k,label])=>`<button type="button" data-career-archive-category="${k}" aria-pressed="${v.type===k}" class="${v.type===k?'is-active':''}"><b>${all.filter(x=>x.category===k).length}</b><span>${label}</span></button>`).join('')}</div><p class="sf-vault-results">${shown.length} recorded achievements · CFB ${esc(v.edition)}</p><div class="sf-vault-categories">${sfVaultHardwareMarkup(shown,{...v,coach:'career'})}</div><div id="sfCareerArchiveDetail" class="sf-vault-detail" hidden></div>`;
 root.onchange=e=>{if(e.target.id==='sfCareerArchiveEdition'){v.edition=e.target.value;v.dynasty='all';}else if(e.target.id==='sfCareerArchiveDynasty')v.dynasty=e.target.value;else return;sfRenderCareerTrophyArchive(hub);};
 root.onclick=e=>{const metric=e.target.closest('[data-career-archive-category]');if(metric){v.type=v.type===metric.dataset.careerArchiveCategory?'all':metric.dataset.careerArchiveCategory;sfRenderCareerTrophyArchive(hub);return;}const b=e.target.closest('[data-vault-trophy]');if(!b)return;const x=shown.find(x=>x.key===b.dataset.vaultTrophy);if(!x)return;const detail=root.querySelector('#sfCareerArchiveDetail');detail.hidden=false;detail.innerHTML=sfVaultDetails(x);root.querySelectorAll('[data-vault-trophy]').forEach(button=>{button.classList.toggle('is-selected',button===b);button.setAttribute('aria-pressed',String(button===b));});detail.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});};
}
