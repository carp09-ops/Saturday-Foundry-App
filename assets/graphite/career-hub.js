/* Personal cross-league history. The existing authenticated career RPC owns all totals. */
ALLOWED_RPC.add('get_my_coach_career_hub');
routes.add('mycareer');
let personalCareer={owner:'',data:null,error:'',checkedAt:0},personalCareerRequest=null;
const careerFilters={edition:'all',dynasty:'all',type:'all',archive:false};
const careerOwner=()=>session()?.access_token?(session().user?.id||session().access_token):'';
const careerData=()=>personalCareer.owner===careerOwner()?personalCareer.data:null;
function resetPersonalCareer(){stopPersonalCareerLive();personalCareer={owner:careerOwner(),data:null,error:'',checkedAt:0};personalCareerRequest=null;Object.assign(careerFilters,{edition:'all',dynasty:'all',type:'all',archive:false})}
function careerRecord(r={}){return `${num(r.wins)}–${num(r.losses)}${num(r.ties)?'–'+num(r.ties):''}`}
function careerEdition(value){const n=Number(String(value??'').replace(/\D/g,''));return n>0&&n<100?n+2000:n||null}
function careerEditionLabel(value){return careerEdition(value)?'CFB '+careerEdition(value):'Edition not recorded'}
function careerSeasonLabel(r){return [r.edition_season_number!=null?'Season '+r.edition_season_number:'',r.year||''].filter(x=>x!=='').join(' · ')||'Season not recorded'}
function careerLeagueName(r){return r.dynasty_name||careerData()?.chapters.find(c=>c.dynasty_id===r.dynasty_id&&careerEdition(c.game_edition_year)===careerEdition(r.game_edition_year))?.dynasty_name||'League not recorded'}
function careerMeta(r){return [careerEditionLabel(r.game_edition_year),careerLeagueName(r),careerSeasonLabel(r)].join(' · ')}
function careerCategory(r){const key=String(r.type||'')+' '+String(r.name||'');return /national.*champ/i.test(key)?'national':/conference/i.test(key)?'conference':/bowl/i.test(key)?'bowl':'award'}
function careerTeamLogo(r){const src=validArtworkUrl(r.logo_url);return src?`<img class="team-logo" src="${esc(src)}" alt="" loading="lazy" onerror="imageFallback(this)">`:logo(r.team_id,r.team_name)}
function careerTeamRecords(rows){
 const teams=new Map(),seen=new Set();
 for(const r of rows){const key=r.team_id||r.team_name,stop=JSON.stringify([r.dynasty_id,r.season_id??r.edition_season_number??r.year,key,r.game_edition_year]);if(seen.has(stop))continue;seen.add(stop);
  if(!teams.has(key))teams.set(key,{...r,wins:0,losses:0,ties:0,editions:new Set(),seasons:new Set()});
  const t=teams.get(key);t.wins+=num(r.wins);t.losses+=num(r.losses);t.ties+=num(r.ties);if(careerEdition(r.game_edition_year))t.editions.add(careerEdition(r.game_edition_year));t.seasons.add(JSON.stringify([r.dynasty_id,r.season_id??r.edition_season_number??r.year]));
 }
 return [...teams.values()].sort((a,b)=>(b.wins+b.losses+b.ties)-(a.wins+a.losses+a.ties)||String(a.team_name).localeCompare(String(b.team_name)));
}
function careerJourneyGroups(rows){
 const groups=new Map();for(const r of rows){const key=JSON.stringify([careerEdition(r.game_edition_year),r.dynasty_id||r.dynasty_name]);if(!groups.has(key))groups.set(key,{key,edition:careerEdition(r.game_edition_year),name:careerLeagueName(r),rows:[]});groups.get(key).rows.push(r)}
 return [...groups.values()].sort((a,b)=>num(b.edition)-num(a.edition)||a.name.localeCompare(b.name)).map(g=>({...g,rows:g.rows.sort((a,b)=>{const av=a.edition_season_number??a.year,bv=b.edition_season_number??b.year;return av==null?1:bv==null?-1:Number(av)-Number(bv)||String(a.team_name).localeCompare(String(b.team_name))})}));
}
function careerJourneyMarkup(hub){return careerJourneyGroups(hub.timeline).map(g=>{
 const chapter=hub.chapters.find(c=>JSON.stringify([careerEdition(c.game_edition_year),c.dynasty_id||c.dynasty_name])===g.key);
 return `<article class="career-chapter"><header><div><span class="eyebrow">${esc(careerEditionLabel(g.edition))}</span><h3>${esc(g.name)}</h3></div>${chapter?`<div class="chapter-record"><strong>${careerRecord(chapter)}</strong><small>${chapter.retired?'Retired':chapter.status==='archived'?'Archived league':'Recorded record'}</small></div>`:''}</header><ol class="career-journey">${g.rows.map((r,i)=>{const prev=g.rows[i-1],moved=prev&&(r.team_id||r.team_name)!==(prev.team_id||prev.team_name)&&num(r.edition_season_number??r.year)>num(prev.edition_season_number??prev.year);return `<li>${careerTeamLogo(r)}<div><small>${esc(careerSeasonLabel(r))}</small><strong>${esc(r.team_name||'Team not recorded')}</strong>${moved?'<span class="career-move">New program</span>':''}${r.retired_from_program?'<small>Retired from program</small>':''}</div><b>${careerRecord(r)}</b></li>`}).join('')}</ol></article>`;
 }).join('')||empty('Your coaching journey will appear as program assignments are recorded.')}
