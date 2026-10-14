(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pairing(g,programs){
 const find=(id,name)=>programs.find(p=>p.person_id&&(id?String(p.team_id)===String(id):String(p.team_name||'').toLowerCase()===String(name||'').toLowerCase()));
 const a=find(g.team_id,g.team_name),b=find(g.opponent_team_id,g.opponent_team);
 return a&&b&&String(a.person_id)!==String(b.person_id)?{a,b}:null;
}
function label(g,v){
 if(g.status!=='completed')return 'Awaiting final';
 if(!v)return 'Historical final · Not validated';
 if(v.status==='confirmed')return '✓ Confirmed by both';
 if(v.status==='resolved')return `Commissioner resolved · ${v.reviewed_name||'Commissioner'}`;
 if(v.status==='disputed')return '⚠ Commissioner review required';
 return `Entered by ${v.submitted_name||'opponent'} · Awaiting ${v.opponent_name||'opponent'}’s confirmation`;
}
function canValidate(v,person){return !!v&&v.status==='pending'&&String(v.opponent_person)===String(person)&&String(v.submitted_by)!==String(person);}
const api={pairing,label,canValidate,esc};
if(typeof module==='object'&&module.exports){module.exports=api;return;}
root.SFH2H=api;
const rt=root.CDHQ_RUNTIME;if(!rt)return;
const getPerson=()=>rt.getState().myPrograms?.find(p=>String(p.season_id)===String(rt.getSeason()?.season_id))?.person_id;
const findGame=id=>[...(rt.getState().games||[]),...(rt.getState().scheduleGames||[])].find(g=>String(g.id)===String(id));
const isH2H=g=>g&&pairing(g,rt.getState().programs||[]);
const rpc=(name,body)=>rt.req('/rest/v1/rpc/'+name,{method:'POST',token:rt.session()?.access_token,body,timeoutMs:8000});
const loads=new Map();
async function metadata(d,s){
 const key=d+'|'+s;if(loads.has(key))return loads.get(key);
 const task=(async()=>{try{const result=await rpc('get_h2h_results',{p_dynasty_id:d,p_season_id:s});if(!result?.ready)throw Error('Validation service unavailable');return {ready:true,results:result.results||[]};}catch(e){return {ready:false,results:[],error:e.message};}})();loads.set(key,task);
 try{return await task;}finally{loads.delete(key);}
}
for(const method of ['games','scheduleGames']){const original=rt.Data[method].bind(rt.Data);rt.Data[method]=async(d,s)=>{const [rows,meta]=await Promise.all([original(d,s),metadata(d,s)]);return rows.map(g=>({...g,h2h_ready:meta.ready,h2h_validation:meta.results.find(v=>String(v.game_id)===String(g.id))||null}));};}
const originalSubmit=rt.Data.submitResult.bind(rt.Data);
rt.Data.submitResult=async(id,payload)=>{
 const g=findGame(id);if(isH2H(g)&&!g.h2h_ready)throw Error('User vs user validation is preview-only until the database release is approved. Use the isolated QA demo to test.');
 return originalSubmit(id,payload);
};
for(const method of ['editGame','editGameV2']){if(typeof rt.Data[method]!=='function')continue;const original=rt.Data[method].bind(rt.Data);rt.Data[method]=async payload=>{const g=findGame(payload.p_game_id);if(isH2H(g)&&(!g.h2h_ready||!rt.getDynasty()?.is_commissioner&&!['commissioner','co_commissioner'].includes(rt.getDynasty()?.role)))throw Error('User vs user corrections require commissioner review.');return original(payload);};}
function controls(g){
 const v=g.h2h_validation;const me=getPerson();
 if(!g.h2h_ready)return '<span class="h2h-preview-note">Validation preview · <a href="h2h-qa.html">Try the demo</a></span>';
 if(canValidate(v,me))return `<button type="button" data-h2h-validate="${esc(g.id)}">Validate Final</button>`;
 if(v?.status==='disputed'&&(rt.getDynasty()?.is_commissioner||['commissioner','co_commissioner'].includes(rt.getDynasty()?.role)))return `<button type="button" data-h2h-resolve="${esc(g.id)}">Review Final</button>`;
 return '';
}
function footer(g){return `<div class="h2h-validation-state ${esc(g.h2h_validation?.status||'')}"><span>${esc(label(g,g.h2h_validation))}</span>${controls(g)}</div>`;}
const originalCard=root.gameDayCard;
root.gameDayCard=function(g,logo){const card=originalCard(g,logo),p=isH2H(g),owners=root.SFScorecards?.owners(g,rt.getState().programs||[])||[];if(!owners.length||g.is_bye)return card;const names=p?`${esc(p.a.coach_name||p.a.team_name)} vs ${esc(p.b.coach_name||p.b.team_name)}`:esc(owners[0].coach_name||owners[0].team_name);return `<div class="h2h-frame"><div class="h2h-banner">${root.SFScorecards.badge(!!p)}<span>${names}</span></div>${card}${p?footer(g):''}</div>`;};
api.renderInbox=function(){
 const season=rt.getSeason();if(!season)return;
 const games=[...new Map((rt.getState().games||[]).filter(g=>isH2H(g)&&g.h2h_validation&&['pending','disputed'].includes(g.h2h_validation.status)).map(g=>[String(g.id),g])).values()];
 const mine=games.filter(g=>canValidate(g.h2h_validation,getPerson())||String(g.h2h_validation.submitted_by)===String(getPerson()));
 const admin=games.filter(g=>g.h2h_validation.status==='disputed');
 function render(id,host,rows,title){let el=document.getElementById(id);if(!el){el=document.createElement('section');el.id=id;el.className='h2h-inbox';host?.prepend(el);}el.hidden=!rows.length;el.innerHTML=`<h3>${title}</h3>`+rows.map(g=>`<div class="h2h-inbox-game"><strong>${esc(g.week_label||'Week '+g.week_number)} · ${esc(g.team_name)} vs ${esc(g.opponent_team)}</strong>${footer(g)}</div>`).join('');}
 render('h2hMyInbox',document.getElementById('myWeekPanel'),mine,'Finals to validate');
 render('h2hAdminInbox',document.getElementById('admin'),admin,'Disputed user vs user finals');
};
async function refresh(){await rt.loadSeason(rt.getSeason().season_id);api.renderInbox();}
function openDialog(g,resolve){
 if(!g?.h2h_validation)return;document.getElementById('h2hDialog')?.remove();const v={...g.h2h_validation};
 const home=g.home_away==='home'?g.team_name:g.opponent_team,away=g.home_away==='away'?g.team_name:g.opponent_team;
 const el=document.createElement('dialog');el.id='h2hDialog';el.className='h2h-dialog';
 el.innerHTML=`<form><div class="h2h-banner"><b>USER vs USER</b><span>${resolve?'Commissioner review':'Validate final'}</span></div><h3>${esc(away)} at ${esc(home)}</h3><p>Entered by ${esc(v.submitted_name||'opponent')}</p><div class="h2h-scores"><label>${esc(home)}<input name="home" type="number" min="0" value="${v.home_score}" ${resolve?'':'readonly'}></label><label>${esc(away)}<input name="away" type="number" min="0" value="${v.away_score}" ${resolve?'':'readonly'}></label></div>${v.note?`<p>Review note: ${esc(v.note)}</p>`:''}<label class="h2h-note">${resolve?'Resolution note':'If incorrect, describe the issue'}<textarea name="note" maxlength="500"></textarea></label><p class="h2h-message" role="status"></p><div class="h2h-dialog-actions"><button type="button" data-close>Cancel</button>${resolve?'<button type="button" data-action="resolve">Save resolution</button>':'<button type="button" data-action="flag">Flag incorrect score</button><button type="button" data-action="confirm">Confirm final</button>'}</div></form>`;
 document.body.append(el);const opener=document.activeElement;el.addEventListener('close',()=>{el.remove();opener?.focus();});el.querySelector('[data-close]').onclick=()=>el.close();el.showModal();
 el.querySelector('form').onsubmit=e=>e.preventDefault();
 el.addEventListener('click',async e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;const note=el.querySelector('textarea').value.trim(),message=el.querySelector('.h2h-message');
 if(action!=='confirm'&&!note){message.textContent='Please describe the issue or resolution.';return;}
 const rawH=el.querySelector('[name="home"]').value,rawA=el.querySelector('[name="away"]').value,hs=Number(rawH),aws=Number(rawA);
 if(action==='resolve'&&(!rawH||!rawA||!Number.isInteger(hs)||!Number.isInteger(aws)||hs<0||aws<0||hs===aws)){message.textContent='Enter two valid non-tied final scores.';return;}
 const buttons=[...el.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);message.textContent='Saving…';
 try{await rpc(action==='resolve'?'resolve_h2h_result':'validate_h2h_result',action==='resolve'?{p_game_id:g.id,p_version:v.version,p_home_score:hs,p_away_score:aws,p_note:note}:{p_game_id:g.id,p_version:v.version,p_home_score:v.home_score,p_away_score:v.away_score,p_confirm:action==='confirm',p_note:note||null});el.close();await refresh();root.CDHQToast?.(action==='confirm'?'Confirmed by both.':action==='flag'?'Flagged for commissioner review.':'Resolution saved.','success');}
 catch(error){message.textContent=error.message||'Could not save. Refresh and try again.';buttons.forEach(b=>b.disabled=false);}
 });
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-h2h-validate],[data-h2h-resolve]');if(!button)return;e.preventDefault();openDialog(findGame(button.dataset.h2hValidate||button.dataset.h2hResolve),!!button.dataset.h2hResolve);});
api.renderInbox();
})(typeof window==='object'?window:globalThis);
