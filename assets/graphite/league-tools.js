(function(){
 const params=new URLSearchParams(location.search),id=params.get('dynasty'),sid=params.get('season'),view=params.get('view'),focus=params.get('focus');
 const embedded=params.get('embedded')==='1';
 if(embedded){document.documentElement.classList.add('sf-tools-embedded');document.body.insertAdjacentHTML('afterbegin','<div id="sfEmbeddedStatus" role="status">Loading league tools…</div>')}
 const known=new Set(['overview','schedule','conference','analytics','vegas','storylines','rivalries','records','recap','legacy','admin']);
 if(!embedded)document.body.insertAdjacentHTML('afterbegin','<div id="sfNewSiteReturn"><a href="index.html">← Saturday Foundry</a><span>League tools <small>'+String(document.querySelector('meta[name="sf-version"]')?.content||'').replace(/[^a-zA-Z0-9.\-]/g,'')+'</small></span></div>');
 let applied=false,pending=false,timer;
 async function align(){
  if(applied||pending||!id||!window.CDHQ_RUNTIME?.session()?.access_token||typeof dynasties==='undefined'||!dynasties.some(d=>d.dynasty_id===id))return;
  pending=true;try{
   if(typeof D==='undefined'||D?.dynasty_id!==id)await loadDynastyById(id);
   if(sid&&(typeof seasons==='undefined'||!seasons.some(s=>s.season_id===sid)))return;
   if(document.querySelector('[data-sf-loading-generation]'))return;
   if(sid&&S?.season_id!==sid)await window.CDHQ_RUNTIME.loadSeason(sid);
   if(D?.dynasty_id===id&&(!sid||S?.season_id===sid)){applied=true;document.documentElement.classList.add('sf-tools-ready');document.getElementById('sfEmbeddedStatus')?.remove();if(known.has(view)&&(view!=='admin'||['commissioner','co_commissioner'].includes(D?.role)))window.switchView(view);if(view==='admin'&&['commissioner','co_commissioner'].includes(D?.role)){const control=document.getElementById(focus==='season'?'newSeasonBtn':focus==='program'?'careerMoveCoach':'');control?.closest('.admin-card')?.scrollIntoView({block:'start'});if(focus==='program')control?.focus({preventScroll:true})}}
  }catch(error){console.warn('League context could not be selected automatically.');const status=document.getElementById('sfEmbeddedStatus');if(status)status.textContent='The league tools could not load. Return to Home and refresh your league to try again.';}finally{pending=false}
 }
 const observer=new MutationObserver(()=>{if(applied)return observer.disconnect();if(!timer)timer=setTimeout(()=>{timer=null;align()},120)});observer.observe(document.body,{childList:true,subtree:true});align();
 if(embedded)setTimeout(()=>{const status=document.getElementById('sfEmbeddedStatus');if(!applied&&status)status.textContent='Still waiting for your league. Return to Home and refresh if this does not finish.'},25000);
})();

// Replace only explicit image-fallback slots, never team names or school wordmarks.
(function(){
 const src='assets/graphite/football-fallback.webp';
 const selector='.team-fallback,.v25-choice-logo-fallback,.legacy-team-logo-fb,.sf-match-logo-fallback,.wire-team-logo-fallback,.gotw2-fallback,.gd-logo-fb,.sf-archive-team-fallback,.story-coach-logo > span,#teamDockLogo > span';
 function repair(){if(!document?.body)return;
 document.querySelectorAll('img[src*="saturday-foundry-lockup"],img[src*="saturday-foundry-shield"],link[rel~="icon"][href*="saturday-foundry"]').forEach(el=>{const attr=el.tagName==='LINK'?'href':'src',old=el.getAttribute(attr)||'';el.setAttribute(attr,'assets/graphite/brand/'+(old.includes('lockup')?'foundry-lockup.webp':'foundry-shield.webp'))});
 document.querySelectorAll(selector).forEach(el=>{if(el.querySelector('img'))return;const img=document.createElement('img');img.src=src;img.alt='';img.className='sf-football-fallback';el.replaceChildren(img)})}
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;repair()})}).observe(document.body,{childList:true,subtree:true});repair();
})();


