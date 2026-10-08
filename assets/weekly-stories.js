/* Shared editions come from import-triggered database snapshots. Rendering never writes stories. */
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const list=v=>Array.isArray(v)?v:[];
 function selectEdition(rows,week){return list(rows).find(r=>String(r.week_number)===String(week))||list(rows)[0]||null;}
 function filtered(items,person){return list(items).filter(x=>person==='all'||!person||String(x.person_id)===String(person));}
 function article(x,type){return `<article class="sf-weekly-card ${type}"><span>${esc(type==='recap'?(x.coach_name||'TEAM DESK'):type==='preview'?'NEXT MATCHUP':'RANKINGS')}</span><h4>${esc(x.headline)}</h4><p class="sf-weekly-fact">${esc(x.fact)}</p>${x.body?`<p>${esc(x.body)}</p>`:''}${x.record?`<small>THROUGH THIS WEEK · ${esc(x.record)}</small>`:''}</article>`;}
 function markup(row,person='all'){
  if(!row)return '<div class="story-empty">Weekly editions appear when results, rankings, or the active week are updated.</div>';
  const p=row.payload||{},recaps=filtered(p.recaps,person),previews=filtered(p.previews,person),movers=list(p.movers);
  const lead=person==='all'?(p.lead||recaps[0]):(recaps.find(r=>r.game_id)||previews[0]||recaps[0]);
  const section=(name,items,type,empty)=>`<section class="sf-weekly-section"><h3>${name}</h3>${items.length?`<div class="sf-weekly-grid">${items.map(x=>article(x,type)).join('')}</div>`:`<p class="sf-weekly-empty">${empty}</p>`}</section>`;
  return `${lead?`<div class="sf-weekly-lead"><span>WEEK ${esc(row.week_number)} · THE LEAD</span><h2>${esc(lead.headline)}</h2><p>${esc(lead.fact)}</p></div>`:''}`+
   section(`Around the League · Week ${esc(p.recap_week??row.week_number)}`,recaps,'recap','No team updates match this filter.')+
   section('The Poll Watch',movers,'mover',p.poll_count===25?'No ranking changes to highlight against the previous complete poll.':p.poll_count?'The poll is incomplete. Movement coverage will appear when all 25 entries are recorded.':'No Top 25 poll has been recorded for this week.')+
   section(`Looking Ahead · Week ${esc(p.preview_week??Number(row.week_number)+1)}`,previews,'preview','No upcoming matchups are recorded for this edition.');
 }
 class EditionStore {
  constructor(fetcher){this.fetcher=fetcher;this.cache=new Map();this.pending=new Map();}
  rows(key){return this.cache.get(key)?.rows||[];}
  async load(key,query,force=false){
   if(this.pending.has(key))return this.pending.get(key);
   const cached=this.cache.get(key);if(!force&&cached&&Date.now()-cached.at<60000)return cached.rows;
   const work=this.fetcher(query).then(rows=>{if(!Array.isArray(rows))throw Error('Invalid weekly edition response');this.cache.set(key,{rows,at:Date.now()});if(this.cache.size>12)this.cache.delete(this.cache.keys().next().value);return rows;}).finally(()=>this.pending.delete(key));
   this.pending.set(key,work);return work;
  }
 }
 const api={selectEdition,filtered,markup,EditionStore};
 if(typeof module==='object'&&module.exports){module.exports=api;return;}
 const byId=id=>document.getElementById(id),store=new EditionStore(query=>Data.view('weekly_story_editions',query));
 let scopeKey='',chosenWeek=null,lastSignature='',requestId=0,errorText='',busy=false;
 function scope(sn=storySeasonNumber()){
  const season=(seasons||[]).find(s=>Number(s.season_number)===Number(sn));
  return D?.dynasty_id&&season?{key:`${D.dynasty_id}:${season.season_id}`,dynasty:D.dynasty_id,season:season.season_id}:null;
 }
 function ensureHost(){
  const shell=document.querySelector('#storylines .story-shell');if(!shell)return null;
  let host=byId('sfWeeklyStories');if(!host){host=document.createElement('section');host.id='sfWeeklyStories';host.className='sf-weekly-edition';shell.querySelector('.story-hero')?.after(host);}
  return host;
 }
 function paint(){
  const host=ensureHost(),s=scope();if(!host||!s)return;
  if(scopeKey!==s.key){scopeKey=s.key;chosenWeek=null;errorText='';}
  const rows=store.rows(s.key),selected=selectEdition(rows,chosenWeek);chosenWeek=selected?.week_number??null;
  host.innerHTML=`<div class="sf-weekly-toolbar"><div><span>THE WEEKLY EDITION</span><p>Saved coverage · real results · previous weeks preserved</p></div><div class="sf-weekly-controls"><select id="sfStoryWeek" aria-label="Weekly story edition" ${rows.length?'':'disabled'}>${rows.length?rows.map(r=>`<option value="${esc(r.week_number)}" ${r.week_number===chosenWeek?'selected':''}>Week ${esc(r.week_number)}${r===rows[0]?' · Latest':''}</option>`).join(''):'<option>No editions yet</option>'}</select><button type="button" id="sfStoryRefresh" ${busy?'disabled':''}>${busy?'Refreshing…':'Refresh stories'}</button></div></div>`+
   (errorText?`<p class="sf-weekly-error" role="status">${esc(errorText)}</p>`:'')+
   (busy&&!rows.length?'<div class="story-empty" role="status">Loading this season’s editions…</div>':markup(selected,storyCoachFilter))+
   (selected?`<footer class="sf-weekly-stamp">Edition ${esc(selected.revision)} · Updated ${esc(new Date(selected.updated_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))} · Updates after league imports</footer>`:'');
  byId('sfStoryWeek')?.addEventListener('change',e=>{chosenWeek=Number(e.target.value);paint();});
  byId('sfStoryRefresh')?.addEventListener('click',()=>load(true));
 }
 async function load(force=false){
  const s=scope();if(!s){byId('sfWeeklyStories')?.remove();return;}
  const id=++requestId;busy=true;paint();
  try{
   await store.load(s.key,`dynasty_id=eq.${s.dynasty}&season_id=eq.${s.season}&order=week_number.desc`,force);
   if(id!==requestId||scope()?.key!==s.key)return;
   errorText='';busy=false;
   // Refresh the existing discovery bells without writing or regenerating an edition.
   renderStorylines();renderCoaches();
  }catch(error){
   if(id!==requestId||scope()?.key!==s.key)return;
   busy=false;errorText='Stories could not refresh. Your saved editions are still available; try Refresh stories.';paint();
   console.warn('Weekly stories refresh failed:',error);
  }
 }
 api.rows=sn=>{const s=scope(sn);return s?store.rows(s.key):[];};
 api.chapters=sn=>api.rows(sn).filter(row=>row.payload?.recap_week==null||Number(row.payload.recap_week)===Number(row.week_number)).flatMap(row=>list(row.payload?.recaps).filter(x=>x.game_id).map(x=>({
  id:x.id,kind:'weekly',coach:{person_id:x.person_id,coach_name:x.coach_name},team:x.team,season:Number(sn),week:row.week_number,
  game:{id:x.game_id},headline:x.headline,fact:x.fact,scene:x.body,importance:x.importance||0,link:'records',format:'WEEKLY EDITION',label:`Week ${row.week_number}`
 })));
 api.refresh=()=>load(true);root.SFWeeklyStories=api;
 const original=renderStorylines;
 renderStorylines=function(){
  original();paint();
  if(!scope())return;
  const signature=JSON.stringify([scope().key,state.activeWeek,state.games,state.rankings]);
  if(signature!==lastSignature){lastSignature=signature;load(true);}
 };
 function boot(){
  document.querySelector('#storylines .story-hero h2').textContent='This Week Writes the Next Chapter.';
  document.querySelector('#storylines .story-hero p').textContent='Fresh weekly coverage from league results and rankings. Revisit past editions, then explore the career stories below.';
  renderStorylines();
  setInterval(()=>{if(!document.hidden&&byId('storylines')?.classList.contains('active'))load(true);},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&byId('storylines')?.classList.contains('active'))load(true);});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(typeof window!=='undefined'?window:globalThis);
