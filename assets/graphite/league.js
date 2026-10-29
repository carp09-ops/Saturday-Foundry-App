// Authenticated league data and shared reading screens. Native workflows are in workflows.js.
const ASSET='https://raw.githack.com/carp09-ops/Saturday-Foundry-App/b8fe1f2689852089db4ef666b22b7a1344332ba7/assets/';
const PREFERENCE='sf_graphite_context_v1';
let model={dynasties:[],seasons:[],programs:[],standings:[],scheduleGames:[],career:[],stops:[],trophies:[],myPrograms:[],leaguePrograms:[],leagueProgramsReady:false,history:[],stories:[],rankings:[],teams:[],coachStreams:[],warnings:[]};
let dynasty=null,season=null,route='home',trail=[],selectedTeam=null,selectedCoach=null,selectedGame=null,week=0,scope='all',conference='',busy=true,loadError='',loadSerial=0,updatedAt=null,selectedStory=null,trophyPerson=null;
const routes=new Set(['home','scores','teams','team','coach','standings','legacy','trophies','stories','article','game','account','leagues','seasons','seasonarchive','rankings','analysis','rivalries','career','records','intelligence']);
const uid=x=>/^[a-f0-9-]{36}$/i.test(String(x||''))?String(x):'';
const safeImage=x=>/^https:\/\//i.test(String(x||''))?esc(x):'';
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const fmt=x=>Number.isFinite(Number(x))?Number(x).toFixed(1):'—';
const title=(k,t,p='')=>`<div class="eyebrow">${esc(k)}</div><h1>${esc(t)}</h1>${p?`<p class="muted">${esc(p)}</p>`:''}`;
const section=(t,r='',label='See all')=>`<div class="sectionhead"><h2>${esc(t)}</h2>${r?`<button onclick="go('${r}')">${esc(label)} →</button>`:''}</div>`;
const button=(t,r,cl='primary')=>`<button class="${cl}" onclick="go('${r}')">${esc(t)}</button>`;
const empty=t=>`<div class="empty-score">${esc(t)}</div>`;
const statline=a=>`<div class="statline">${a.map(([v,k])=>`<div><strong>${esc(v)}</strong><small>${esc(k)}</small></div>`).join('')}</div>`;
const row=(t,s,action)=>`<button class="row" ${action}><span class="copy"><strong>${esc(t)}</strong><small>${esc(s)}</small></span>${ico('arrow')}</button>`;
const table=(heads,rows)=>`<div class="tablewrap"><table class="table"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
function preference(){try{return JSON.parse(localStorage.getItem(PREFERENCE)||'{}')}catch{return {}}}
function currentLeagueSeason(){return model.seasons.find(s=>s.is_active)||model.seasons[0]||null}
function browsingArchive(){return !!season&&season.season_id!==currentLeagueSeason()?.season_id}
function savePreference(){try{const current=currentLeagueSeason();localStorage.setItem(PREFERENCE,JSON.stringify({dynasty:dynasty?.dynasty_id,season:current?.season_id,team:browsingArchive()?model.myPrograms.find(p=>p.season_id===current?.season_id)?.team_id:selectedTeam,followActiveSeason:true}))}catch{}}
async function read(view,q='',select='*'){
 const rows=[],size=500;
 for(let offset=0;;offset+=size){
  const page=await req(`/rest/v1/${view}?select=${select}${q?'&'+q:''}&limit=${size}&offset=${offset}`,{token:session()?.access_token,retry:1});
  if(!Array.isArray(page))throw Error('The league returned an unexpected response.');
  rows.push(...page);if(page.length<size)return rows;
 }
}
async function readRpc(name,body){return req('/rest/v1/rpc/'+name,{method:'POST',body,token:session()?.access_token,retry:1})}
async function optional(name,promise,warnings,fallback=[]){try{return await promise}catch(e){if(e.sessionExpired)throw e;warnings.push(name+' is temporarily unavailable.');return fallback}}
function unique(rows){return [...new Map(rows.filter(g=>!g.is_bye&&g.status!=='cancelled').map(g=>[g.id,g])).values()]}
function normalize(g){const home=g.primary_side==='home'||g.home_away==='home';return {...g,away:home?g.opponent_team:g.team_name,home:home?g.team_name:g.opponent_team,awayId:home?g.opponent_team_id:g.team_id,homeId:home?g.team_id:g.opponent_team_id,a:home?g.points_against:g.points_for,h:home?g.points_for:g.points_against,final:g.status==='completed'&&g.points_for!=null&&g.points_against!=null};}
function games(){return unique(model.scheduleGames).map(normalize).sort((a,b)=>a.week_number-b.week_number||String(a.kickoff_time||'').localeCompare(String(b.kickoff_time||''))||a.away.localeCompare(b.away))}
function teamData(id){return model.teams.find(t=>t.id===id)||model.programs.map(p=>({id:p.team_id,name:p.team_name,logo_url:p.logo_url,conference:p.conference})).find(t=>t.id===id)||{id,name:games().find(g=>g.homeId===id)?.home||games().find(g=>g.awayId===id)?.away||'Team'}}
const FALLBACK_ART='assets/graphite/football-fallback.webp';
const THEME_ART='assets/graphite/art/';
const ART_ROLES={account:'account-whistle.webp',coach:'coach-headset.webp',league:'league-stadium.webp'};
function fallbackArt(cls='',alt='',role='team'){const src=ART_ROLES[role]?THEME_ART+ART_ROLES[role]:FALLBACK_ART;return `<img class="${esc(cls)}" src="${src}" alt="${esc(alt)}" loading="lazy">`}
function imageFallback(img,role='team'){img.onerror=null;img.src=ART_ROLES[role]?THEME_ART+ART_ROLES[role]:FALLBACK_ART;img.alt='';img.classList.add('football-art')}
function logo(id,name=''){const t=teamData(id),src=safeImage(t.logo_url)||(t.espn_team_id?`https://a.espncdn.com/i/teamlogos/ncaa/500/${encodeURIComponent(t.espn_team_id)}.png`:'');return src?`<img class="team-logo" src="${src}" alt="" loading="lazy" onerror="imageFallback(this)">`:fallbackArt('team-logo football-art')}
function artwork(name){const slug=String(name||'').trim().toLowerCase();return ['pete','corey','jared','saif'].includes(slug)?ASSET+'coach-cards/'+slug+'-coach-card.webp':''}
function coachArt(name,cls=''){const src=artwork(name);return src?`<img class="${esc(cls)}" src="${src}" alt="${esc(name)}’s original coach card" onerror="imageFallback(this,'coach')">`:fallbackArt('coach-placeholder football-art '+cls,'Coaching headset artwork','coach')}
function myTeam(){return model.myPrograms.find(p=>p.season_id===season?.season_id)?.team_id||null}
function myCoach(){return model.myPrograms.find(p=>p.season_id===season?.season_id)?.person_id||model.myPrograms[0]?.person_id||null}
function program(id=selectedTeam){return model.programs.find(p=>p.team_id===id)}
function teamGames(id=selectedTeam){return games().filter(g=>g.homeId===id||g.awayId===id)}
function record(id){const s=model.standings.find(s=>s.team_id===id);if(s)return {w:num(s.wins),l:num(s.losses),pf:num(s.points_for),pa:num(s.points_against),gp:num(s.games_played)};const gs=teamGames(id).filter(g=>g.final);return gs.reduce((r,g)=>{const a=g.awayId===id,ours=num(a?g.a:g.h),theirs=num(a?g.h:g.a);r[ours>theirs?'w':'l']++;r.pf+=ours;r.pa+=theirs;r.gp++;return r},{w:0,l:0,pf:0,pa:0,gp:0})}
function kickoff(g){const net=g.network?' · '+g.network:'';if(g.final)return (g.overtime?'FINAL · OT':'FINAL')+net;if(!g.kickoff_time)return 'UPCOMING'+net;const d=new Date(g.kickoff_time);return isNaN(d)?'UPCOMING'+net:d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET'+net}
function safeStreamUrl(value){try{const url=new window.URL(String(value||'').trim());return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}}
function homeGameStreams(g){
 if(route!=='home'||!season?.is_active||!Array.isArray(model.coachStreams))return '';
 const seen=new Set(),links=[];
 for(const teamId of [g.awayId,g.homeId]){
   const coach=model.coachStreams.find(c=>c&&String(c.current_season_id)===String(season.season_id)&&String(c.current_team_id)===String(teamId));
   const url=safeStreamUrl(coach?.stream_url);
   if(!coach||!url||seen.has(coach.person_id))continue;
   seen.add(coach.person_id);
   const name=String(coach.coach_name||'Coach');
   const platform=['youtube','twitch'].includes(String(coach.stream_platform||'').toLowerCase())?coach.stream_platform:'Stream';
   links.push(`<a class="game-stream-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${esc(name)} on ${esc(platform)} (opens a new tab)">${ico('play')}<span>Watch ${esc(name)}</span><small>${esc(platform)} ↗</small></a>`);
 }
 return links.length?`<div class="game-stream-links" aria-label="Player streams">${links.join('')}</div>`:'';
}
const POST_TYPES={bowl:'BOWL',playoff:'PLAYOFF',conference_championship:'CONF TITLE',national_championship:'NATIONAL TITLE'};
function postseasonChip(g){const t=POST_TYPES[String(g?.game_type||'')];return t?`<span class="postseason-chip">${t}</span>`:''}
function card(g,featured=false){return `<article class="sports-card"><div class="cardmeta"><span>${featured?'YOUR TEAM · ':''}${esc(g.week_label||'Week '+g.week_number)}</span>${postseasonChip(g)}<span class="result-state">${esc(kickoff(g))}</span></div><button class="match-open" onclick="openGame('${uid(g.id)}')" aria-label="${esc(g.away+' at '+g.home)}"><div class="match-team">${logo(g.awayId,g.away)}<span>${esc(g.away)}</span><b class="${g.final&&g.a<g.h?'loser':''}">${esc(g.final?g.a:'—')}</b></div><div class="match-team">${logo(g.homeId,g.home)}<span>${esc(g.home)}</span><b class="${g.final&&g.h<g.a?'loser':''}">${esc(g.final?g.h:'—')}</b></div></button>${dynastyLine(g)}<div class="match-foot"><button onclick="openGame('${uid(g.id)}')">${g.final?'Game summary':'Matchup details'} ${ico('arrow')}</button><span class="match-context">${esc(g.event_name||g.network||'')}</span></div>${homeGameStreams(g)}</article>`}
function scheduleRows(gs,id=selectedTeam){return gs.map(g=>{const home=g.homeId===id,opp=home?g.away:g.home,oppId=home?g.awayId:g.homeId,ours=home?g.h:g.a,theirs=home?g.a:g.h;return `<button class="schedule-row" onclick="openGame('${uid(g.id)}')"><small>Wk ${esc(g.week_number)}</small>${logo(oppId,opp)}<span>${home?'vs':'at'} ${esc(opp)}</span><span class="outcome ${ours<theirs?'loss':''}">${g.final?(ours>theirs?'W':'L'):''}</span><b>${g.final?esc(ours+'–'+theirs):'—'}</b></button>`}).join('')}
async function start(){if(mutationPending)return;busy=true;loadError='';render();const serial=++loadSerial;try{const s=await refreshSession();if(serial!==loadSerial)return;if(!s){busy=false;render();return}const warnings=[];const [dynasties,teams,leaguePrograms]=await Promise.all([read('v_my_dynasties','order=joined_at.asc'),read('teams','order=id.asc','id,name,abbreviation,conference,logo_url,espn_team_id'),optional('Team badges',read('v_my_programs','order=dynasty_id.asc,season_id.asc,season_program_id.asc'),warnings,null)]);if(serial!==loadSerial)return;model={...model,dynasties,teams,leaguePrograms:leaguePrograms||[],leagueProgramsReady:leaguePrograms!==null,warnings};const pref=preference();const target=dynasties.find(d=>d.dynasty_id===pref.dynasty)||(dynasties.length===1?dynasties[0]:null);if(target)await loadDynasty(target.dynasty_id);else{dynasty=season=null;busy=false;route='leagues';render()}}catch(e){if(serial===loadSerial){busy=false;loadError=e.message;render()}}}
async function login(form){const b=form.querySelector('button[type=submit]'),notice=$('loginMessage');b.disabled=true;b.textContent='Signing in…';notice.textContent='';try{const s=await req('/auth/v1/token?grant_type=password',{method:'POST',body:{email:form.elements.email.value.trim(),password:form.elements.password.value},timeoutMs:12000});save(s);form.elements.password.value='';await start()}catch(e){notice.textContent=e.message;b.disabled=false;b.textContent='Sign in'}}
async function logout(){if(mutationPending)return;++loadSerial;const s=session();save(null);model={...model,dynasties:[],programs:[],standings:[],scheduleGames:[],career:[],stops:[],trophies:[],myPrograms:[],leaguePrograms:[],leagueProgramsReady:false,history:[],stories:[],rankings:[],coachStreams:[],warnings:[]};dynasty=season=null;trail=[];busy=false;loadError='';render();if(s?.access_token)try{await req('/auth/v1/logout',{method:'POST',token:s.access_token})}catch{}}
async function loadDynasty(id){const target=model.dynasties.find(d=>d.dynasty_id===id);if(!target||mutationPending)return;const serial=++loadSerial;busy=true;loadError='';render();try{const warnings=[];const [seasons,career,trophies,myPrograms,stops,history]=await Promise.all([read('v_dynasty_seasons',`dynasty_id=eq.${uid(id)}&order=season_number.desc`),optional('Career records',read('v_coach_career_stats',`dynasty_id=eq.${uid(id)}&order=wins.desc,person_id.asc`),warnings),optional('Trophy room',read('v_trophy_room',`dynasty_id=eq.${uid(id)}&order=season_number.desc,id.asc`),warnings),read('v_my_programs',`dynasty_id=eq.${uid(id)}&order=season_id.asc`),optional('Career journey',readRpc('get_coach_career_stops',{p_dynasty_id:id}),warnings),optional('Rivalry history',read('v_game_entries',`dynasty_id=eq.${uid(id)}&status=eq.completed&order=season_number.desc,week_number.desc,id.asc,person_id.asc`),warnings)]);if(serial!==loadSerial)return;dynasty=target;model={...model,seasons,career,trophies,myPrograms,stops,history,warnings,leaguePrograms:[...model.leaguePrograms.filter(p=>p.dynasty_id!==id),...myPrograms]};const selected=currentLeagueSeason();season=null;if(selected)await loadSeason(selected.season_id);else{busy=false;route='seasons';render()}}catch(e){if(serial===loadSerial){busy=false;loadError=e.message;render()}}}
async function loadSeason(id,destination=null){const target=model.seasons.find(s=>s.season_id===id);if(!target||mutationPending)return;const serial=++loadSerial;busy=true;loadError='';render();const d=uid(dynasty.dynasty_id),s=uid(id);try{const warnings=model.warnings.filter(w=>!/^Stories|^Rankings|^Active week/.test(w));const [programs,standings,scheduleGames,stories,rankings,activeWeek,coachStreams]=await Promise.all([read('v_season_programs',`dynasty_id=eq.${d}&season_id=eq.${s}${['active','setup'].includes(target.status)?'&active=eq.true':''}&order=coach_name.asc,season_program_id.asc`),read('v_program_standings',`dynasty_id=eq.${d}&season_id=eq.${s}&order=wins.desc,season_program_id.asc`),read('v_schedule_entries',`dynasty_id=eq.${d}&season_id=eq.${s}&order=week_number.asc,id.asc,team_id.asc`),optional('Stories',read('weekly_story_editions',`dynasty_id=eq.${d}&season_id=eq.${s}&order=week_number.desc`),warnings),optional('Rankings',read('weekly_rankings',`dynasty_id=eq.${d}&season_id=eq.${s}&poll_type=eq.top25&order=week_number.desc,rank.asc`),warnings),target.is_active?optional('Active week',readRpc('get_dynasty_active_week',{p_dynasty_id:d}),warnings,null):Promise.resolve(null),target.is_active?optional('Coach streams',readRpc('get_dynasty_coaches',{p_dynasty_id:d}),warnings,[]):Promise.resolve([])]);if(serial!==loadSerial)return;season=target;model={...model,programs,standings,scheduleGames,stories,rankings,coachStreams:Array.isArray(coachStreams)?coachStreams:[],warnings};const gs=games(),latest=Math.max(0,...gs.filter(g=>g.final).map(g=>num(g.week_number)));week=activeWeek!=null?num(activeWeek):latest;const pref=preference();selectedTeam=myTeam()||(pref.dynasty===d&&pref.season===s?pref.team:null)||programs[0]?.team_id||gs[0]?.homeId||null;selectedCoach=program(selectedTeam)?.person_id||myCoach()||careerLeader()?.person_id||null;conference=program()?.conference||'';selectedGame=selectedStory=null;scope='all';route=destination||(browsingArchive()?'seasonarchive':'home');trail=browsingArchive()?[{route:'seasons',scroll:0}]:[];updatedAt=new Date();busy=false;savePreference();historyReplace();render();afterSeasonLoaded()}catch(e){if(serial===loadSerial){busy=false;loadError=e.message;render()}}}
// Archive context belongs to navigation, never to the saved Home preference.
function navigationState(){return {route,dynastyId:dynasty?.dynasty_id,seasonId:season?.season_id,team:selectedTeam,coach:selectedCoach,game:selectedGame,story:selectedStory,week,scroll:$('screenViewport')?.scrollTop||0}}
function historyReplace(){history.replaceState(navigationState(),'','#'+route)}
async function restoreNavigation(state){
 const next=routes.has(state?.route)?state.route:'home';
 if(next==='home'){
  if(dynasty&&(busy||browsingArchive()||(state?.seasonId&&state.seasonId!==currentLeagueSeason()?.season_id)))return loadDynasty(dynasty.dynasty_id);
  route='home';historyReplace();render();return;
 }
 if(state?.dynastyId&&state.dynastyId!==dynasty?.dynasty_id)return go('home');
 if(state?.seasonId&&state.seasonId!==season?.season_id){
  if(!model.seasons.some(s=>s.season_id===state.seasonId))return go('home');
  const serial=loadSerial+1;await loadSeason(state.seasonId,next);
  if(loadSerial!==serial||loadError||busy)return;
 }
 route=next;
 if(state?.team!==undefined)selectedTeam=state.team;
 if(state?.coach!==undefined)selectedCoach=state.coach;
 if(state?.game!==undefined)selectedGame=state.game;
 if(state?.story!==undefined)selectedStory=state.story;
 if(state?.week!==undefined)week=num(state.week);
 historyReplace();render();if($('screenViewport'))$('screenViewport').scrollTop=state?.scroll||0;
}
function go(r){if(mutationPending||!routes.has(r))return;if(r==='home'&&dynasty&&(busy||browsingArchive()))return loadDynasty(dynasty.dynasty_id);if(r==='trophies')trophyPerson=route==='coach'?selectedCoach:null;if(route!==r){historyReplace();trail.push(navigationState())}route=r;history.pushState(navigationState(),'','#'+r);render()}
function back(){if(mutationPending)return;return restoreNavigation(trail.pop()||{route:'home'})}
window.addEventListener('popstate',e=>{if(mutationPending){historyReplace();return}const next=routes.has(location.hash.slice(1))?location.hash.slice(1):'home';if(route==='advanced'&&next!=='advanced'){returnFromTools(next);return}restoreNavigation({...e.state,route:next})});
function openTeam(id){if(mutationPending)return;selectedTeam=id;selectedCoach=program(id)?.person_id||selectedCoach;go('team')}
function openCoach(id){if(mutationPending)return;selectedCoach=id;go('coach')}
function openGame(id){if(mutationPending)return;selectedGame=id;go('game')}
function chooseWeek(w){week=num(w);render()}
function chooseScope(s){scope=s;render()}
function jump(id){$(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'})}
function filterTeams(q){document.querySelectorAll('[data-search]').forEach(el=>el.hidden=!el.dataset.search.includes(q.toLowerCase()))}
function careerLeader(){return model.career[0]}
function coachInfo(){return model.career.find(c=>c.person_id===selectedCoach)||model.programs.find(c=>c.person_id===selectedCoach)||{coach_name:'Coach'}}
function honors(person){return person?model.trophies.filter(t=>t.person_id===person):model.trophies}
function trophyAsset(t){const type=String(t.type||'').toLowerCase();return ASSET+'trophy-vault/'+(type.includes('conference')?'conference':type.includes('bowl')?'bowl':'award')+'.webp'}
function trophyGrid(items,limit){const shown=limit?items.slice(0,limit):items;return shown.length?`<div class="${limit?'honors-strip':'trophygrid'}">${shown.map(t=>`<button onclick="showHonor('${uid(t.id)}')"><img src="${trophyAsset(t)}" alt="" loading="lazy"><strong>${esc(t.name||t.type)}</strong><small>Season ${esc(t.season_number)} · ${esc(t.coach_name||t.recipient_name||t.team_name||'')}</small></button>`).join('')}</div>`:empty('No honors have been recorded here yet.')}
function closeSheet(){if(!mutationPending)$('detailSheet').close()}
function openSheet(name,body){const d=$('detailSheet');d.innerHTML=`<div class="sheet-head"><span id="sheetTitle">${esc(name)}</span><button autofocus onclick="closeSheet()" aria-label="Close detail">${ico('close')}</button></div><div class="sheet-body">${body}</div>`;d.showModal()}
function showHonor(id){const t=model.trophies.find(t=>t.id===id);if(!t)return;openSheet('Career honor',title('Season '+t.season_number,t.name||t.type)+`<img class="awardhero" src="${trophyAsset(t)}" alt="">`+table(['Detail','Recorded value'],[['Coach',esc(t.coach_name||'—')],['Team',esc(t.team_name||'—')],['Recipient',esc(t.recipient_name||'—')],['Type',esc(t.type||'—')]]))}
function showCoachCard(){const c=coachInfo();if(artwork(c.coach_name))openSheet(c.coach_name+' · Coach card',coachArt(c.coach_name,'portrait'))}
function latestEdition(){return model.stories[0]}
function storyItems(){const edition=latestEdition(),payload=edition?.payload||{};const seen=new Set();return [payload.lead,...(Array.isArray(payload.recaps)?payload.recaps:[]),...(Array.isArray(payload.previews)?payload.previews:[])].filter(s=>s&&typeof s.headline==='string'&&!/weekly desk/i.test(s.headline)&&!/no completed result recorded/i.test(s.fact||s.body||'')).filter(s=>{const key=s.id||s.headline;if(seen.has(key))return false;seen.add(key);return true})}
function openStory(i){selectedStory=num(i);go('article')}
function storyBrand(s){const g=games().find(g=>g.id===s.game_id),t=model.teams.find(t=>t.id===s.team_id||t.name===s.team||t.name===s.team_name)||model.programs.find(p=>p.team_id===s.team_id||p.team_name===s.team||p.team_name===s.team_name);const id=s.team_id||t?.id||t?.team_id||g?.awayId;return id?`<span class="story-brand">${logo(id)}</span>`:''}
function homeReport(){const lead=storyItems()[0];return lead?section('The Saturday report','stories','All stories')+`<button class="story-card report-lead" onclick="openStory(0)"><div class="story-copy"><span class="eyebrow">WEEK ${esc(latestEdition()?.week_number)} · LEAD STORY</span><h2>${esc(lead.headline)}</h2><p>${esc(lead.fact||lead.body||'')}</p></div>${storyBrand(lead)}</button>`+newsStories(3,1):''}
function newsStories(limit,offset=0){const items=storyItems();return items.length?items.slice(offset,limit?offset+limit:items.length).map((s,i)=>`<button class="news-row" onclick="openStory(${i+offset})"><span><strong>${esc(s.headline)}</strong><small>${esc(s.fact||s.team||'The Saturday report')}</small></span>${storyBrand(s)}</button>`).join(''):empty('No game stories to report yet. Check Scores for the latest schedule and results.')}
function home(){const mine=myTeam(),gs=mine?teamGames(mine):games(),featured=gs.find(g=>num(g.week_number)===week)||gs.filter(g=>!g.final)[0]||gs.filter(g=>g.final).at(-1),stories=storyItems(),lead=stories[0];return `<div class="welcome-line"><button class="leaguepick" onclick="go('leagues')">${esc(dynasty.name)} ${ico('down')}</button><button onclick="go('seasons')">Season ${esc(season.season_number)} · Week ${week}</button></div>${title('For you','Your league, your Saturday')}${featured?card(featured,!!mine):empty('No games have been scheduled for this season.')}<div class="quicklinks">${button('All scores','scores','chip')}${mine?`<button onclick="openTeam('${uid(mine)}')">My team</button>`:''}${myCoach()?`<button onclick="openCoach('${uid(myCoach())}')">My coach</button>`:''}${button('League analysis','analysis','chip')}</div>${homeReport()}${section('Around the league','scores')}${games().filter(g=>num(g.week_number)===week&&g.id!==featured?.id).slice(0,3).map(g=>card(g)).join('')||empty('No other games are recorded for this week.')}${row('The conference picture','Standings, league records and the Top 25',`onclick="go('standings')"`)}`}
function scores(){let weeks=[...new Set([...games().map(g=>num(g.week_number)),week])].sort((a,b)=>a-b);let list=games().filter(g=>num(g.week_number)===week).filter(g=>scope==='mine'?(g.awayId===myTeam()||g.homeId===myTeam()):scope==='final'?g.final:scope==='upcoming'?!g.final:true);return title(dynasty.name,'Scores')+`<div class="weekstrip" aria-label="Choose week">${weeks.map(w=>`<button class="${w===week?'selected':''}" aria-pressed="${w===week}" onclick="chooseWeek(${w})">Week ${w}</button>`).join('')}</div><div class="filterbar">${[['all','All games'],['mine','My team'],['final','Final'],['upcoming','Upcoming']].map(([s,t])=>`<button class="${scope===s?'sel':''}" aria-pressed="${scope===s}" onclick="chooseScope('${s}')">${t}</button>`).join('')}</div>${typeof bracketSection==='function'?bracketSection():''}<p class="sport-note">${list.length} ${list.length===1?'game':'games'} · Season ${esc(season.season_number)}</p>${list.map(g=>card(g)).join('')||empty(scope==='mine'&&!myTeam()?'You have no assigned team in this season.':'No games match this week and filter.')}`}
function teams(){const p=model.programs.filter(t=>t.person_id),ids=[...new Set(games().flatMap(g=>[g.awayId,g.homeId]))].filter(id=>!p.some(t=>t.team_id===id));return title(dynasty.name,'Teams & coaches')+`<div class="searchbox">${ico('search')}<input aria-label="Search teams and coaches" placeholder="Find a team or coach" oninput="filterTeams(this.value)"></div>${section('Foundry programs')}${p.map(t=>`<button class="team-directory-row" data-search="${esc((t.team_name+' '+t.coach_name).toLowerCase())}" onclick="openTeam('${uid(t.team_id)}')">${logo(t.team_id,t.team_name)}<span><strong>${esc(t.team_name)}</strong><small>${esc(t.coach_name||'Coach not assigned')}${t.team_id===myTeam()?' · Your team':''}</small></span>${ico('arrow')}</button>`).join('')||empty('No coach assignments are recorded for this season.')}${section('Around the country')}${ids.sort((a,b)=>teamData(a).name.localeCompare(teamData(b).name)).map(id=>{const t=teamData(id);return `<button class="team-directory-row" data-search="${esc(t.name.toLowerCase())}" onclick="openTeam('${uid(id)}')">${logo(id,t.name)}<span><strong>${esc(t.name)}</strong><small>${esc(t.conference||'')}</small></span>${ico('arrow')}</button>`}).join('')}`}
function team(){if(!selectedTeam)return empty('Choose a team from the directory.');const t=teamData(selectedTeam),p=program(),r=record(selectedTeam),gs=teamGames(),latest=gs.filter(g=>g.final).at(-1);return `<div class="team-header">${logo(selectedTeam,t.name)}<div><div class="eyebrow">${esc(p?.conference||t.conference||'PROGRAM')}</div><h1>${esc(t.name)}</h1><p>${r.w}–${r.l} overall · Season ${esc(season.season_number)}</p></div></div><nav class="section-jumps" aria-label="Team sections">${['Latest','Schedule','Stats','Coach'].map(k=>`<button onclick="jump('team${k}')">${k}</button>`).join('')}</nav><section id="teamLatest" class="team-section">${section('Latest result')}${latest?card(latest):empty('No completed games have been recorded.')}</section><section id="teamSchedule" class="team-section">${section('Season schedule')}${scheduleRows(gs)||empty('No schedule is available.')}</section><section id="teamStats" class="team-section">${section('Season at a glance')}${statline([[r.gp?fmt(r.pf/r.gp):'—','Points per game'],[r.gp?fmt(r.pa/r.gp):'—','Points allowed'],[r.gp?fmt((r.pf-r.pa)/r.gp):'—','Average margin']])}</section><section id="teamCoach" class="team-section">${section('On the sideline')}${p?.person_id?`<button class="coach-mini" onclick="openCoach('${uid(p.person_id)}')">${coachArt(p.coach_name)}<span><strong>${esc(p.coach_name)}</strong><small>Head coach · ${esc(t.name)}</small><small>Career, honors & rivalries</small></span>${ico('arrow')}</button>`:empty('This is a CPU program. No Foundry coach is assigned.')}</section>`}
function coach(){const c=coachInfo(),items=honors(selectedCoach),stops=model.stops.filter(s=>s.person_id===selectedCoach),active=model.programs.find(p=>p.person_id===selectedCoach);return `<div class="coach-feature"><div>${title('Coach profile',c.coach_name,dynasty.name)}${active?`<button class="mini-program" onclick="openTeam('${uid(active.team_id)}')">${logo(active.team_id,active.team_name)} ${esc(active.team_name)}</button>`:''}</div><button class="card-preview" onclick="showCoachCard()" ${artwork(c.coach_name)?'':'disabled'} aria-label="Open full coach card">${coachArt(c.coach_name)}${artwork(c.coach_name)?'<span>View coach card ↗</span>':''}</button></div>${statline([[c.wins!=null?c.wins+'–'+c.losses:'—','Career record'],[items.length,'Recorded honors'],[new Set(stops.map(s=>s.season_id)).size,'Seasons']])}<nav class="section-jumps"><button onclick="jump('coachHonors')">Honors</button><button onclick="jump('coachCareer')">Career</button><button onclick="jump('coachRivals')">Rivalries</button></nav><section class="team-section" id="coachHonors">${section('Trophy shelf','trophies','Trophy room')}${trophyGrid(items,3)}</section><section class="team-section" id="coachCareer">${section('Career journey','career','Full career')}${careerRows(stops.slice(0,3))}</section><section class="team-section" id="coachRivals">${section('Head-to-head','rivalries','All rivalries')}${rivalryRows().slice(0,3).join('')||empty('No games against other Foundry coaches are recorded.')}</section><p class="sport-note">Career totals cover ${esc(dynasty.name)} across its recorded seasons.</p>`}
function careerRows(stops){return stops.length?`<div class="career-short">${stops.map(s=>`<article><strong>${esc(s.team_name)}</strong><small>Season ${esc(s.season_number)} · ${esc(s.wins)}–${esc(s.losses)}${s.current_assignment?' · Current assignment':''}</small></article>`).join('')}</div>`:empty('No career stops are available.')}
function h2hMeetings(){
 const byId=new Map();
 (model.history||[]).filter(g=>g&&g.status==='completed'&&g.points_for!=null&&g.points_against!=null).forEach(g=>{
  if(!byId.has(g.id))byId.set(g.id,[]);
  byId.get(g.id).push(g);
 });
 const out=[];
 byId.forEach(rows=>{
  const byPerson=new Map();
  rows.forEach(r=>{if(r.person_id&&!byPerson.has(r.person_id))byPerson.set(r.person_id,r)});
  if(byPerson.size!==2)return;
  const [a,b]=[...byPerson.values()];
  out.push({a,b});
 });
 return out.sort((x,y)=>Number(x.a.season_number||0)-Number(y.a.season_number||0)||Number(x.a.week_number||0)-Number(y.a.week_number||0));
}
function seriesBoard(){
 const pairs=new Map();
 h2hMeetings().forEach(({a,b})=>{
  const key=[a.person_id,b.person_id].sort().join('|');
  if(!pairs.has(key))pairs.set(key,{p1:a.person_id,p2:b.person_id,names:{[a.person_id]:a.coach_name||recordCoachName(a.person_id),[b.person_id]:b.coach_name||recordCoachName(b.person_id)},wins:{},meetings:[]});
  const s=pairs.get(key);
  const winner=a.points_for>a.points_against?a.person_id:b.person_id;
  s.wins[winner]=(s.wins[winner]||0)+1;
  s.meetings.push({season:a.season_number,week:a.week_number,winner,line:`${a.team_name} ${a.points_for}–${a.points_against} ${b.team_name}`});
 });
 return [...pairs.values()].map(s=>{
  const last=s.meetings[s.meetings.length-1];
  let streakN=0;
  for(let i=s.meetings.length-1;i>=0;i--){if(s.meetings[i].winner===last.winner)streakN++;else break}
  return {...s,w1:s.wins[s.p1]||0,w2:s.wins[s.p2]||0,last,streakPid:last.winner,streakN};
 }).sort((x,y)=>(y.w1+y.w2)-(x.w1+x.w2));
}
function rivalryRows(){
 return seriesBoard().filter(s=>s.p1===selectedCoach||s.p2===selectedCoach).map(s=>{
  const opp=s.p1===selectedCoach?s.p2:s.p1,mine=s.p1===selectedCoach?s.w1:s.w2,theirs=s.p1===selectedCoach?s.w2:s.w1;
  const streak=s.streakN>1?(s.streakPid===selectedCoach?` · Won ${s.streakN} straight`:` · Lost ${s.streakN} straight`):'';
  return `<div class="series-row"><span>vs ${esc(s.names[opp])}<small class="series-detail">Last: ${esc(s.last.line)} · S${esc(s.last.season)} Wk ${esc(s.last.week)}${streak}</small></span><b>${mine}–${theirs}</b></div>`;
 });
}
function nextShowdown(){
 const upcoming=games().filter(g=>!g.final&&!g.is_bye&&g.person_id&&g.opponent_person_id).sort((a,b)=>Number(a.week_number||0)-Number(b.week_number||0));
 return upcoming[0]||null;
}
function rivalriesPage(){
 const board=seriesBoard();
 let h=title(dynasty.name,'Rivalries','Every coach-vs-coach series in this dynasty.');
 const nx=nextShowdown();
 if(nx){const coachOf=tid=>recordCoachName(tid===nx.team_id?nx.person_id:nx.opponent_person_id);h+=section('Next showdown')+`<div class="office-list-row"><div><b>${esc(nx.away)} at ${esc(nx.home)}</b><div class="muted">${esc(coachOf(nx.awayId))} vs ${esc(coachOf(nx.homeId))} · Week ${esc(nx.week_number)}</div></div><strong>H2H</strong></div>`}
 if(!board.length)return h+empty('No recorded games between Foundry coaches yet.');
 h+=section('Who owns the league?');
 h+=board.map(s=>{
  const lead=s.w1===s.w2?`Tied ${s.w1}–${s.w2}`:`${esc(s.names[s.w1>s.w2?s.p1:s.p2])} leads ${Math.max(s.w1,s.w2)}–${Math.min(s.w1,s.w2)}`;
  const streak=s.streakN>1?` · ${esc(s.names[s.streakPid])} has won ${s.streakN} straight`:'';
  return `<div class="office-list-row"><div><b>${esc(s.names[s.p1])} vs ${esc(s.names[s.p2])}</b><div class="muted">Last: ${esc(s.last.line)} · S${esc(s.last.season)} Wk ${esc(s.last.week)}${streak}</div></div><strong>${lead}</strong></div>`;
 }).join('');
 h+=section(coachInfo().coach_name+' — series detail')+(rivalryRows().join('')||empty('No recorded games against other Foundry coaches.'));
 return h;
}
function teamStreaks(){const byTeam=new Map();games().filter(g=>g.final).forEach(g=>{[[g.awayId,Number(g.a)>Number(g.h)],[g.homeId,Number(g.h)>Number(g.a)]].forEach(([id,won])=>{if(id==null)return;if(!byTeam.has(id))byTeam.set(id,[]);byTeam.get(id).push({wk:Number(g.week_number)||0,won})})});const out=new Map();byTeam.forEach((list,id)=>{list.sort((a,b)=>a.wk-b.wk);const last=list[list.length-1];if(!last)return;let n=0;for(let i=list.length-1;i>=0;i--){if(list[i].won===last.won)n++;else break}out.set(id,(last.won?'W':'L')+n)});return out}
function standings(){const streaks=teamStreaks(),cm=conferenceModel(model),confs=[...new Set(cm.teams.map(t=>t.conf))].sort();if(!confs.includes(conference))conference=confs[0]||'';let ts=cm.teams.filter(t=>t.conf===conference),american=cm.isAmerican(conference);ts=american?cm.americanRows(ts):ts.sort(cm.sortRows);function standingsTable(list){return table(['#','TEAM','CONF','OVERALL','PCT','STREAK'],list.map((t,i)=>[american?(t.racePlayed?(t.raceTied?'T':'')+t.raceRank:'—'):String(i+1),`<button class="table-team" onclick="openTeam('${uid(t.id)}')">${logo(t.id,t.name)}<span>${esc(t.name)}${t.dynasty?'<small>FOUNDRY</small>':''}</span></button>`,t.cw+'–'+t.cl,t.w+'–'+t.l,t.cw+t.cl?(t.cw/(t.cw+t.cl)).toFixed(3):'—',streaks.get(t.id)||'—']))}return title(dynasty.name,'Standings')+`<div class="filterbar">${button('Conference','standings','sel')}${button('Top 25','rankings')}${button('Season analysis','analysis')}</div><label for="conferenceSelect">Conference</label><select id="conferenceSelect" onchange="conference=this.value;render()">${confs.map(c=>`<option value="${esc(c)}" ${c===conference?'selected':''}>${esc(c)}</option>`).join('')}</select>${ts.length?(cm.isSunBelt(conference)?['East','West',null].map(d=>{const rows=ts.filter(t=>cm.sunBeltDivision(t.name)===d);return rows.length?section(d?d+' Division':'Unassigned')+standingsTable(rows):''}).join(''):standingsTable(ts)):empty('Conference standings are not available yet.')}<p class="sport-note">Based on recorded results. ${american?'T indicates an unresolved tiebreak; missing tiebreak inputs do not become an overall-record tiebreak. Final championship participants are not certified here.':'Conference win percentage, with the existing main-app ordering. Standings are provisional.'}</p>`}
function rankings(){const weeks=[...new Set(model.rankings.map(r=>Number(r.week_number)))].sort((a,b)=>a-b),latest=weeks[weeks.length-1],prev=weeks.length>1?weeks[weeks.length-2]:null,prevByTeam=new Map(model.rankings.filter(r=>Number(r.week_number)===prev).map(r=>[r.team_id,Number(r.rank)])),rs=model.rankings.filter(r=>Number(r.week_number)===latest).sort((a,b)=>Number(a.rank)-Number(b.rank));const trend=r=>{if(prev==null)return '<span class="trend flat">—</span>';const p=prevByTeam.get(r.team_id);if(p==null)return '<span class="trend new">NEW</span>';const d=p-Number(r.rank);return d>0?`<span class="trend up">▲${d}</span>`:d<0?`<span class="trend down">▼${-d}</span>`:'<span class="trend flat">—</span>'};return title(dynasty.name,'Top 25',latest!=null?'Latest recorded poll · Week '+latest:'No poll recorded')+table(['RANK','TEAM','RECORD','TREND'],rs.map(r=>[esc(r.rank),esc(teamData(r.team_id).name),esc(r.wins+'–'+r.losses),trend(r)]))+(rs.length?'':empty('No rankings have been entered for this season.'))}
const TIER_LABELS=['The Standard','The Challenger','The Hunter','The Wildcard'];
function isNattyT(t){return /national/i.test(String(t.type||''))||/national championship/i.test(String(t.name||''))}
function isConfT(t){return /conference_championship/i.test(String(t.type||''))}
function isBowlT(t){return /bowl_championship/i.test(String(t.type||''))}
function isHeismanT(t){return /heisman/i.test(String(t.type||''))}
function legacyCareerRows(){return [...(model.career||[])].filter(c=>c.coach_name).sort((a,b)=>Number(b.wins||0)-Number(a.wins||0))}
function legacyActiveSeasonRow(){const ss=[...(model.seasons||[])].sort((a,b)=>Number(a.season_number||0)-Number(b.season_number||0));return ss.find(s=>s.is_active)||ss[ss.length-1]||null}
function coachBadge(personId){const p=(model.programs||[]).find(x=>String(x.person_id)===String(personId));return leagueBadge(p||null)}
function throneHTML(){
 const done=(model.seasons||[]).filter(s=>String(s.status)==='completed');
 const nattys=(model.trophies||[]).filter(isNattyT).sort((a,b)=>Number(b.season_number)-Number(a.season_number));
 const nCoaches=legacyCareerRows().length;
 if(nattys.length){const last=nattys[0],total=nattys.length,years=[...new Set(nattys.map(t=>'S'+t.season_number))].join(' · ');
  return `<div class="throne-card"><div class="throne-crown">♛</div><div class="throne-num">${total}</div><div class="throne-label">National championship${total===1?'':'s'}</div><p><b>${esc(last.coach_name)}</b> sits the throne${total>1?` — ${total} titles (${esc(years)})`:` — ${esc(last.name||'champions')}, season ${last.season_number}`}.</p><span>Everybody else is chasing.</span></div>`}
 if(done.length)return `<div class="throne-card"><div class="throne-crown">♛</div><div class="throne-num">0</div><div class="throne-label">National titles in ${done.length} completed season${done.length===1?'':'s'}</div><p>Conference banners hang. Bowl trophies gather dust. But across ${done.length} season${done.length===1?'':'s'} and ${nCoaches} coach${nCoaches===1?'':'es'}, <b>nobody has taken the throne</b>.</p><span>Who gets there first?</span></div>`;
 const act=legacyActiveSeasonRow();
 return `<div class="throne-card"><div class="throne-crown">♛</div><div class="throne-num">1</div><div class="throne-label">Season underway — history being written</div><p>Every dynasty starts 0–0. The first banner${act?` of season ${act.season_number}`:''} will be the first line of this league's story.</p><span>Come back after the confetti.</span></div>`;
}
function tiersHTML(){
 const rows=legacyCareerRows();if(!rows.length)return '';
 return section('All-time tiers')+rows.map((c,i)=>{
  const gp=Number(c.games_played||0),w=Number(c.wins||0),l=Number(c.losses||0),pct=gp?(w/gp*100):0,pd=Number(c.point_differential||0);
  const label=TIER_LABELS[Math.min(i,TIER_LABELS.length-1)],small=gp>0&&gp<20;
  return `<article class="tier-card"><div class="tier-rank">${i+1}</div><div class="tier-main">${coachBadge(c.person_id)}<div class="tier-id"><b>${esc(c.coach_name)}</b><span>${label}${small?' · <em>small sample</em>':''}</span></div></div><div class="tier-stats"><div><small>Record</small><b>${w}–${l}</b></div><div><small>Win %</small><b>${pct.toFixed(1)}</b></div><div><small>Point diff</small><b class="${pd>=0?'pos':'neg'}">${pd>0?'+':''}${pd}</b></div><div><small>Ranked wins</small><b>${Number(c.ranked_wins||0)}</b></div></div></article>`;
 }).join('');
}
function lastTrophySeason(key,pred){let best=null;(model.trophies||[]).forEach(t=>{if(String(t.person_id||t.coach_name||'')===key&&pred(t)){const n=Number(t.season_number);if(best===null||n>best)best=n}});return best}
function droughtsHTML(){
 const coaches=legacyCareerRows();if(!coaches.length)return '';
 const act=legacyActiveSeasonRow(),actN=act?Number(act.season_number):0;
 const doneCount=(model.seasons||[]).filter(s=>String(s.status)==='completed').length;
 const txt=last=>last===null?'Never':actN-last===0?'Defending':`${actN-last} season${actN-last===1?'':'s'}`;
 const rows=coaches.map(c=>{
  const key=String(c.person_id||c.coach_name||''),lc=lastTrophySeason(key,isConfT),lb=lastTrophySeason(key,isBowlT);
  return `<div class="drought-row"><div class="drought-coach">${coachBadge(c.person_id)}<b>${esc(c.coach_name)}</b></div><div class="drought-cells"><div><small>Conf title</small><b class="${lc===null?'neg':''}">${txt(lc)}</b></div><div><small>Bowl win</small><b class="${lb===null?'neg':''}">${txt(lb)}</b></div></div></div>`;
 }).join('');
 const leagueRow=(model.trophies||[]).some(isNattyT)?'':`<div class="drought-row league"><div class="drought-coach"><span class="throne-mini">♛</span><b>The League</b></div><div class="drought-cells"><div><small>National title</small><b class="neg">${doneCount} season${doneCount===1?'':'s'} · still waiting</b></div></div></div>`;
 return section('The droughts')+leagueRow+rows;
}
function milestonesHTML(){
 const coaches=legacyCareerRows();if(!coaches.length)return '';
 const hCount={};(model.trophies||[]).forEach(t=>{if(isHeismanT(t)){const k=String(t.person_id||t.coach_name||'');hCount[k]=(hCount[k]||0)+1}});
 const cards=coaches.map(c=>{
  const w=Number(c.wins||0),m=Math.ceil((w+1)/10)*10,key=String(c.person_id||c.coach_name||''),h=hCount[key]||0;
  const pct=Math.min(100,Math.round(w/m*100)),chase=h>0?` · ${h}× Heisman — #${h+1} within reach`:'';
  return `<div class="ms-card"><div class="ms-head">${coachBadge(c.person_id)}<div><b>${esc(c.coach_name)}</b><span>${m} career wins</span></div><em>${m-w} away</em></div><div class="ms-bar"><i style="width:${pct}%"></i></div><div class="ms-foot">${w} / ${m}${esc(chase)}</div></div>`;
 }).join('');
 const nattyCard=(model.trophies||[]).some(isNattyT)?'':`<div class="ms-card league"><div class="ms-head"><span class="throne-mini">♛</span><div><b>First national title</b><span>The whole league is waiting</span></div><em>unclaimed</em></div><div class="ms-bar"><i style="width:0%"></i></div><div class="ms-foot">0 / 1 · ${(model.seasons||[]).filter(s=>String(s.status)==='completed').length} seasons gone</div></div>`;
 return section('Milestone watch')+cards+nattyCard;
}
function legacy(){return title(dynasty.name,'Legacy')+`<img class="legacy-hero" src="${THEME_ART}legacy-room.webp" alt="The Foundry trophy collection">${throneHTML()}${section('The trophy room','trophies','All honors')}${trophyGrid(model.trophies,3)}${section('Career leaders')}${table(['COACH','WINS','LOSSES'],model.career.slice(0,6).map(c=>[`<button class="textlink" onclick="openCoach('${uid(c.person_id)}')">${esc(c.coach_name)}</button>`,esc(c.wins),esc(c.losses)]))}${tiersHTML()}${droughtsHTML()}${milestonesHTML()}${section('Every season leaves a story','seasons','Season archive')}${model.seasons.map(s=>row('Season '+s.season_number,s.status,`onclick="loadSeason('${uid(s.season_id)}')"`)).join('')}<p class="sport-note">Honors and career records belong to the selected dynasty.</p>`}
function gamePage(){const g=games().find(g=>g.id===selectedGame);if(!g)return empty('Choose a game from Scores.');const win=g.a>g.h?g.away:g.home;return title(g.week_label||'Week '+g.week_number,g.away+' at '+g.home)+`<div class="game-scorehero"><div>${logo(g.awayId,g.away)}<strong>${esc(g.away)}</strong><b>${esc(g.final?g.a:'—')}</b><small>Away</small></div><div class="game-status">${g.final?'Final'+(g.overtime?' · OT':''):'Upcoming'}</div><div>${logo(g.homeId,g.home)}<strong>${esc(g.home)}</strong><b>${esc(g.final?g.h:'—')}</b><small>Home</small></div></div><div class="info-strip">${esc(g.final?win+' wins by '+Math.abs(g.a-g.h):kickoff(g))}</div>${section(g.final?'Game summary':'Before kickoff')}<p class="article-inline">${esc(g.final?win+' finishes on top, '+Math.max(g.a,g.h)+'–'+Math.min(g.a,g.h)+'.':'The final result has not been recorded.')}</p>${POST_TYPES[String(g.game_type||'')]?`<div class="postseason-banner">${esc(g.event_name||POST_TYPES[String(g.game_type||'')])}</div>`:g.event_name?`<p class="muted">${esc(g.event_name)}</p>`:''}${row(g.away,'Team overview, schedule and coach',`onclick="openTeam('${uid(g.awayId)}')"`)}${row(g.home,'Team overview, schedule and coach',`onclick="openTeam('${uid(g.homeId)}')"`)}${row('Week '+g.week_number+' scoreboard','Other results and upcoming games',`onclick="week=${num(g.week_number)};go('scores')"`)}<p class="sport-note">Score entry is available in the main app. This preview is read-only.</p>`}
function analysis(){return title(dynasty.name,'Season analysis','Scoring and records from completed games.')+table(['TEAM','W–L','PPG','ALLOWED'],model.standings.map(s=>[`<button class="textlink" onclick="openTeam('${uid(s.team_id)}')">${esc(s.team_name)}</button>`,esc(s.wins+'–'+s.losses),num(s.games_played)?fmt(s.points_for/s.games_played):'—',num(s.games_played)?fmt(s.points_against/s.games_played):'—']))+section('Go deeper')+row('Conference picture','League records and the current race',`onclick="go('standings')"`)+row('Published Top 25','Latest recorded national poll',`onclick="go('rankings')"`)}
function recordBookGames(){
 const quality=g=>{const m=String(g.result_method||g.source||'').toLowerCase();return /manual|hq|user|player/.test(m)?3:/sim|import|cpu/.test(m)?1:2};
 const eligible=(model.history||[]).filter(g=>g&&g.status==='completed'&&!g.is_bye&&g.person_id&&Number.isFinite(Number(g.points_for))&&Number.isFinite(Number(g.points_against)));
 const byKey=new Map();
 eligible.forEach(g=>{
  const key=[g.person_id,g.season_id||g.season_number||'',g.week_number??'',String(g.team_name||'').toLowerCase(),String(g.opponent_team||'').toLowerCase()].join('|');
  const prev=byKey.get(key);if(!prev||quality(g)>quality(prev))byKey.set(key,g);
 });
 return [...byKey.values()];
}
function recordCoachName(personId){return model.career.find(c=>c.person_id===personId)?.coach_name||model.programs.find(p=>p.person_id===personId)?.coach_name||'Coach'}
function longestWinStreak(personId,games){
 const mine=games.filter(g=>g.person_id===personId).sort((a,b)=>Number(a.season_number||0)-Number(b.season_number||0)||Number(a.week_number||0)-Number(b.week_number||0));
 let best=0,run=0;
 mine.forEach(g=>{if(g.result==='W'){run++;best=Math.max(best,run)}else if(g.result==='L')run=0});
 return best;
}
function bestSeason(personId,games){
 const completed=new Set(model.seasons.filter(s=>{const st=String(s?.status||'').toLowerCase();return !s?.is_active&&st!=='active'&&st!=='setup'&&Number(s?.season_number)!==Number(season?.season_number)}).map(s=>Number(s.season_number)));
 const by=new Map();
 games.filter(g=>g.person_id===personId&&completed.has(Number(g.season_number))).forEach(g=>{
  const n=Number(g.season_number||0);if(!by.has(n))by.set(n,{season:n,wins:0,losses:0,pf:0});
  const r=by.get(n);if(g.result==='W')r.wins++;if(g.result==='L')r.losses++;r.pf+=Number(g.points_for||0);
 });
 return [...by.values()].sort((a,b)=>{const ap=a.wins/Math.max(1,a.wins+a.losses),bp=b.wins/Math.max(1,b.wins+b.losses);return bp-ap||b.wins-a.wins||b.pf-a.pf})[0]||null;
}
function leagueExtremes(games){
 const mov=g=>Number(g.points_for)-Number(g.points_against);
 const pick=cmp=>games.reduce((b,g)=>!b||cmp(g,b)?g:b,null);
 return {
  blowout:pick((g,b)=>mov(g)>mov(b)),
  worstLoss:pick((g,b)=>mov(g)<mov(b)),
  shootout:pick((g,b)=>(Number(g.points_for)+Number(g.points_against))>(Number(b.points_for)+Number(b.points_against))),
  mostPoints:pick((g,b)=>Number(g.points_for)>Number(b.points_for)),
  nailbiter:pick((g,b)=>Math.abs(mov(g))<Math.abs(mov(b)))
 };
}
function recordsPage(){
 const games=recordBookGames();
 const head=title(dynasty.name,'Record book','All-time marks from completed coach games.');
 if(!games.length)return head+empty('No completed coach games yet — the book opens with the first final.');
 const ex=leagueExtremes(games);
 const line=(label,g,stat)=>g?`<div class="office-list-row"><div><b>${label}</b><div class="muted">${esc(recordCoachName(g.person_id))} · ${esc(g.team_name)} ${esc(g.points_for)}–${esc(g.points_against)} ${esc(g.opponent_team)} · Season ${esc(g.season_number)}, Week ${esc(g.week_number)}</div></div><strong>${stat}</strong></div>`:'';
 const coaches=[...new Set(games.map(g=>g.person_id))].map(pid=>({pid,streak:longestWinStreak(pid,games),best:bestSeason(pid,games)})).sort((a,b)=>b.streak-a.streak);
 return head+section('League extremes')+'<div class="office-list">'
  +line('Biggest blowout',ex.blowout,'+'+(Number(ex.blowout.points_for)-Number(ex.blowout.points_against)))
  +line('Worst loss',ex.worstLoss,String(Number(ex.worstLoss.points_for)-Number(ex.worstLoss.points_against)))
  +line('Highest-scoring game',ex.shootout,(Number(ex.shootout.points_for)+Number(ex.shootout.points_against))+' pts')
  +line('Most points in a game',ex.mostPoints,ex.mostPoints.points_for+' pts')
  +line('Closest game',ex.nailbiter,Math.abs(Number(ex.nailbiter.points_for)-Number(ex.nailbiter.points_against))+' pt margin')
  +'</div>'+section('Coach records')
  +coaches.map(c=>`<div class="office-list-row"><div><b>${esc(recordCoachName(c.pid))}</b><div class="muted">${c.best?`Best season · S${c.best.season} at ${c.best.wins}–${c.best.losses} (${c.best.pf} pts)`:'Best season · —'}</div></div><strong>${c.streak} straight wins</strong></div>`).join('');
}
function intelTeamRecs(rows){
 const rec={};
 const credit=(name,w)=>{const k=String(name||'').toLowerCase();if(!k)return;if(!rec[k])rec[k]={w:0,l:0,t:0};rec[k][w]++};
 (rows||model.history||[]).forEach(g=>{
  if(!g||g.status!=='completed'||g.is_bye)return;
  const pf=Number(g.points_for),pa=Number(g.points_against);
  if(!Number.isFinite(pf)||!Number.isFinite(pa))return;
  if(pf>pa){credit(g.team_name,'w');credit(g.opponent_team,'l')}
  else if(pa>pf){credit(g.opponent_team,'w');credit(g.team_name,'l')}
  else{credit(g.team_name,'t');credit(g.opponent_team,'t')}
 });
 return rec;
}
function coachPower(personId,games,recs){
 const mine=games.filter(g=>g.person_id===personId);
 let w=0,l=0,movSum=0,movN=0,sosSum=0,sosN=0;
 mine.forEach(g=>{
  if(g.result==='W')w++;else if(g.result==='L')l++;
  const m=Number(g.points_for)-Number(g.points_against);
  if(Number.isFinite(m)){movSum+=m;movN++}
  const r=recs[String(g.opponent_team||'').toLowerCase()],gp=r?r.w+r.l+r.t:0;
  if(r&&gp>0){sosSum+=(r.w+r.t*0.5)/gp;sosN++}
 });
 const n=w+l,pct=n?w/n:0,mov=movN?movSum/movN:0,sos=sosN?sosSum/sosN:0.5;
 const movScore=(Math.max(-30,Math.min(30,mov))+30)/60;
 return {w,l,n,pct,mov,sos,score:100*(0.50*pct+0.30*movScore+0.20*sos)};
}
function coachLuck(personId,games){
 let pf=0,pa=0,w=0,l=0;
 games.filter(g=>g.person_id===personId).forEach(g=>{
  const a=Number(g.points_for),b=Number(g.points_against);
  if(!Number.isFinite(a)||!Number.isFinite(b))return;
  pf+=a;pa+=b;
  if(g.result==='W')w++;else if(g.result==='L')l++;
 });
 const n=w+l,e=2.37;
 let expP=0.5;
 if(pf>0||pa>0){const pfe=Math.pow(pf,e),pae=Math.pow(pa,e);expP=(pfe+pae)>0?pfe/(pfe+pae):0.5}
 const expW=expP*n;
 return {w,l,n,expW,expL:n-expW,luck:w-expW,pf,pa};
}
function seasonPowerRankings(){
 if(!season)return null;
 const all=recordBookGames().filter(g=>g.season_id===season.season_id);
 if(!all.length)return null;
 const rank=(gameSet,recs)=>[...new Set(gameSet.map(g=>g.person_id))].map(pid=>({pid,...coachPower(pid,gameSet,recs)})).sort((a,b)=>b.score-a.score);
 const seasonRows=(model.history||[]).filter(g=>g.season_id===season.season_id);
 const now=rank(all,intelTeamRecs(seasonRows));
 const maxWk=Math.max(...all.map(g=>Number(g.week_number)||0));
 const prevRank=new Map();
 if(all.some(g=>Number(g.week_number)<maxWk)){
  const prevGames=all.filter(g=>Number(g.week_number)<maxWk);
  rank(prevGames,intelTeamRecs(seasonRows.filter(g=>Number(g.week_number)<maxWk))).forEach((p,idx)=>prevRank.set(p.pid,idx+1));
 }
 return now.map((p,idx)=>({...p,rank:idx+1,move:prevRank.has(p.pid)?prevRank.get(p.pid)-(idx+1):null}));
}
function intelligencePage(){
 const games=recordBookGames();
 const head=title(dynasty.name,'League intelligence','Career power and luck from completed coach games.');
 if(!games.length)return head+empty('No completed coach games yet — intelligence opens with the first final.');
 const recs=intelTeamRecs();
 const spr=seasonPowerRankings();
 const teamOf=pid=>model.programs.find(p=>p.person_id===pid)?.team_name||games.find(g=>g.person_id===pid)?.team_name||'';
 const power=[...new Set(games.map(g=>g.person_id))].map(pid=>({pid,...coachPower(pid,games,recs)})).sort((a,b)=>b.score-a.score);
 const luck=[...new Set(games.map(g=>g.person_id))].map(pid=>({pid,...coachLuck(pid,games)})).sort((a,b)=>b.luck-a.luck);
 const f1=x=>(Math.round(x*10)/10).toFixed(1),pct=x=>Math.round(x*100)+'%',signed=x=>(x>0?'+':'')+f1(x);
 const trendChip=m=>m==null?'<span class="trend new">NEW</span>':m>0?`<span class="trend up">▲${m}</span>`:m<0?`<span class="trend down">▼${-m}</span>`:'<span class="trend flat">—</span>';
 const rankingsSection=spr?section('Power Rankings · Season '+season.season_number)+spr.map(p=>`<div class="office-list-row"><div><b>${p.rank}. ${esc(recordCoachName(p.pid))}</b><div class="muted">${esc(teamOf(p.pid))} · ${p.w}–${p.l} this season</div></div><span>${trendChip(p.move)} <strong>${f1(p.score)}</strong></span></div>`).join('')+'<p class="muted">Season power index with movement versus last week.</p>':'';
 return head+rankingsSection+section('Career power index')
  +power.map((p,i)=>`<div class="office-list-row"><div><b>${i+1}. ${esc(recordCoachName(p.pid))}</b><div class="muted">${esc(teamOf(p.pid))} · ${p.w}–${p.l} · ${pct(p.pct)} win rate · ${signed(p.mov)} avg margin · ${pct(p.sos)} schedule</div></div><strong>${f1(p.score)}</strong></div>`).join('')
  +'<p class="muted">Power = 50% win rate + 30% scoring margin (scaled at ±30) + 20% strength of schedule.</p>'
  +section('Luck index')
  +luck.map(p=>`<div class="office-list-row"><div><b>${esc(recordCoachName(p.pid))}</b><div class="muted">${esc(teamOf(p.pid))} · actual ${p.w}–${p.l} · expected ${f1(p.expW)}–${f1(p.expL)} · ${p.pf} scored, ${p.pa} allowed</div></div><strong>${signed(p.luck)} wins</strong></div>`).join('')
  +'<p class="muted">Luck = actual wins minus Pythagorean expected wins (exponent 2.37). Positive means the record is better than the points say; negative means the points deserved more.</p>';
}
function account(){return title('Your Foundry','Account & league')+`<p class="muted">${esc(session()?.user?.email||'Signed in')}</p>${row('Change league',dynasty?.name||'Choose a league',`onclick="go('leagues')"`)}${row('Change season',season?'Season '+season.season_number:'Choose a season',`onclick="go('seasons')"`)}${row('Refresh league data',updatedAt?'Last loaded '+updatedAt.toLocaleTimeString():'',`onclick="start()"`)}<div class="notice">Live data preview · Read-only</div><button class="secondary" onclick="logout()">Sign out</button>`}
function content(){switch(route){case'home':return home();case'scores':return scores();case'teams':return teams();case'team':return team();case'coach':return coach();case'standings':return standings();case'legacy':return legacy();case'game':return gamePage();case'rankings':return rankings();case'analysis':return analysis();case'records':return recordsPage();case'intelligence':return intelligencePage();case'career':return title(coachInfo().coach_name,'Career journey')+careerRows(model.stops.filter(s=>s.person_id===selectedCoach));case'rivalries':return rivalriesPage();case'trophies':return title(dynasty.name,'The trophy room')+`<label for="honorCoach">Collection</label><select id="honorCoach" onchange="trophyPerson=this.value||null;render()"><option value="">All coaches</option>${model.career.map(c=>`<option value="${uid(c.person_id)}" ${c.person_id===trophyPerson?'selected':''}>${esc(c.coach_name)}</option>`).join('')}</select>`+trophyGrid(honors(trophyPerson));case'stories':return title(dynasty.name,'The Saturday report',latestEdition()?'Published edition · Week '+latestEdition().week_number:'')+newsStories();case'article':{const s=storyItems()[selectedStory];return s?title('The Saturday report',s.headline)+`${storyBrand(s)}<p class="article-inline">${esc(s.fact||'')}</p><p class="article-inline">${esc(s.body||'')}</p>`+(s.game_id&&games().some(g=>g.id===s.game_id)?row('View game','Score and matchup details',`onclick="openGame('${uid(s.game_id)}')"`):''):empty('Choose a published story.')}case'account':return account();case'leagues':return title('Your memberships','Choose your league')+(model.dynasties.map(d=>row(d.name,d.active_season_number?'Season '+d.active_season_number:d.status,`onclick="loadDynasty('${uid(d.dynasty_id)}')"`)).join('')||empty('No league memberships are attached to this account. Join or create a league in the main app.'))+button('Account','account','secondary');case'seasonarchive':return seasonArchivePage();case'seasons':return title(dynasty?.name||'League','Season archive')+(model.seasons.map(s=>row('Season '+s.season_number,s.status,`onclick="loadSeason('${uid(s.season_id)}')"`)).join('')||empty('No seasons have been created.'));default:return home()}}
function seasonArchivePage(){
 const finals=games().filter(g=>g.final),honors=model.trophies.filter(t=>t.season_id===season.season_id||(!t.season_id&&num(t.season_number)===num(season.season_number)));
 return title(dynasty.name,'Season '+season.season_number+' archive',[season.year,season.status].filter(Boolean).join(' · '))+
 statline([[finals.length,'Completed games'],[model.programs.length,'Programs'],[honors.length,'Recorded honors']])+
 row('Scores & schedule','Browse every recorded week',`onclick="go('scores')"`)+
 row('Teams & coaches','The programs from this season',`onclick="go('teams')"`)+
 row('Conference standings','The recorded conference race',`onclick="go('standings')"`)+
 (honors.length?section('Season honors')+trophyGrid(honors):'');
}
function archiveBanner(){return browsingArchive()?`<div class="archive-banner" role="note" aria-label="Archive browsing"><div><strong>Season ${esc(season.season_number)} archive</strong><span>You’re browsing history. Home returns to the current season.</span></div><button class="secondary" onclick="go('home')">Return to current season</button></div>`:''}
function navSection(){return ['team','teams','coach','career','rivalries'].includes(route)?'teams':['standings','rankings','analysis'].includes(route)?'standings':['legacy','trophies','seasons','seasonarchive'].includes(route)?'legacy':['scores','game'].includes(route)?'scores':'home'}
function loginPage(){return `<div class="login-hero"><img src="${ASSET}experience/tunnel.webp" alt="Football stadium tunnel"><div>${title('Welcome to Saturday Foundry','Your next chapter.','The league. The rivalries. Your legacy.')}</div></div><div class="login-body">${title('Live preview','Welcome back','Sign in with your existing Saturday Foundry account.')}<form onsubmit="event.preventDefault();login(this)"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><p id="loginMessage" role="alert" class="error-message"></p><button class="primary" type="submit">Sign in</button></form><p class="sport-note">This preview reads your league data. Score entry and league changes remain in the main app.</p></div>`}
function render(){const signedIn=!!session()?.access_token,ready=signedIn&&!busy&&!loadError,hasSeason=!!season;let body;try{body=busy?`<div class="loading" role="status"><div class="spinner"></div>${title('Saturday Foundry','Loading your league…','Pulling the latest schedule, coaches and history.')}</div>`:loadError?title('Unable to load','Let’s try that again.',loadError)+`<button class="primary" onclick="start()">Retry</button>${signedIn?'<button class="secondary" onclick="logout()">Sign out</button>':''}`:!signedIn?loginPage():content()}catch(e){body=title('Preview error','This screen could not load.',e.message)+button('Home','home')}
 $('app').innerHTML=`<div class="mast"><span class="shield">SF</span><span class="word">SATURDAY FOUNDRY<small>${esc(signedIn&&dynasty?dynasty.name:'YOUR COACHING STORY')}</small></span><div class="mast-actions">${signedIn&&!busy?`<button class="avatar" onclick="go('account')" aria-label="Account and league menu">${fallbackArt('account-art','','account')}</button>`:''}</div></div><div class="viewport" id="screenViewport">${ready&&!['home','scores','teams','standings','legacy','leagues'].includes(route)?`<div class="crumb"><button onclick="back()">${ico('back')} Back</button><span>${esc(dynasty?.name||'Account')}</span></div>`:''}<div class="content ${!signedIn&&!busy?'auth-content':''}">${ready&&model.warnings.length?`<div class="notice" role="status">${esc(model.warnings.join(' '))} <button class="textlink" onclick="start()">Retry</button></div>`:''}${body}</div><div class="footer">Saturday Foundry · Preview 05 · Live data · Read-only</div></div>${ready&&hasSeason?`<nav class="bottomnav" aria-label="Main navigation">${[['Home','home'],['Scores','scores'],['Teams','teams'],['Standings','standings'],['Legacy','legacy']].map(([n,r])=>`<button class="${navSection()===r?'on':''}" ${navSection()===r?'aria-current="page"':''} onclick="go('${r}')">${ico(r)}<span>${n}</span></button>`).join('')}</nav>`:''}`;
 $('status').textContent=busy?'Connecting…':signedIn&&updatedAt&&!loadError?'LIVE DATA · READ-ONLY':'PREVIEW 05 · LIVE DATA';
 if(route==='scores')document.querySelector('.weekstrip .selected')?.scrollIntoView({block:'nearest',inline:'center'});
}
$('detailSheet').addEventListener('click',e=>{if(e.target===$('detailSheet'))closeSheet()});

$('detailSheet').addEventListener('cancel',e=>{if(mutationPending)e.preventDefault()});
