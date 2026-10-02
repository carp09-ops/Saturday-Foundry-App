/* Shared presentation state. Feature and data handlers remain owned by their screens. */
(function(){
 'use strict';
 function syncNavigation(){
  const active=document.querySelector('.view.active')?.id;
  document.querySelectorAll('#nav [data-view],#hqMobileNav [data-mobile-view]').forEach(button=>{
   const selected=(button.dataset.view||button.dataset.mobileView)===active;
   if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
 }
 function syncConnection(){
  let notice=document.getElementById('sfConnectionNotice');
  if(navigator.onLine===false){
   if(!notice){notice=document.createElement('div');notice.id='sfConnectionNotice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');document.getElementById('siteHeader')?.insertAdjacentElement('afterend',notice);}
   notice.textContent='Connection lost. Your current data is still available. Reconnect before saving changes.';
  }else notice?.remove();
 }
 function boot(){
  syncNavigation();syncConnection();
  if(window.Chart?.defaults?.font){window.Chart.defaults.font.family='Inter,sans-serif';window.Chart.defaults.color='#98a7b8';}
  const views=document.getElementById('app');let queued=false;
  if(views)new MutationObserver(records=>{
   if(queued||!records.some(record=>record.target.classList?.contains('view')))return;
   queued=true;requestAnimationFrame(()=>{queued=false;syncNavigation();});
  }).observe(views,{subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('offline',syncConnection);window.addEventListener('online',syncConnection);
  // Keep keyboard users inside an open dialog and return focus after dismissal.
  const dialogs=['dynastyMenuModal','resultModal','resultRecapModal','gameEditModal','hqMobileMoreSheet'].map(id=>document.getElementById(id)).filter(Boolean);
  let currentDialog=null,returnFocus=null;
  const focusable=root=>[...root.querySelectorAll('button:not(:disabled),input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(element=>!element.closest('.hidden,[hidden]'));
  function syncDialog(){
   const next=dialogs.filter(dialog=>dialog.id==='hqMobileMoreSheet'?dialog.classList.contains('open'):!dialog.classList.contains('hidden')).at(-1)||null;
   if(next===currentDialog)return;
   if(next){if(!currentDialog)returnFocus=document.activeElement;currentDialog=next;if(!next.contains(document.activeElement))focusable(next)[0]?.focus({preventScroll:true});}
   else{currentDialog=null;if(returnFocus?.isConnected&&!returnFocus.closest('.hidden,[hidden]'))returnFocus.focus({preventScroll:true});returnFocus=null;}
  }
  const dialogObserver=new MutationObserver(syncDialog);dialogs.forEach(dialog=>dialogObserver.observe(dialog,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('keydown',event=>{
   if(event.key!=='Tab'||!currentDialog)return;
   const items=focusable(currentDialog);if(!items.length)return;
   const first=items[0],last=items.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!currentDialog.contains(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!currentDialog.contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  syncDialog();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