/* Program-confirmed rollover. Capture before legacy click handler to prevent unsafe carry-forward. */
(function(){
 let busy=false;
 document.addEventListener('click',async event=>{
  const button=event.target.closest?.('#newSeasonBtn');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(busy||typeof D==='undefined'||typeof S==='undefined'||!D?.dynasty_id||!S?.season_id)return;
  const message=document.getElementById('seasonAdminMessage');
  const note=(value)=>{if(message){message.textContent=value;message.classList.remove('hidden')}};
  const yearRaw=document.getElementById('nextSeasonYear')?.value.trim()||'';
  const year=yearRaw?Number(yearRaw):null;
  if(year!==null&&(!Number.isInteger(year)||year<2020||year>2100))return note('Enter a valid season year.');
  let panel=document.getElementById('sfProgramRollover');
  if(panel){panel.remove();return}
  busy=true;button.disabled=true;
  try{
   const coaches=(await Data.dynastyCoaches(D.dynasty_id)).filter(c=>c.person_id&&c.current_team_name);
   const teams=await Data.teamSelection(S.season_id);
   if(!coaches.length)throw Error('No active coach assignments found.');
   panel=document.createElement('div');panel.id='sfProgramRollover';
   panel.style.cssText='padding:14px;margin:12px 0;border:1px solid #b8b8b8;border-radius:10px';
   const heading=document.createElement('h4');heading.textContent='Confirm every coach’s next-season team';panel.append(heading);
   const selectors=[];
   for(const coach of coaches){
    const wrapper=document.createElement('label');wrapper.style.cssText='display:block;margin:12px 0';
    const title=document.createElement('strong');title.textContent=(coach.coach_name||coach.display_name||'Coach')+' · '+coach.current_team_name;wrapper.append(title);
    const select=document.createElement('select');select.required=true;select.style.cssText='display:block;width:100%;max-width:100%;margin-top:6px';
    select.add(new Option('Choose stay or a new team',''));
    const current=teams.find(t=>t.team_name===coach.current_team_name);
    if(current)select.add(new Option('Stay · '+current.team_name,current.team_id));
    for(const team of teams)if(!current||team.team_id!==current.team_id)select.add(new Option(team.team_name,team.team_id));
    wrapper.append(select);panel.append(wrapper);selectors.push({coach,select});
   }
   const submit=document.createElement('button');submit.type='button';submit.className='btn primary';submit.textContent='Review and create next season';panel.append(submit);
   button.closest('.admin-card').append(panel);
   document.getElementById('carryPrograms')?.closest('label')?.classList.add('hidden');
   submit.onclick=async()=>{
    const assignments=selectors.map(({coach,select})=>({person_id:coach.person_id,team_id:select.value}));
    if(assignments.some(a=>!a.team_id)||new Set(assignments.map(a=>a.team_id)).size!==assignments.length)return note('Confirm a unique program for every coach.');
    const review=selectors.map(({coach,select})=>(coach.coach_name||coach.display_name)+' → '+select.selectedOptions[0].text).join('\n');
    if(!confirm('Start Season '+(Number(S.season_number)+1)+' with these programs?\n\n'+review))return;
    busy=true;submit.disabled=true;button.disabled=true;
    try{
     note('Creating season and program assignments together…');
     const auth=session();
     await req('/rest/v1/rpc/create_next_season_with_assignments',{method:'POST',token:auth.access_token,body:{p_dynasty_id:D.dynasty_id,p_year:year,p_assignments:assignments}});
     note('Season and assignments saved.');
     dynasties=await Data.dynasties();
     await loadDynasty(Math.max(0,dynasties.findIndex(x=>x.dynasty_id===D.dynasty_id)));
    }catch(error){note(error.message||String(error));submit.disabled=false}
    finally{busy=false;button.disabled=false}
   };
  }catch(error){note(error.message||String(error))}
  finally{busy=false;button.disabled=false}
 },true);
})();
