/* Preview experience: presentation and navigation over the existing app/data contract. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const primary=[['overview','Home','home'],['schedule','Games','schedule'],['conference','League','conferences'],['coachhub','Coaches','coach-chronicles'],['legacy','Legacy','trophy-room']];
 const parents={analytics:'conference',vegas:'schedule',storylines:'coachhub',rivalries:'coachhub',records:'legacy',recap:'legacy',admin:'overview'};
 const labels={...Object.fromEntries(primary.map(x=>[x[0],x[1]])),analytics:'League analysis',vegas:'Lines & predictions',storylines:'Coach Chronicles',rivalries:'Rivalries',records:'Coaching records',recap:'Season recap',admin:'League office'};
 let queued=false,historyPaused=false,lastContext='',lastScope='',lastRender='',booted=false;
 const visible=id=>$(id)&&!$(id).classList.contains('hidden');
 const routeButton=(id,label,cls='sf-x-link')=>`<button type="button" class="${cls}" data-sf-route="${id}">${label}<span aria-hidden="true">↗</span></button>`;
 const heading=(eyebrow,title,copy)=>`<header class="sf-x-heading"><span class="sf-x-eyebrow">${eyebrow}</span><h2 tabindex="-1">${title}</h2><p>${copy}</p></header>`;
 function navMarkup(mobile=false){return primary.map(([id,label,icon])=>`<button type="button" ${mobile?'data-mobile-view':'data-sf-route'}="${id}"><img src="assets/icons-premium/${icon}@1x.webp" alt="" width="26" height="26"><span>${label}</span></button>`).join('');}
 function navigate(id,{pane,anchor,focus=true}={}){
  if(!visible('app')||!$(id)?.classList.contains('view'))return;
  if(id==='admin'&&$('adminNav')?.classList.contains('hidden'))return;
  $('sfAccountMenu').open=false;
  const button=document.querySelector(`#nav [data-view="${id}"]`);
  if(button)button.click();else window.switchView(id);
  if(pane)document.querySelector(`[data-pane="${pane}"],[data-legacy-pane="${pane}"]`)?.click();
  requestAnimationFrame(()=>{
   const target=anchor?$(anchor):$(id).querySelector('.sf-x-heading h2,.sf-x-home-hero h2,h2');
   if(anchor)target?.scrollIntoView({block:'start',behavior:'auto'});
   if(target&&focus){if(!target.hasAttribute('tabindex'))target.tabIndex=-1;target.focus({preventScroll:true});}
   sync();
  });
 }
 function sync(){
  const inApp=visible('app'),id=document.querySelector('.view.active')?.id||'overview',group=parents[id]||id;
  document.body.classList.toggle('sf-x-in-app',!!inApp);
  const screen=visible('authScreen')?'account':visible('dynastyChooserScreen')?'dynasty':visible('teamScreen')?'program':visible('claimScreen')?'invite':'app';
  document.body.dataset.sfScreen=screen;
  for(const button of document.querySelectorAll('#sfPrimaryNav [data-sf-route],#hqMobileNav [data-mobile-view]')){
   const active=(button.dataset.sfRoute||button.dataset.mobileView)===group;
   button.classList.toggle('active',active);
   if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
  const office=$('sfOfficeAction');if(office)office.hidden=!inApp||$('adminNav')?.classList.contains('hidden');
  const context=typeof D!=='undefined'&&D?`${D.dynasty_id}:${S?.season_id||''}`:'';
  if(inApp&&context!==lastContext){lastContext=context;history.replaceState({...history.state,sfRoute:id,sfContext:context},'');}
  if(inApp&&typeof D!=='undefined'){
   $('sfContextLeague').textContent=D?.name||'Saturday Foundry';
   $('sfContextWeek').textContent=`Week ${typeof currentWeek==='function'?currentWeek():'—'}`;
   $('sfContextPage').textContent=labels[id]||'Saturday Foundry';
  }
  // Authorize from the existing commissioner control, never from visual state alone.
  for(const el of document.querySelectorAll('[data-sf-requires-app]'))el.hidden=!inApp;
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();paint();});}
 function labelInput(id,label){const input=$(id);if(!input)return;const l=document.createElement('label');l.className='sf-x-field-label';l.htmlFor=id;l.textContent=label;input.before(l);}
 function entryScreens(){
  const hero=document.querySelector('#authScreen .hq-auth-hero');
  hero.querySelector('h1').innerHTML='Every Saturday.<br><em>A new chapter.</em>';
  hero.querySelector('p').textContent='Build a program. Chase the hardware. Write a coaching career worth remembering.';
  hero.insertAdjacentHTML('beforeend','<div class="sf-x-auth-foot"><span>THE COLLEGE FOOTBALL DYNASTY COMPANION</span><b>Built for the long game.</b></div>');
  document.querySelector('#authScreen .hq-auth-live').textContent='One account. Every dynasty. Your entire career.';
  const stages=(n)=>`<ol class="sf-x-steps" aria-label="Getting started">${['Account','Dynasty','Program'].map((s,i)=>`<li ${i===n?'aria-current="step"':''}><span>${i<n?'✓':String(i+1).padStart(2,'0')}</span>${s}</li>`).join('')}</ol>`;
  document.querySelector('#authScreen .hq-auth-shell').insertAdjacentHTML('afterbegin',stages(0));
  document.querySelector('#dynastyChooserScreen .dynasty-chooser-shell').insertAdjacentHTML('afterbegin',stages(1));
  $('teamScreen').insertAdjacentHTML('afterbegin',`<div class="sf-x-entry-top"><button type="button" class="sf-x-back" data-sf-action="dynasties">← Your dynasties</button>${stages(2)}</div>`);
  $('dynastyChooserTitle').textContent='Your next chapter starts here.';
  document.querySelector('#teamScreen .v25-team-hero h1').textContent='Choose your program.';
  document.querySelector('#teamScreen .v25-team-hero .kicker').textContent='THE NEXT CHAPTER';
  document.querySelector('#teamScreen .v25-team-hero p').textContent='Find your school, select a program, and make it yours. Claimed programs stay with their coaches.';
  const actions=document.querySelector('.dynasty-chooser-actions');$('dynastyChooserGrid').after(actions);
  labelInput('loginEmail','Email address');labelInput('loginPassword','Password');
  labelInput('signupName','Coach display name');labelInput('signupEmail','Email address');labelInput('signupPassword','Password · at least 6 characters');
  $('teamSearch').setAttribute('aria-label','Search programs by school or conference');
  $('teamGrid').setAttribute('aria-label','Available programs');
  $('teamSelectMeta').setAttribute('role','status');$('teamSelectionDock').setAttribute('aria-live','polite');
  $('claimScreen').querySelector('.card').insertAdjacentHTML('afterbegin','<button type="button" class="sf-x-back" data-sf-action="dynasties">← Your dynasties</button>');
  $('inviteCode').setAttribute('aria-label','Dynasty invite code');$('claimBtn').textContent='Join dynasty';
  for(const id of ['authMessage','claimMessage']){$(id).setAttribute('role','status');$(id).setAttribute('aria-live','polite');}
  for(const [id,submit] of [['loginEmail','signInBtn'],['loginPassword','signInBtn'],['signupName','signUpBtn'],['signupEmail','signUpBtn'],['signupPassword','signUpBtn'],['inviteCode','claimBtn']]){
   $(id).addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$(submit).click();}});
  }
  document.querySelector('.hq-auth-tabs').addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
   const buttons=[...document.querySelectorAll('.hq-auth-tab')],active=buttons.indexOf(document.activeElement);
   const next=event.key==='Home'?0:event.key==='End'?1:1-Math.max(0,active);buttons[next].click();buttons[next].focus();
  });
  const a11yTeam=()=>document.querySelectorAll('#teamGrid .team-choice').forEach(card=>{
   const disabled=card.classList.contains('claimed')||card.classList.contains('mine');
   card.setAttribute('role','button');card.tabIndex=disabled?-1:0;
   card.setAttribute('aria-disabled',String(disabled));card.setAttribute('aria-pressed',String(card.classList.contains('selected')));
   card.setAttribute('aria-label',`${card.querySelector('.v25-choice-name')?.textContent}, ${card.querySelector('.v25-choice-conf')?.textContent}, ${card.querySelector('.v25-choice-status')?.textContent}`);
  });
  new MutationObserver(a11yTeam).observe($('teamGrid'),{childList:true});
  $('teamGrid').addEventListener('keydown',e=>{const card=e.target.closest('.team-choice');if(card&&['Enter',' '].includes(e.key)){e.preventDefault();if(card.getAttribute('aria-disabled')!=='true')card.click();}});
  $('teamGrid').addEventListener('click',()=>requestAnimationFrame(a11yTeam));
 }
 function shell(){
  document.body.classList.add('sf-experience');
  document.body.insertAdjacentHTML('afterbegin','<a class="sf-x-skip" href="#app">Skip to dynasty content</a>');
  $('app').tabIndex=-1;
  $('siteBrandLogo').src='assets/saturday-foundry-lockup.webp';
  const header=$('siteHeader');
  header.insertAdjacentHTML('beforeend','<nav id="sfPrimaryNav" aria-label="Primary navigation">'+navMarkup()+'</nav>');
  document.querySelector('.canonical-controls').insertAdjacentHTML('beforeend',`<details id="sfAccountMenu"><summary aria-label="Account and dynasty tools"><span class="sf-x-account-glyph" aria-hidden="true">⚙</span><span>Account & tools</span></summary><div class="sf-x-account-panel"><span class="sf-x-eyebrow">YOUR FOUNDRY</span><button type="button" data-sf-action="dynasties">Switch dynasty <span>↗</span></button><button type="button" data-sf-action="manage">Create or join a dynasty <span>↗</span></button><button type="button" data-sf-action="refresh">Refresh league data <span>↻</span></button><button type="button" id="sfOfficeAction" data-sf-route="admin">Commissioner office <span>↗</span></button><button type="button" data-sf-action="directory" data-sf-requires-app>All features <span>↗</span></button><button type="button" data-sf-action="logout">Sign out <span>↗</span></button><small>PREVIEW 9.11.0 · Your league data is live</small></div></details>`);
  header.insertAdjacentHTML('afterend','<div id="sfContextBar"><div><span id="sfContextLeague">Saturday Foundry</span><span class="sf-x-separator">/</span><span id="sfContextPage">Home</span></div><div id="sfContextSeason"><label for="seasonSelect" class="sf-x-sr">Season</label><span id="sfContextWeek">Week —</span></div></div>');
  $('sfContextSeason').prepend($('seasonSelect'));
  if($('sfBuildMarker'))document.querySelector('.canonical-controls').prepend($('sfBuildMarker'));
  $('hqMobileNav').innerHTML=navMarkup(true);
  const bridge=document.createElement('button');bridge.type='button';bridge.dataset.view='coachhub';bridge.textContent='Coaches';$('nav').append(bridge);
  const oldSwitch=window.switchView;
  window.switchView=function(id){
   if(!$(id)?.classList.contains('view'))return;
   const before=document.querySelector('.view.active')?.id;
   oldSwitch(id);
   if(booted&&visible('app')&&!historyPaused&&before!==id)history.pushState({...history.state,sfRoute:id,sfContext:lastContext},'');
   sync();paint();
  };
  window.addEventListener('popstate',e=>{
   if(!visible('app')||e.state?.sfContext!==lastContext||!e.state?.sfRoute)return;
   historyPaused=true;try{navigate(e.state.sfRoute);}finally{historyPaused=false;}
  });
  document.addEventListener('click',e=>{
   const b=e.target.closest('[data-sf-route],[data-sf-action],[data-sf-anchor]');if(!b)return;
   if(b.dataset.sfRoute){e.preventDefault();navigate(b.dataset.sfRoute,{pane:b.dataset.sfPane,anchor:b.dataset.sfAnchor});}
   else if(b.dataset.sfAnchor){$(b.dataset.sfAnchor)?.scrollIntoView({block:'start',behavior:'auto'});}
   else{
    const action=b.dataset.sfAction;$('sfAccountMenu').open=false;
    if(action==='dynasties'){window.CDHQCloseMobileMore?.();renderDynastyChooser().then(()=>{$('dynastyChooserTitle').tabIndex=-1;$('dynastyChooserTitle').focus({preventScroll:true});window.scrollTo(0,0);});}
    if(action==='manage')$('chooserCreateDynastyBtn').click();
    if(action==='refresh')window.CDHQRefresh?.();
    if(action==='logout')$('signOutBtn').click();
    if(action==='directory')window.CDHQOpenMobileMore?.();
   }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('sfAccountMenu').open){$('sfAccountMenu').open=false;$('sfAccountMenu').querySelector('summary').focus();}});
  document.addEventListener('click',e=>{if(!e.target.closest('#sfAccountMenu'))$('sfAccountMenu').open=false;});
 }
 function hubs(){
  const home=document.querySelector('#overview .v13-overview');
  home.insertAdjacentHTML('afterbegin',`<section class="sf-x-home-hero"><div class="sf-x-home-copy"><span class="sf-x-eyebrow" id="sfHomeEdition">THE SATURDAY EDITION</span><h2 tabindex="-1">This is your<br><em>Saturday.</em></h2><p id="sfHomeWelcome">Your programs. Your people. Your next chapter.</p><div class="sf-x-hero-actions">${routeButton('schedule','Open your week','sf-x-primary')}${routeButton('conference','Follow the race','sf-x-secondary')}</div></div><div class="sf-x-hero-stamp"><span>EST. ON SATURDAYS</span><b>BUILT FOR<br>THE LONG GAME.</b></div></section><section id="sfHomeScoreboard" class="sf-x-scoreboard" aria-label="This week in your dynasty"></section><div class="sf-x-section-title"><div><span class="sf-x-eyebrow">MAKE YOUR NEXT MOVE</span><h2>Your week, at a glance.</h2></div>${routeButton('schedule','All games')}</div>`);
  const grid=document.createElement('div');grid.id='sfHomeGrid';grid.className='sf-x-home-grid';home.append(grid);
  const week=$('myWeekPanel');home.querySelector('.sf-x-section-title').after(week);
  grid.innerHTML='<div id="sfHomeEditorial" class="sf-x-editorial"></div><aside id="sfHomeRail" class="sf-x-home-rail"></aside>';
  $('sfHomeRail').append(document.querySelector('.sf-gotw-standalone-shell'));
  $('sfHomeRail').append($('viewCfpBracketBtn'));
  $('sfHomeRail').insertAdjacentHTML('beforeend',`<div class="sf-x-rail-note"><span class="sf-x-eyebrow">THE BIGGER PICTURE</span><h3>Every season leaves a mark.</h3><p>Coaching careers, earned hardware, and the games that stay with you.</p>${routeButton('legacy','Explore Legacy')}</div>`);
  const coach=document.createElement('section');coach.id='coachhub';coach.className='view';coach.setAttribute('aria-label','Coaches');
  coach.innerHTML=heading('THE PEOPLE BEHIND THE PROGRAMS','Programs change. Coaches endure.','Your dynasty is more than a standings table. Follow the people writing its history.')+`<div class="sf-x-destination-grid">${routeButton('storylines','<b>Coach Chronicles</b><small>Weekly editions and career stories</small>','sf-x-destination')}${routeButton('rivalries','<b>Rivalries</b><small>Head-to-head history and next meetings</small>','sf-x-destination')}${routeButton('analytics','<b>Coach comparison</b><small>Put two careers side by side</small>','sf-x-destination').replace('data-sf-route="analytics"','data-sf-route="analytics" data-sf-pane="paneCompare"')}</div><div class="sf-x-section-title"><div><span class="sf-x-eyebrow">THE COACHING ROOM</span><h2>Meet your dynasty.</h2></div><span id="sfCoachCount"></span></div>`;
  $('app').append(coach);coach.append($('coaches'));coach.append($('legacyLinePanel'));
  $('conference').insertAdjacentHTML('afterbegin',heading('THE LEAGUE DESK','The race is right here.','Conference standings, the national poll, and the numbers behind the season.')+`<div class="sf-x-section-links"><button type="button" data-sf-anchor="confRaceBoards">Conference standings ↓</button><button type="button" data-sf-anchor="top25Panel">Top 25 ↓</button>${routeButton('analytics','League analysis')}</div>`);
  $('conference').append($('top25Panel'));$('conference').append($('seasonPulsePanel'));
  $('schedule').insertAdjacentHTML('afterbegin',heading('THE WEEK AHEAD','Game day starts here.','Find your matchup, preview the lines, and record the result when the clock hits zero.')+`<div class="sf-x-section-links">${routeButton('vegas','Lines & predictions')}${routeButton('rivalries','Head-to-head matchups')}</div>`);
  $('legacy').insertAdjacentHTML('afterbegin',`<div class="sf-x-legacy-hero">${heading('THE LEGACY COLLECTION','Some Saturdays last forever.','The hardware, the records, and the seasons that made your dynasty.')}<div class="sf-x-section-links">${routeButton('records','Coaching records')}${routeButton('recap','Season recaps')}</div></div>`);
  for(const [id,parent] of Object.entries(parents))if($(id))$(id).insertAdjacentHTML('afterbegin',`<nav class="sf-x-breadcrumb" aria-label="Breadcrumb">${routeButton(parent,'← '+labels[parent])}<span>/</span><span>${labels[id]}</span></nav>`);
 }
 function gamesModel(){
  const rows=typeof state==='undefined'?[]:state.games||[],seen=new Set();
  return rows.filter(g=>{
   if(g.is_bye)return false;
   const teams=[g.team_id||g.team_name,g.opponent_team_id||g.opponent_team].map(String).sort().join('|');
   const key=`${g.season_id}:${g.week_number}:${teams}`;if(seen.has(key))return false;seen.add(key);return true;
  });
 }
 function paint(){
  if(!booted||typeof state==='undefined'||typeof S==='undefined'||!S||!D)return;
  const scope=`${D.dynasty_id}:${S.season_id}`;
  if(scope!==lastScope){lastScope=scope;lastRender='';}
  const games=gamesModel(),week=Number(currentWeek()),current=games.filter(g=>Number(g.week_number)===week),programs=(state.programs||[]).filter(p=>p.person_id),stories=window.SFWeeklyStories?.rows(S.season_number)||[];
  const signature=JSON.stringify([scope,week,games,programs,stories]);if(signature===lastRender)return;lastRender=signature;
  const my=typeof myProgramForSeason==='function'?myProgramForSeason():null;
  $('sfHomeEdition').textContent=`${D.short_name||D.name||'YOUR DYNASTY'} / SEASON ${S.season_number} / WEEK ${week}`;
  $('sfHomeWelcome').textContent=my?.team_name?`${my.team_name}. Your program. Your next chapter.`:'Your programs. Your people. Your next chapter.';
  $('sfCoachCount').textContent=`${new Set(programs.map(p=>p.person_id)).size} coaches this season`;
  const completed=g=>g.status==='completed'&&g.points_for!=null&&g.points_against!=null;
  $('sfHomeScoreboard').innerHTML=`<div class="sf-x-score-label"><span>THE COACHES’ SLATE</span><b>WEEK ${week}</b></div>`+(current.length?current.slice(0,6).map(g=>`<button type="button" class="sf-x-score" data-sf-route="schedule"><span>${completed(g)?'FINAL':E(String(g.status||'scheduled').toUpperCase())}</span><div><b>${E(g.team_abbreviation||g.team_name)}</b><strong>${completed(g)?E(g.points_for):'—'}</strong></div><div><b>${E(g.opponent_team)}</b><strong>${completed(g)?E(g.points_against):'—'}</strong></div></button>`).join(''):'<div class="sf-x-score-empty">No coach matchups recorded for this week. Open Games to explore the schedule.</div>');
  const edition=stories.find(x=>Number(x.week_number)===week)||stories[0],lead=edition?.payload?.lead||edition?.payload?.recaps?.find(x=>x.game_id);
  const conferences=[...new Set(programs.map(p=>p.conference).filter(Boolean))];
  $('sfHomeEditorial').innerHTML=`<article class="sf-x-story"><span class="sf-x-eyebrow">${lead?`THE WEEKLY EDITION / WEEK ${E(edition.week_number)}`:'FROM THE COACHES’ ROOM'}</span><h2>${lead?E(lead.headline):'Every result has a story.'}</h2><p>${lead?E(lead.fact||''): 'Follow weekly coverage, rivalries, and turning points across your dynasty’s coaching careers.'}</p>${routeButton('storylines','Read Coach Chronicles')}</article><div class="sf-x-feature-pair"><article class="sf-x-feature sf-x-feature-race"><span class="sf-x-eyebrow">THE LEAGUE PICTURE</span><h3>One week closer.</h3><p>${conferences.length?`${E(conferences.slice(0,3).join(' · '))}${conferences.length>3?' + more':''}`:'Conference races and national rankings.'}</p>${routeButton('conference','See the standings')}</article><article class="sf-x-feature sf-x-feature-legacy"><span class="sf-x-eyebrow">THE TROPHY ROOM</span><h3>Built to be remembered.</h3><p>Every earned honor. Every coaching chapter.</p>${routeButton('legacy','Open Legacy')}</article></div><div class="sf-x-coach-digest"><div><span class="sf-x-eyebrow">AROUND YOUR DYNASTY</span><h3>The coaching room</h3></div>${programs.slice(0,4).map(p=>`<button type="button" data-sf-route="coachhub"><strong>${E(p.coach_name||'Coach')}</strong><span>${E(p.team_name||'Program')}</span><b>${p.wins!=null&&p.losses!=null?`${E(p.wins)}–${E(p.losses)}`:'→'}</b></button>`).join('')||'<p>Coaches appear here when programs are assigned.</p>'}${routeButton('coachhub','Meet the coaches')}</div>`;
 }
 function boot(){
  shell();entryScreens();hubs();booted=true;
  const original=renderAll;renderAll=function(...args){const out=original.apply(this,args);schedule();return out;};
  const observer=new MutationObserver(schedule);
  ['app','authScreen','dynastyChooserScreen','teamScreen','claimScreen','adminNav','sessionBar'].forEach(id=>observer.observe($(id),{attributes:true,attributeFilter:['class']}));
  document.querySelectorAll('.view').forEach(el=>observer.observe(el,{attributes:true,attributeFilter:['class']}));
  new MutationObserver(schedule).observe($('coaches'),{childList:true});
  window.SFExperience={navigate,refresh:schedule,primary:primary.map(x=>({id:x[0],label:x[1]}))};
  sync();paint();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
