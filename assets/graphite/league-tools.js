(function(){
 const params=new URLSearchParams(location.search),id=params.get('dynasty'),sid=params.get('season'),view=params.get('view');
 const embedded=params.get('embedded')==='1';
 if(embedded){document.documentElement.classList.add('sf-tools-embedded');document.body.insertAdjacentHTML('afterbegin','<div id="sfEmbeddedStatus" role="status">Loading league tools…</div>')}
 const known=new Set(['overview','schedule','conference','analytics','vegas','storylines','rivalries','records','recap','legacy','admin']);
 if(!embedded)document.body.insertAdjacentHTML('afterbegin','<div id="sfNewSiteReturn"><a href="foundry.html">← Saturday Foundry</a><span>League tools <small>10.0.0-beta.6</small></span></div>');
 let applied=false,pending=false,timer;
 async function align(){
  if(applied||pending||!id||!window.CDHQ_RUNTIME?.session()?.access_token||typeof dynasties==='undefined'||!dynasties.some(d=>d.dynasty_id===id))return;
  pending=true;try{
   if(typeof D==='undefined'||D?.dynasty_id!==id)await loadDynastyById(id);
   if(sid&&(typeof seasons==='undefined'||!seasons.some(s=>s.season_id===sid)))return;
   if(document.querySelector('[data-sf-loading-generation]'))return;
   if(sid&&S?.season_id!==sid)await window.CDHQ_RUNTIME.loadSeason(sid);
   if(D?.dynasty_id===id&&(!sid||S?.season_id===sid)){applied=true;document.documentElement.classList.add('sf-tools-ready');document.getElementById('sfEmbeddedStatus')?.remove();if(known.has(view)&&(view!=='admin'||['commissioner','co_commissioner'].includes(D?.role)))window.switchView(view);}
  }catch(error){console.warn('League context could not be selected automatically.');const status=document.getElementById('sfEmbeddedStatus');if(status)status.textContent='The league tools could not load. Return to Home and refresh your league to try again.';}finally{pending=false}
 }
 const observer=new MutationObserver(()=>{if(applied)return observer.disconnect();if(!timer)timer=setTimeout(()=>{timer=null;align()},120)});observer.observe(document.body,{childList:true,subtree:true});align();
 if(embedded)setTimeout(()=>{const status=document.getElementById('sfEmbeddedStatus');if(!applied&&status)status.textContent='Still waiting for your league. Return to Home and refresh if this does not finish.'},25000);
})();

// Replace only explicit image-fallback slots, never team names or school wordmarks.
(function(){
 const src='assets/graphite/football-fallback.webp';
 const selector='.team-fallback,.v25-choice-logo-fallback,.legacy-team-logo-fb,.sf-match-logo-fallback,.wire-team-logo-fallback,.gotw2-fallback,.gd-logo-fb,.sf-archive-team-fallback,.story-coach-logo > span,#teamDockLogo > span';
 function repair(){if(!document?.body)return;document.querySelectorAll(selector).forEach(el=>{if(el.querySelector('img'))return;const img=document.createElement('img');img.src=src;img.alt='';img.className='sf-football-fallback';el.replaceChildren(img)})}
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;repair()})}).observe(document.body,{childList:true,subtree:true});repair();
})();
