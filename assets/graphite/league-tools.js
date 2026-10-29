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


/* Confirmed program assignments: intercept legacy rollover before its onclick fires. */
(function(){
 let busy=false;
 const byId=id=>document.getElementById(id);
 const announce=message=>{
   const node=byId('seasonAdminMessage');
   if(node){node.textContent=message;node.classList.remove('hidden');node.setAttribute('role','status')}
 };
 function prepare(){
   const button=byId('newSeasonBtn');
   if(!button||button.dataset.sfRolloverReady)return;
   button.dataset.sfRolloverReady='true';
   button.textContent='Choose next-season teams';
   const checkbox=byId('carryPrograms');
   if(checkbox){checkbox.checked=false;checkbox.closest('label')?.classList.add('hidden')}
   const description=button.closest('.admin-card')?.querySelector('h3 + p');
   if(description)description.textContent='Select Stay or Change for every active coach before creating the next season. No team is carried forward without confirmation.';
 }
 const observer=new MutationObserver(prepare);
 observer.observe(document.body,{childList:true,subtree:true});
 prepare();

 document.addEventListener('click',async event=>{
  const trigger=event.target.closest?.('#newSeasonBtn');
  if(!trigger)return;
  // Capture phase is essential: the preserved runtime registers an unsafe onclick.
  event.preventDefault();event.stopImmediatePropagation();
  if(busy||!D?.dynasty_id||!S?.season_id)return;
  const yearRaw=byId('nextSeasonYear')?.value?.trim()||'';
  const year=yearRaw?Number(yearRaw):null;
  if(year!==null&&(!Number.isInteger(year)||year<2020||year>2100))return announce('Enter a valid four-digit season year.');
  const existing=byId('sfProgramRollover');
  if(existing){existing.remove();trigger.textContent='Choose next-season teams';return}
  busy=true;trigger.disabled=true;
  try{
   const [coachesRaw,teamRows]=await Promise.all([Data.dynastyCoaches(D.dynasty_id),Data.teamSelection(S.season_id)]);
   // This endpoint also returns retired/historical coaches; NEVER include those.
   const coaches=(coachesRaw||[]).filter(c=>c.person_id&&String(c.current_season_id)===String(S.season_id)&&c.current_team_id);
   if(!coaches.length)throw Error('No active coaches were found in this season. Nothing was changed.');
   const teams=[...new Map((teamRows||[]).map(t=>[String(t.team_id),t])).values()].filter(t=>t.team_id);
   const panel=document.createElement('section');
   panel.id='sfProgramRollover';panel.className='sf-rollover';
   const heading=document.createElement('h4');heading.textContent='Step 1 · Confirm each coach’s program';panel.append(heading);
   const guidance=document.createElement('p');
   guidance.textContent='Choose Stay to retain a school, or Change to pick a new one. Every coach needs an explicit choice; no changes are saved until you confirm the full list.';
   panel.append(guidance);
   const selectors=[];
   for(const coach of coaches){
    const label=document.createElement('label');label.className='sf-rollover-coach';
    const name=document.createElement('strong');name.textContent=coach.coach_name||'Coach';label.append(name);
    const previous=document.createElement('small');previous.textContent='Current: '+(coach.current_team_name||'Unassigned');label.append(previous);
    const select=document.createElement('select');select.required=true;
    select.setAttribute('aria-label','Next season program for '+(coach.coach_name||'coach'));
    select.add(new Option('Select Stay or Change…',''));
    for(const team of teams){
      const same=String(team.team_id)===String(coach.current_team_id);
      const occupied=team.claimed&&!same?' · currently '+(team.claimed_by||'claimed'):'';
      select.add(new Option((same?'Stay · ':'Change · ')+team.team_name+occupied,String(team.team_id)));
    }
    label.append(select);panel.append(label);selectors.push({coach,select});
   }
   const actions=document.createElement('div');actions.className='sf-rollover-actions';
   const cancel=document.createElement('button');cancel.type='button';cancel.className='btn';cancel.textContent='Cancel';
   cancel.onclick=()=>{panel.remove();trigger.textContent='Choose next-season teams'};
   const submit=document.createElement('button');submit.type='button';submit.className='btn primary';submit.textContent='Review and start season';
   actions.append(cancel,submit);panel.append(actions);
   trigger.closest('.admin-card')?.append(panel);
   trigger.textContent='Hide team selections';
   submit.onclick=async()=>{
     if(busy)return;
     const assignments=selectors.map(({coach,select})=>({person_id:coach.person_id,team_id:select.value,confirmed:true}));
     if(assignments.some(a=>!a.team_id)){announce('Select Stay or Change for every active coach.');return}
     if(new Set(assignments.map(a=>a.team_id)).size!==assignments.length){announce('A school can only be assigned to one coach. Resolve the duplicate first.');return}
     const summary=selectors.map(({coach,select})=>coach.coach_name+' → '+select.selectedOptions[0].text).join('\n');
     if(!confirm('Review Season '+(Number(S.season_number)+1)+' assignments:\n\n'+summary+'\n\nCreate this season and archive the current one?'))return;
     busy=true;trigger.disabled=true;submit.disabled=true;
     try{
       announce('Creating season and program assignments in one transaction…');
       const auth=session();
       await req('/rest/v1/rpc/create_next_season_with_programs',{method:'POST',token:auth.access_token,body:{
         p_dynasty_id:D.dynasty_id,p_expected_season_id:S.season_id,p_year:year,p_assignments:assignments
       }});
       announce('Season and coach assignments saved. Returning to the active season…');
       dynasties=await Data.dynasties();
       await loadDynasty(Math.max(0,dynasties.findIndex(x=>x.dynasty_id===D.dynasty_id)));
     }catch(error){announce(error.message||String(error))}
     finally{busy=false;trigger.disabled=false;submit.disabled=false}
   };
  }catch(error){announce(error.message||String(error))}
  finally{busy=false;trigger.disabled=false}
 },true);
})();