function careerHonorName(r){return r.name||String(r.type||'Honor').replaceAll('_',' ')}
function careerHonorRecipient(r){return r.player_name||r.metadata?.player_name||(!r.metadata?.historical_count_import?r.recipient_name:'')||''}
const CAREER_AWARD_ART=[['maxwell','maxwell'],['walter camp','walter-camp'],['davey obrien','davey-obrien'],['doak walker','doak-walker'],['biletnikoff','biletnikoff'],['mackey','john-mackey'],['outland','outland'],['nagurski','bronko-nagurski'],['bednarik','chuck-bednarik'],['butkus','dick-butkus'],['thorpe','jim-thorpe'],['hendricks','ted-hendricks'],['lombardi','rotary-lombardi'],['rimington','rimington'],['groza','lou-groza'],['ray guy','ray-guy'],['jet award','jet'],['hornung','paul-hornung'],['unitas','johnny-unitas'],['manning','manning'],['shaun alexander','shaun-alexander'],['edge rusher','edge-rusher']];
function careerHonorArt(r){const category=careerCategory(r),key=careerHonorName(r).toLowerCase().replace(/[’']/g,''),award=CAREER_AWARD_ART.find(([name])=>key.includes(name));return category==='national'?'assets/cfp-trophy-transparent.png':category==='award'&&award?'assets/trophy-vault/awards/'+award[1]+'.webp':'assets/trophy-vault/'+category+'.webp'}
function careerTrophyFallback(img){img.onerror=()=>imageFallback(img);img.src='assets/trophy-vault/award.webp'}
function careerFilteredHonors(hub){
 const f=careerFilters,active=careerEdition(hub.active_game_edition_year);
 return hub.honors.filter(r=>(!f.archive||(active&&careerEdition(r.game_edition_year)&&careerEdition(r.game_edition_year)<active))&&(f.edition==='all'||String(careerEdition(r.game_edition_year))===f.edition)&&(f.dynasty==='all'||String(r.dynasty_id)===f.dynasty)&&(f.type==='all'||careerCategory(r)===f.type));
}
function careerHonorsMarkup(hub){
 const f=careerFilters,active=careerEdition(hub.active_game_edition_year),available=hub.honors.filter(r=>!f.archive||(active&&careerEdition(r.game_edition_year)<active)),editions=[...new Set(available.map(r=>careerEdition(r.game_edition_year)).filter(Boolean))].sort((a,b)=>b-a);
 if(f.edition!=='all'&&!editions.includes(Number(f.edition)))f.edition='all';
 const leagues=[...new Map(available.filter(r=>f.edition==='all'||String(careerEdition(r.game_edition_year))===f.edition).map(r=>[r.dynasty_id,careerLeagueName(r)])).entries()];
 if(f.dynasty!=='all'&&!leagues.some(([id])=>String(id)===f.dynasty))f.dynasty='all';
 const opt=(v,n,c)=>`<option value="${esc(v)}" ${String(v)===c?'selected':''}>${esc(n)}</option>`,shown=careerFilteredHonors(hub);
 return `<div class="sectionhead"><h2>${f.archive?'Archived trophy room':'Honors & championships'}</h2><button onclick="setCareerArchive(${!f.archive})">${f.archive?'All honors':'Archived trophy room'} →</button></div><p class="sport-note">${f.archive?'Hardware from past game editions.':'Your recorded honors across every league and edition.'}</p><div class="career-honor-filters"><label>Game edition<select id="careerEdition" onchange="setCareerFilter('edition',this.value)">${opt('all','All editions',f.edition)}${editions.map(e=>opt(e,'College Football '+e,f.edition)).join('')}</select></label><label>League<select id="careerLeague" onchange="setCareerFilter('dynasty',this.value)">${opt('all','All leagues',f.dynasty)}${leagues.map(([id,name])=>opt(id,name,f.dynasty)).join('')}</select></label><label>Honor type<select id="careerHonorType" onchange="setCareerFilter('type',this.value)">${[['all','All honors'],['national','National titles'],['conference','Conference titles'],['bowl','Bowl trophies'],['award','Individual awards']].map(([v,n])=>opt(v,n,f.type)).join('')}</select></label></div><p class="career-result-count" role="status">${shown.length} recorded ${shown.length===1?'achievement':'achievements'}</p>${shown.length?`<div class="career-trophy-grid">${shown.map(r=>`<button class="career-trophy" onclick="showCareerHonor(${hub.honors.indexOf(r)})"><img src="${careerHonorArt(r)}" alt="" loading="lazy" onerror="careerTrophyFallback(this)"><strong>${esc(careerHonorName(r))}</strong><span>${esc(careerHonorRecipient(r)||r.team_name||r.metadata?.team||'Recorded honor')}</span><small>${esc(careerMeta(r))}</small></button>`).join('')}</div>`:empty(f.archive?'No archived honors match these filters.':'No honors match these filters.')}`;
}
function setCareerFilter(key,value){if(!['edition','dynasty','type'].includes(key))return;careerFilters[key]=String(value);if(key==='edition')careerFilters.dynasty='all';refreshCareerHonors()}
function setCareerArchive(enabled){Object.assign(careerFilters,{edition:'all',dynasty:'all',type:'all',archive:!!enabled});refreshCareerHonors()}
function refreshCareerHonors(){const hub=careerData(),host=$('careerHonors');if(hub&&host){const focus=document.activeElement?.id;host.innerHTML=careerHonorsMarkup(hub);if(focus&&$(focus))$(focus).focus()}}
function showCareerHonor(index){const hub=careerData(),r=hub?.honors[index];if(!r)return;const score=r.points_for!=null&&r.points_against!=null?`${r.points_for}–${r.points_against}`:'—';openSheet('Career honor',title(careerEditionLabel(r.game_edition_year),careerHonorName(r),careerLeagueName(r))+`<img class="career-honor-hero" src="${careerHonorArt(r)}" alt="" onerror="careerTrophyFallback(this)">`+table(['Detail','Recorded value'],[['Coach',esc(hub.coach.name)],['Team',esc(r.team_name||r.metadata?.team||'—')],['Recipient',esc(careerHonorRecipient(r)||'—')],['Season',esc(careerSeasonLabel(r))],['Opponent',esc(r.opponent_team||'—')],['Score',esc(score)]]))}
function careerFactsMarkup(hub,kind){const rows=hub.facts.filter(r=>r.kind===kind);return rows.length?`<ul class="career-facts">${rows.map(r=>`<li><div><strong>${esc(r.recipient_name||r.label||'Recorded achievement')}</strong><span>${esc(r.label||'')}${r.value!=null?' · '+(kind==='draft_pick'?'Round ':'')+esc(r.value):''}${kind==='draft_pick'&&r.metadata?.pick!=null?' · Pick '+esc(r.metadata.pick):''}</span><small>${esc(careerMeta(r))}</small></div></li>`).join('')}</ul>`:empty(kind==='draft_pick'?'No draft picks have been recorded.':'No statistical leaders have been recorded.')}
function careerHubMarkup(){
 const hub=careerData();if(!hub)return `<div class="career-loading" role="status">${personalCareer.error?`<h2>Your career could not load.</h2><p>${esc(personalCareer.error)}</p><button class="secondary" onclick="loadMyCareer(true)">Retry career</button>`:'Loading your complete coaching career…'}</div>`;
 if(!hub.coach)return empty('Your career starts here. Claim your coach in a league to begin recording your history.')+button('Choose a league','leagues','secondary');
 const t=hub.totals||{},gp=num(t.wins)+num(t.losses)+num(t.ties),teams=careerTeamRecords(hub.timeline),name=hub.coach.name||'Coach',portrait=artwork(name)||validArtworkUrl(hub.coach.avatar_url)||THEME_ART+'coach-headset.webp';
 return `<div class="career-refresh"><span role="status">${personalCareer.error?'Refresh unavailable · showing last loaded history':'Live career data · refreshes automatically'}</span><button onclick="loadMyCareer(true)" ${personalCareerRequest?'disabled':''}>${personalCareerRequest?'Refreshing…':'Refresh'}</button></div><header class="career-identity"><div><span class="eyebrow">EVERY LEAGUE. EVERY EDITION.</span><h2>Coach ${esc(name)}</h2><strong class="career-total">${careerRecord(t)}</strong><span class="career-record-label">Career record</span></div><button class="career-card-button" onclick="showMyCareerCard()" aria-label="Open ${esc(name)} coach card"><img src="${esc(portrait)}" alt="${esc(name)} coach card" onerror="imageFallback(this,'coach')"></button></header><div class="career-titles">${[[t.national_titles,'National titles'],[t.conference_titles,'Conference titles'],[t.heismans,'Heismans']].map(([n,k])=>`<div><strong>${num(n)}</strong><span>${k}</span></div>`).join('')}</div><nav class="career-jumps" aria-label="Career sections">${[['careerEditions','Editions'],['careerTeams','Teams'],['careerJourney','Journey'],['careerHonors','Honors'],['careerDraft','Draft'],['careerStats','Stats']].map(([id,n])=>`<button onclick="jump('${id}')">${n}</button>`).join('')}</nav>
 <section id="careerEditions" class="career-section"><h2>Edition over edition</h2><div class="career-editions">${hub.editions.map(e=>`<article><span class="eyebrow">College Football ${esc(careerEdition(e.game_edition_year)||'—')}</span><strong>${careerRecord(e)}</strong><p>${num(e.national_titles)} national · ${num(e.conference_titles)} conference · ${num(e.heismans)} Heismans</p></article>`).join('')||empty('No game editions have been recorded yet.')}</div></section>
 <section id="careerTeams" class="career-section"><h2>Teams coached <span class="career-count">${teams.length}</span></h2><ul class="career-team-list">${teams.map(r=>`<li>${careerTeamLogo(r)}<div><strong>${esc(r.team_name||'Team not recorded')}</strong><small>${r.seasons.size} ${r.seasons.size===1?'season':'seasons'} · ${[...r.editions].sort((a,b)=>b-a).map(e=>'CFB '+e).join(' / ')||'Edition not recorded'}</small></div><b>${careerRecord(r)}</b></li>`).join('')||'<li>No programs recorded yet.</li>'}</ul></section>
 <section id="careerJourney" class="career-section"><h2>Coaching journey</h2><p class="sport-note">Each league keeps its own timeline. Your history stays with you when you change programs.</p>${careerJourneyMarkup(hub)}</section>
 <section id="careerHonors" class="career-section">${careerHonorsMarkup(hub)}</section>
 <section id="careerDraft" class="career-section"><h2>Draft history <span class="career-count">${hub.facts.filter(r=>r.kind==='draft_pick').length}</span></h2>${careerFactsMarkup(hub,'draft_pick')}</section>
 <section id="careerStats" class="career-section"><h2>Career statistics</h2><div class="career-stats">${[[gp?((num(t.wins)+num(t.ties)/2)/gp*100).toFixed(1)+'%':'—','Win percentage'],[num(t.draft_picks),'Draft picks'],[num(t.awards),'Player / coach awards'],[num(t.seasons),'Seasons'],[num(t.bowl_wins)+'–'+num(t.bowl_losses),'Bowl record'],[num(t.playoff_wins)+'–'+num(t.playoff_losses),'Playoff record'],[num(t.scored_games)?(num(t.points_for)/num(t.scored_games)).toFixed(1):'—','Points per game'],[num(t.scored_games)?(num(t.points_against)/num(t.scored_games)).toFixed(1):'—','Points allowed']].map(([v,k])=>`<div><strong>${esc(v)}</strong><span>${k}</span></div>`).join('')}</div><p class="sport-note">Totals include verified, completed user games, including seasons in progress. Scoring averages omit games with missing scores. Awards reflect recorded honors.</p><h3>Statistical leaders</h3>${careerFactsMarkup(hub,'stat_leader')}</section>`;
}
function showMyCareerCard(){const c=careerData()?.coach;if(!c)return;const src=artwork(c.name)||validArtworkUrl(c.avatar_url)||THEME_ART+'coach-headset.webp';openSheet(c.name+' · Coach card',`<img class="portrait" src="${esc(src)}" alt="${esc(c.name)} coach card" onerror="imageFallback(this,'coach')">`)}
function refreshCareerMarkup(){const host=$('careerHubRoot');if(route!=='mycareer'||!host||busy||mutationPending||$('detailSheet')?.open)return;const top=$('screenViewport')?.scrollTop,focus=document.activeElement?.id;host.innerHTML=careerHubMarkup();if($('screenViewport'))$('screenViewport').scrollTop=top||0;if(focus&&$(focus))$(focus).focus()}
async function loadMyCareer(force=false){
 const owner=careerOwner();if(!owner)return;if(personalCareer.owner!==owner)resetPersonalCareer();
 if(personalCareerRequest?.owner===owner)return personalCareerRequest.promise;
 if(!force&&personalCareer.checkedAt&&Date.now()-personalCareer.checkedAt<60000)return;
 const request={owner,promise:null};personalCareerRequest=request;refreshCareerMarkup();
 request.promise=(async()=>{try{
  const hub=await readRpc('get_my_coach_career_hub',{});
  if(careerOwner()!==owner||personalCareerRequest!==request)return;
  if(!hub||Array.isArray(hub)||typeof hub!=='object'||!Object.hasOwn(hub,'coach'))throw Error('The career service returned an unexpected response.');
  personalCareer={owner,data:{...hub,totals:hub.totals||{},...Object.fromEntries(['editions','chapters','timeline','honors','facts'].map(k=>[k,Array.isArray(hub[k])?hub[k]:[]]))},error:'',checkedAt:Date.now()};
 }catch(e){if(careerOwner()===owner&&personalCareerRequest===request){personalCareer.error=e.message;personalCareer.checkedAt=Date.now()}}
 finally{if(personalCareerRequest===request){personalCareerRequest=null;if(!careerOwner())render();else refreshCareerMarkup()}}})();return request.promise;
}
function refreshVisibleCareer(){if(route==='mycareer'&&!document.hidden&&!busy&&!mutationPending){connectPersonalCareerLive();if(!$('detailSheet')?.open)loadMyCareer()}else if(document.hidden)stopPersonalCareerLive()}
const careerBaseContent=content,careerBaseLegacy=legacy,careerBaseCoach=coach,careerBaseAccount=account,careerBaseNav=navSection,careerBaseRender=render;
content=function(){return route==='mycareer'?title('Your all-time legacy','My Career','Every league. Every edition.')+'<div id="careerHubRoot">'+careerHubMarkup()+'</div>':careerBaseContent()};
legacy=function(){return title('Your coaching story','Legacy')+`<button class="career-entry" onclick="go('mycareer')"><span><span class="eyebrow">YOUR ALL-TIME LEGACY</span><strong>My Career</strong><small>Every program, trophy and game edition.</small></span>${ico('arrow')}</button>`+careerBaseLegacy().replace(title(dynasty.name,'Legacy'),'')};
coach=function(){return careerBaseCoach()+(selectedCoach===myCoach()?row('My all-time career','Your records across every league and game edition',`onclick="go('mycareer')"`):'')};
account=function(){return careerBaseAccount()+row('My Career','Every league. Every edition.',`onclick="go('mycareer')"`)};
navSection=function(){return route==='mycareer'?'legacy':careerBaseNav()};
render=function(){if(personalCareer.owner!==careerOwner())resetPersonalCareer();careerBaseRender();if(route==='mycareer'&&careerOwner()&&!busy&&!loadError){loadMyCareer();connectPersonalCareerLive()}else stopPersonalCareerLive()};
window.addEventListener('focus',refreshVisibleCareer);document.addEventListener('visibilitychange',refreshVisibleCareer);setInterval(refreshVisibleCareer,60000);

// Private notifications invalidate the cache; all data is re-read through the authenticated RPC.
let personalCareerSocket=null,careerHeartbeat=null,careerReconnect=null,careerDebounce=null;
function stopPersonalCareerLive(){clearInterval(careerHeartbeat);clearTimeout(careerReconnect);clearTimeout(careerDebounce);careerHeartbeat=careerReconnect=careerDebounce=null;const socket=personalCareerSocket;personalCareerSocket=null;if(socket){socket.onclose=null;socket.close()}}
function connectPersonalCareerLive(){
 const s=session();if(personalCareerSocket||document.hidden||route!=='mycareer'||!s?.user?.id||!s.access_token||typeof WebSocket==='undefined')return;
 const owner=careerOwner(),topic='realtime:coach-career:'+s.user.id;let ref=0,token=s.access_token;
 let socket;try{socket=new WebSocket(URL.replace(/^https:/,'wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(KEY)+'&vsn=1.0.0')}catch{return}personalCareerSocket=socket;
 const current=()=>personalCareerSocket===socket&&careerOwner()===owner&&route==='mycareer'&&!document.hidden;
 const send=(event,payload={},target=topic)=>{if(current()&&socket.readyState===1)socket.send(JSON.stringify({topic:target,event,payload,ref:String(++ref),join_ref:target===topic?'1':null}))};
 socket.onopen=()=>{if(!current()){socket.close();return}send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{enabled:false},private:true},access_token:token});careerHeartbeat=setInterval(()=>{if(!current())return;const next=session()?.access_token;if(next&&next!==token){token=next;send('access_token',{access_token:token})}send('heartbeat',{},'phoenix')},25000)};
 socket.onmessage=e=>{if(!current())return;let message;try{message=JSON.parse(e.data)}catch{return}
  if(message.event==='phx_error'||message.event==='phx_close'||(message.event==='phx_reply'&&message.ref==='1'&&message.payload?.status!=='ok')){socket.close();return}
  if(message.event==='broadcast'&&message.payload?.event==='career_changed'){clearTimeout(careerDebounce);careerDebounce=setTimeout(()=>{if(current())loadMyCareer(true)},350)}
 };
 socket.onerror=()=>socket.close();socket.onclose=()=>{if(personalCareerSocket!==socket)return;personalCareerSocket=null;clearInterval(careerHeartbeat);careerHeartbeat=null;if(careerOwner()===owner&&route==='mycareer'&&!document.hidden)careerReconnect=setTimeout(connectPersonalCareerLive,5000)};
}
window.addEventListener('pagehide',stopPersonalCareerLive);window.addEventListener('pageshow',refreshVisibleCareer);window.addEventListener('online',refreshVisibleCareer);
