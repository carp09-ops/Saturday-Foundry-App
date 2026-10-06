/* Discovery and editorial share the app's existing routes and loaded league data. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),escape=value=>esc(value??'');
 const chapters=[
  {key:'conference',name:'The Race',feature:'Conference Race',icon:'conference',copy:'Follow the path to championship weekend.'},
  {key:'storylines',name:'The Stories',feature:'Coach Chronicles',icon:'coach',copy:'Careers unfold, one turning point at a time.'},
  {key:'rivalries',name:'The Rivalries',feature:'Rivalries',icon:'rivalries',copy:'Old scores. New stakes. Familiar opponents.'},
  {key:'hardware',name:'The Hardware',feature:'Trophy Case',icon:'trophy',copy:'Every piece of earned hardware, preserved.'},
  {key:'records',name:'The Records',feature:'Record Book',icon:'records',copy:'The performances that become the standard.'},
  {key:'vegas',name:'The Lines',feature:'Vegas',icon:'vegas',copy:'The numbers behind this week’s matchups.'},
  {key:'admin',name:'The League Office',feature:'Commissioner',icon:'settings',copy:'Manage the season and keep the league moving.'},
  {key:'recap',name:'The Seasons',feature:'Season Recap',icon:'recap',copy:'Revisit how each season came together.'}
 ];
 let model={chapters:[],profiles:[]},currentModel={chapters:[],profiles:[]},cache=new Map();
 function build(sn){
  if(!D||!S)return {chapters:[],profiles:[]};
  const input={dynasty:D.dynasty_id,edition:D.game_edition,season:Number(sn),games:storyAllGames(),stops:state.careerStops||[],moves:state.coachMoves||[],coaches:storyCoachPool(Number(sn))};
  const signature=JSON.stringify(input),key=String(sn);
  if(cache.get(key)?.signature===signature)return cache.get(key).model;
  const result=window.SFChronicleEngine.build(input);cache.set(key,{signature,model:result});if(cache.size>10)cache.delete(cache.keys().next().value);return result;
 }
 function readKey(){return `sf-chronicle-read-v1:${session()?.user?.id||'local'}:${D?.dynasty_id||''}:${D?.game_edition||''}`;}
 function readIds(){try{return new Set(JSON.parse(localStorage.getItem(readKey())||'[]'));}catch{return new Set();}}
 function markRead(id){const read=readIds();read.add(id);try{localStorage.setItem(readKey(),JSON.stringify([...read].slice(-250)));}catch{}renderDiscovery();}
 function news(){return currentModel.chapters.filter(x=>x.importance>=60).sort((a,b)=>b.week-a.week||b.importance-a.importance).slice(0,8);}
 function unread(){const read=readIds();return news().filter(x=>!read.has(x.id));}
 function permitted(chapter){const target=chapter.key==='hardware'?'legacy':chapter.key;return !!$(`${target}`)&&!document.querySelector(`#nav [data-view="${target}"]`)?.classList.contains('hidden');}
 function teaser(chapter){
  const completed=(state.games||[]).filter(g=>g.status==='completed'&&!g.is_bye);
  if(chapter.key==='storylines')return currentModel.chapters.find(x=>x.game||x.kind==='move')?.headline||chapter.copy;
  if(chapter.key==='conference'){const names=[...new Set((state.programs||[]).map(p=>p.conference).filter(Boolean))];return names.length?`${names.join(' · ')} · Week ${currentWeek()}`:chapter.copy;}
  if(chapter.key==='hardware'){const latest=sfVaultModel().entries[0];return latest?`${latest.coach_name} · ${latest.name}`:chapter.copy;}
  if(chapter.key==='records')return completed.length?`${completed.length} recorded results this season · explore the benchmarks`:chapter.copy;
  if(chapter.key==='rivalries'){const upcoming=(state.games||[]).find(g=>g.status==='scheduled'&&Number(g.week_number)===Number(currentWeek())&&g.opponent_person_id);return upcoming?`${upcoming.team_name} vs ${upcoming.opponent_team}`:chapter.copy;}
  if(chapter.key==='vegas')return `Week ${currentWeek()} · Explore this week’s lines`;
  return chapter.copy;
 }
 function chapterButton(c,i){return `<button type="button" class="sf-book-chapter" data-sf-chapter="${c.key}"><span class="sf-book-number">${String(i+1).padStart(2,'0')}</span><img src="assets/icons/${c.icon}.svg" alt=""><span class="sf-book-copy"><strong>${c.name}</strong><small>${c.feature}</small><em>${escape(teaser(c))}</em></span>${c.key==='storylines'&&unread().length?`<span class="sf-book-bookmark">${unread().length} unread</span>`:''}<span class="sf-book-arrow" aria-hidden="true">↗</span></button>`;}
 window.SFPopulateDynastyBook=function(){
  const grid=$('hqMobileMoreGrid');if(!grid)return;
  currentModel=build(S?.season_number);
  $('hqMoreTitle').textContent='Dynasty Book';
  const email=$('hqMobileMoreEmail');if(email)email.textContent=$('sessionEmail')?.textContent?.trim()||'Signed in';
  let intro=$('sfBookIntro');if(!intro){intro=document.createElement('div');intro.id='sfBookIntro';grid.before(intro);}
  intro.innerHTML=`<span>YOUR DYNASTY, CHAPTER BY CHAPTER</span><p>${escape(D?.short_name||D?.name||'Saturday Foundry')}${S?` · Season ${S.season_number} · Week ${currentWeek()}`:''}</p>`;
  grid.innerHTML=chapters.filter(permitted).map(chapterButton).join('');
  // Keep every existing non-core destination discoverable, even if new views are added later.
  const covered=new Set(['overview','schedule','analytics','legacy',...chapters.map(c=>c.key)]);
  for(const button of document.querySelectorAll('#nav [data-view]'))if(!covered.has(button.dataset.view)&&!button.classList.contains('hidden')){
   grid.insertAdjacentHTML('beforeend',`<button type="button" class="sf-book-extra" data-sf-chapter="${escape(button.dataset.view)}">${escape(button.querySelector('.hq-nav-label')?.textContent||button.textContent)} →</button>`);
  }
  if($('dynastyMenuBtn')&&!$('dynastyMenuBtn').classList.contains('hidden'))grid.insertAdjacentHTML('beforeend','<button type="button" class="sf-book-extra" data-mobile-more-action="dynasties">Choose your dynasty →</button>');
 };
 function navigate(key,context={}){
  window.CDHQCloseMobileMore?.();
  const view=key==='hardware'?'legacy':key;
  const nav=document.querySelector(`#nav [data-view="${view}"]`);if(nav)nav.click();else switchView(view);
  if(key==='hardware'){
   $('sfTrophyCaseTab')?.click();
   if(context.person){const select=$('sfVaultCoach');if(select&&[...select.options].some(o=>o.value===String(context.person))){select.value=String(context.person);select.dispatchEvent(new Event('change',{bubbles:true}));}}
   if(context.season){const select=$('sfVaultSeason');if(select&&[...select.options].some(o=>o.value===String(context.season))){select.value=String(context.season);select.dispatchEvent(new Event('change',{bubbles:true}));}}
  }else if(key==='legacy')$('sfDynastyLegacyTab')?.click();
  if(key==='storylines'){
   const select=$('storySeasonSelect');if(context.season&&select&&[...select.options].some(o=>o.value===String(context.season)))select.value=String(context.season);
   if(context.person)storyCoachFilter=String(context.person);
   renderStorylines();
   if(context.id){markRead(context.id);requestAnimationFrame(()=>document.querySelector(`[data-sf-episode-id="${CSS.escape(context.id)}"]`)?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));}
  }
 }
 window.SFOpenBookChapter=navigate;
 function episodeMarkup(x){
  return `<article class="sf-episode" data-sf-episode-id="${escape(x.id)}"><header><span>${escape(x.format)} · ${escape(x.label)}</span><small>${escape(x.coach.coach_name)} · ${escape(x.team)}</small></header><h3>${escape(x.headline)}</h3><p class="sf-episode-fact">${escape(x.fact)}</p><p class="sf-episode-fiction">${escape(x.scene)}</p><footer><span>FICTIONALIZED CHRONICLE</span><button type="button" data-sf-chapter="${x.link}" data-sf-person="${escape(x.coach.person_id)}" data-sf-season="${x.season}">${({hardware:'View earned hardware',rivalries:'Explore rivalry history',records:'Open Record Book',legacy:'Explore career history'})[x.link]} →</button></footer></article>`;
 }
 renderStorylines=function(){
  const select=$('storySeasonSelect'),old=select?.value;
  if(select){select.innerHTML=(seasons||[]).slice().sort((a,b)=>Number(b.season_number)-Number(a.season_number)).map(s=>`<option value="${s.season_number}">Season ${s.season_number}${s.year?` · ${escape(s.year)}`:''}${s.is_active?' · Active':''}</option>`).join('');select.value=old&&[...select.options].some(o=>o.value===old)?old:String(S?.season_number||seasons?.[0]?.season_number||'');}
  const people=storyCoachPool(storySeasonNumber());if(storyCoachFilter!=='all'&&!people.some(p=>String(p.person_id)===String(storyCoachFilter)))storyCoachFilter='all';
  $('storyCoachFilters').innerHTML='<button data-story-coach="all" class="'+(storyCoachFilter==='all'?'active':'')+'">All Coaches</button>'+people.map(p=>`<button data-story-coach="${escape(p.person_id)}" class="${String(p.person_id)===String(storyCoachFilter)?'active':''}">${escape(p.coach_name)}</button>`).join('');
  const sn=storySeasonNumber();model=build(sn);currentModel=build(S?.season_number);
  const active=model.chapters.filter(x=>storyCoachFilter==='all'||String(x.coach.person_id)===String(storyCoachFilter));
  const lead=[...active].sort((a,b)=>b.week-a.week||b.importance-a.importance)[0];
  $('storyLead').innerHTML=lead?`<article class="story-lead-main"><small>SEASON ${sn} · ${escape(lead.label)} · FICTIONAL EDITORIAL</small><h3>${escape(lead.headline)}</h3><p>${escape(lead.fact)}</p><button type="button" data-sf-episode="${escape(lead.id)}" data-sf-person="${escape(lead.coach.person_id)}" data-sf-season="${sn}">Read the episode →</button></article>`:'<div class="story-empty">Career chapters will appear as league history is recorded.</div>';
  $('storyChronicle').innerHTML=active.map(episodeMarkup).join('')||'<div class="story-empty">No chapters match this season and person.</div>';
  $('storyCoachGrid').innerHTML=model.profiles.filter(p=>storyCoachFilter==='all'||String(p.coach.person_id)===String(storyCoachFilter)).map(p=>`<article class="sf-season-chapter"><span>SEASON ${sn} · YEAR ${p.tenure} AT ${escape(p.team)}</span><h3>${escape(p.coach.coach_name)}</h3><strong>${escape(p.team)} · ${p.record.wins}-${p.record.losses}</strong><p>${p.previous?`Previously: ${escape(p.previous.team)} · ${p.previous.record.wins}-${p.previous.record.losses} in Season ${p.previous.season}.`:'The first recorded chapter in this league.'} ${p.games.length} completed games; ${model.chapters.filter(x=>String(x.coach.person_id)===String(p.coach.person_id)&&x.game).length} selected turning points.</p><button type="button" data-sf-chapter="legacy">Explore career history →</button></article>`).join('');
  $('storyLoreGrid').innerHTML=people.filter(p=>storyCoachFilter==='all'||String(p.person_id)===String(storyCoachFilter)).map(p=>{const lore=storyLore(p);return `<article class="sf-season-chapter"><span>FICTIONAL CHARACTER FILE</span><h3>${escape(p.coach_name)} · ${escape(lore.archetype)}</h3><p>${escape(lore.bio)}</p></article>`;}).join('');
  // Stable fictional personality stays available, but does not dominate each new edition.
  const lore=$('storyLoreGrid')?.closest('.story-lore-section');if(lore&&!lore.parentElement.matches('details')){const details=document.createElement('details');details.className='sf-personality-file';details.innerHTML='<summary>Behind the Headset · fictional character files</summary>';lore.before(details);details.append(lore);}
  renderDiscovery();
 };
 function renderDiscovery(){
  const host=$('sfDynastyDiscovery');if(!host)return;
  const featured=currentModel.chapters.find(x=>x.game||x.kind==='move');
  const read=readIds(),items=news();
  const preview=$('sfChroniclePreview');
  preview.innerHTML=featured?`<span class="sf-discovery-kicker">FROM THE CHRONICLES · ${escape(featured.label)}${read.has(featured.id)?'':' · UNREAD'}</span><h3>${escape(featured.headline)}</h3><p>${escape(featured.fact)}</p><button type="button" data-sf-episode="${escape(featured.id)}" data-sf-person="${escape(featured.coach.person_id)}" data-sf-season="${featured.season}">Read the chapter →</button><small>Fictional storytelling · verified league results</small>`:'<span class="sf-discovery-kicker">FROM THE CHRONICLES</span><h3>The next chapter starts here.</h3><p>Explore the people and seasons behind your dynasty.</p><button type="button" data-sf-chapter="storylines">Open Coach Chronicles →</button>';
  const grid=$('sfOverviewChapters');grid.innerHTML=chapters.slice(0,6).filter(permitted).map(c=>`<button type="button" data-sf-chapter="${c.key}"><img src="assets/icons/${c.icon}.svg" alt=""><span><strong>${c.feature}</strong><small>${escape(teaser(c))}</small></span><span aria-hidden="true">↗</span></button>`).join('');
  const notice=$('sfChronicleNotices');notice.querySelector('summary').innerHTML=`League news <span>${unread().length?`${unread().length} unread`:'All caught up'}</span>`;
  $('sfChronicleNoticeItems').innerHTML=items.map(x=>`<button type="button" data-sf-episode="${escape(x.id)}" data-sf-person="${escape(x.coach.person_id)}" data-sf-season="${x.season}"><span>${read.has(x.id)?'READ':'NEW'} · ${escape(x.label)}</span><strong>${escape(x.headline)}</strong><small>${escape(x.fact)}</small></button>`).join('')||'<p>No major developments yet. New milestones and program moves will appear here.</p>';
  syncBookState();
 }
 function syncBookState(){const active=document.querySelector('.view.active')?.id,overflow=!['overview','schedule','analytics','legacy'].includes(active);const button=document.querySelector('#hqMobileNav [data-mobile-more]');button?.classList.toggle('active',overflow);if(button){if(overflow)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');} $('sfDesktopMore')?.classList.toggle('active',overflow);}
 function boot(){
  const mobile=$('hqMobileNav');
  const analytics=mobile?.querySelector('[data-mobile-view="conference"],[data-mobile-view="storylines"]');if(analytics){analytics.dataset.mobileView='analytics';analytics.querySelector('span:last-child').textContent='Intelligence';analytics.querySelector('img').src='assets/icons-premium/analytics@1x.webp';}
  // Keep the approved primary order after older shell normalizers have finished.
  for(const view of ['overview','schedule','analytics','legacy']){const button=mobile?.querySelector(`[data-mobile-view="${view}"]`);if(button)mobile.append(button);}
  const book=mobile?.querySelector('[data-mobile-more]');if(book){mobile.append(book);book.querySelector('span:last-child').textContent='Book';book.setAttribute('aria-label','Open Dynasty Book');book.querySelector('img').src='assets/icons-premium/records@1x.webp';}
  if($('sfDesktopMore')){$('sfDesktopMore').setAttribute('aria-label','Open Dynasty Book');$('sfDesktopMore').querySelector('span:last-child').textContent='Book';}
  const host=document.createElement('section');host.id='sfDynastyDiscovery';host.setAttribute('aria-label','Explore your dynasty');host.innerHTML='<header class="sf-discovery-head"><div><span class="sf-discovery-kicker">OPEN A NEW CHAPTER</span><h2>Explore your dynasty</h2></div><button type="button" data-sf-open-book>Open the book ↗</button></header><div id="sfChroniclePreview" class="sf-chronicle-preview"></div><details id="sfChronicleNotices" class="sf-chronicle-notices"><summary>League news</summary><div id="sfChronicleNoticeItems"></div></details><div id="sfOverviewChapters" class="sf-overview-chapters"></div>';
  $('myWeekPanel')?.after(host);
  const legacyHead=$('legacyLinePanel')?.querySelector('.legacy-line-head');if(legacyHead){const link=document.createElement('button');link.type='button';link.dataset.sfChapter='storylines';link.className='sf-legacy-chronicle-link';link.textContent='Read the Chronicles →';legacyHead.append(link);}
  document.querySelector('#storylines .story-hero h2').textContent='A Career. A Continuing Story.';
  document.querySelector('#storylines .story-hero p').textContent='Real results anchor fictional scenes. Each season remembers what came before; each program move begins a new chapter.';
  document.querySelector('#storyChronicle').previousElementSibling.innerHTML='<div><span>THE TURNING POINTS</span><h3>The Chronicle</h3></div><em>Selected episodes · fictional scenes, factual records</em>';
  for(const c of chapters.filter(permitted)){const view=c.key==='hardware'?'legacy':c.key;if($(view)?.querySelector('.sf-chapter-return'))continue;const button=document.createElement('button');button.type='button';button.className='sf-chapter-return';button.dataset.sfOpenBook='';button.textContent=`Dynasty Book / ${c.name}`;$(view)?.prepend(button);}
  document.addEventListener('click',event=>{
   const book=event.target.closest('[data-sf-open-book]');if(book){event.preventDefault();window.CDHQOpenMobileMore?.(event);return;}
   const button=event.target.closest('[data-sf-chapter],[data-sf-episode]');if(!button)return;
   const fromNotice=!!button.closest('#sfChronicleNotices');
   event.preventDefault();navigate(button.dataset.sfEpisode?'storylines':button.dataset.sfChapter,{person:button.dataset.sfPerson,season:button.dataset.sfSeason,id:button.dataset.sfEpisode});
   if(fromNotice)$('sfChronicleNotices').open=false;
  });
  const observer=new MutationObserver(()=>requestAnimationFrame(syncBookState));document.querySelectorAll('.view').forEach(v=>observer.observe(v,{attributes:true,attributeFilter:['class']}));
  renderStorylines();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
