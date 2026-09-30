/* Commissioner Import Desk: all extracted rows stay local until explicitly published. */
(() => {
  'use strict';
  const rt=window.CDHQ_RUNTIME;
  if(!rt)return;
  let rows=[],teams=[],busy=false,context='',ocrWorker=null,activeRead=null;
  const nativeWorkers=new Set();
  const $=id=>document.getElementById(id);
  const esc=rt.esc;
  const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\b(university|college|the)\b/g,'').replace(/[^a-z0-9]/g,'');
  const id=x=>String(x||'');
  const key=(week,home,away)=>`${week}:${[id(home),id(away)].sort().join(':')}`;
  const teamName=t=>String(t.team_name||t.name||'');
  function current(){const d=rt.getDynasty(),s=rt.getSeason();return d&&s?`${d.dynasty_id}:${s.season_id}`:''}
  function allowed(){return ['commissioner','co_commissioner'].includes(String(rt.getDynasty()?.role||''))}
  function note(message,error=false){const el=$('sfImportNote');if(el){el.textContent=message;el.classList.toggle('error',error)}}
  function progress(title,percent=null){
    const box=$('sfImportProgress');if(!box)return;
    box.classList.remove('hidden');$('sfImportProgressTitle').textContent=title;
    const bar=$('sfImportProgressBar');
    if(percent===null)bar.removeAttribute('value');else bar.value=Math.max(0,Math.min(100,percent));
    $('sfImportProgressPercent').textContent=percent===null?'Working…':`${Math.round(percent)}%`;
  }
  function disposeOCR(){
    for(const worker of nativeWorkers)worker.terminate();nativeWorkers.clear();
    if(ocrWorker)ocrWorker.terminate().catch(()=>{});ocrWorker=null;
  }
  function bounded(task,ms,message,signal){
    return new Promise((resolve,reject)=>{
      let timer;
      const finish=(fn,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value)};
      const abort=()=>finish(reject,signal.reason||Error('Screenshot reading cancelled.'));
      if(signal?.aborted)return abort();
      signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>{const error=Error(message);if(activeRead?.controller.signal===signal)activeRead.controller.abort(error);else finish(reject,error)},ms);
      Promise.resolve(task).then(value=>finish(resolve,value),error=>finish(reject,error));
    });
  }
  function cancelRead(){if(activeRead)activeRead.controller.abort(Error('Screenshot reading cancelled. Completed draft rows are kept.'))}
  async function prepareImage(file,signal){
    if(file.size>25*1024*1024)throw Error(`${file.name} is over 25 MB. Select a smaller screenshot.`);
    const objectURL=window.URL.createObjectURL(file),image=new Image();
    try{
      image.src=objectURL;
      await bounded(image.decode(),15000,`Could not open ${file.name}. Use a JPEG or PNG screenshot.`,signal);
      const scale=Math.min(1,2560/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw Error('This browser could not prepare the screenshot.');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas;
    }finally{window.URL.revokeObjectURL(objectURL)}
  }
  // Historical allGames contains other seasons. Match only this season's live views.
  let liveGames=null;
  function games(){const st=rt.getState();return [...new Map([...(liveGames||st.games||[]),...(liveGames?[]:st.scheduleGames||[])].filter(g=>g?.id).map(g=>[id(g.id),g])).values()]}
  function oriented(g){return g.home_away==='away'?{home:id(g.opponent_team_id),away:id(g.team_id),homeScore:g.points_against,awayScore:g.points_for}:{home:id(g.team_id),away:id(g.opponent_team_id),homeScore:g.points_for,awayScore:g.points_against}}
  function findGame(r){return games().find(g=>Number(g.week_number)===Number(r.week)&&key(r.week,oriented(g).home,oriented(g).away)===key(r.week,r.home,r.away)&&g.status!=='cancelled')}
  function optionList(selected){return '<option value="">Choose team</option>'+teams.map(t=>`<option value="${esc(t.team_id)}" ${id(t.team_id)===id(selected)?'selected':''}>${esc(teamName(t))}</option>`).join('')}
  function resolve(name){const n=norm(name);if(!n)return '';const matches=teams.filter(t=>norm(teamName(t))===n||norm(t.abbreviation)===n);return matches.length===1?id(matches[0].team_id):''}
  function mode(){return $('sfImportMode')?.value||'schedule'}
  function rowStatus(r,seen){
    if(String(r.week).trim()===''||!Number.isInteger(Number(r.week))||Number(r.week)<0)return ['problem','Enter a valid week (Week 0 is supported).'];
    if(!r.home||!r.away||r.home===r.away)return ['problem',`Choose two different teams.${r.awayText||r.homeText?` OCR read: ${r.awayText||'?'} @ ${r.homeText||'?'}.`:''}`];
    if(r.uncertain&&!r.confirmed)return ['problem','Confirm which team is home. Screenshot order alone may not establish home field.'];
    const k=key(r.week,r.home,r.away);if(seen.has(k))return ['problem','Duplicate matchup in this batch.'];seen.add(k);
    const existing=findGame(r),hasScore=r.hs!==''||r.as!=='';
    if(mode()==='results'&&(!hasScore||r.hs===''||r.as===''))return ['problem','Both scores are required for results.'];
    if(hasScore&&(!/^\d+$/.test(String(r.hs))||!/^\d+$/.test(String(r.as))||Number(r.hs)===Number(r.as)))return ['problem','Enter two non-tied, nonnegative scores.'];
    if(mode()==='results'&&!existing)return ['problem','No scheduled game matches this week and these teams.'];
    if(existing){
      const o=oriented(existing);
      if(!hasScore)return ['skip','Game already exists; no change needed.'];
      if(existing.status==='completed'){
        if(Number(o.homeScore)===Number(r.hs)&&Number(o.awayScore)===Number(r.as))return ['skip','Scores already match.'];
        return ['problem','Final score conflicts with the database. Correct the row or edit that game individually.'];
      }
      if(mode()==='schedule')return ['problem','Game already exists. Import its score through Results instead.'];
      return ['ready','Match found; score will update the existing game.'];
    }
    return ['ready',hasScore?'New game and final score.':'New scheduled game.'];
  }
  function render(){
    const host=$('sfImportRows');if(!host)return;
    const seen=new Set();let ready=0,problems=0;
    host.innerHTML=rows.map((r,i)=>{
      const [state,reason]=rowStatus(r,seen);r.state=state;
      if(state==='ready')ready++;if(state==='problem')problems++;
      return `<div class="sf-import-row ${state}" data-row="${i}"><div class="sf-import-row-head"><strong>${esc(state==='ready'?'READY':state==='skip'?'ALREADY STORED':'NEEDS REVIEW')} · ${i+1}</strong><span>${esc(r.source||'Draft')}</span></div><div class="sf-import-fields"><label>Week<input data-field="week" type="number" min="0" value="${esc(r.week)}"></label><label>Home<select data-field="home">${optionList(r.home)}</select></label><label>Away<select data-field="away">${optionList(r.away)}</select></label><label class="sf-import-score">Home score<input data-field="hs" type="number" min="0" placeholder="—" value="${esc(r.hs)}"></label><label class="sf-import-score">Away score<input data-field="as" type="number" min="0" placeholder="—" value="${esc(r.as)}"></label></div>${r.uncertain?`<label class="sf-import-confirm"><input data-field="confirmed" type="checkbox" ${r.confirmed?'checked':''}>I checked which team is home</label>`:''}<small>${esc(reason)}${r.raw?` · Source: ${esc(r.raw.slice(0,160))}`:''}</small><button type="button" class="secondary" data-remove="${i}" aria-label="Remove row ${i+1}">Remove</button></div>`;
    }).join('');
    $('sfImportCount').textContent=`${rows.length} draft · ${ready} ready · ${problems} need review`;
    $('sfImportPublish').disabled=busy||ready===0||problems>0||!allowed()||current()!==context;
    for(const name of ['sfImportRead','sfImportMode','sfImportWeek','sfImportImages','sfImportAdd','sfImportClear','sfImportText','sfImportOpen','sfImportClose'])if($(name))$(name).disabled=busy||!allowed();
    for(const el of host.querySelectorAll('input,select,button'))el.disabled=busy;
    $('sfImportCancel').classList.toggle('hidden',!activeRead);
    $('sfImportRead').textContent=activeRead?'Reading Screenshots…':'Read Screenshots';
    $('sfImportDesk').setAttribute('aria-busy',String(busy));
  }
  function parseLine(line,defaultWeek,source){
    const raw=String(line||'').trim();if(!raw||/^(week|home|away|team|rank)[\s,:]/i.test(raw))return null;
    // CSV/TSV: week,away,home,away_score,home_score (or away,home,... with chosen week).
    const columns=raw.split(/\t|,/).map(x=>x.trim().replace(/^"|"$/g,''));
    let week=defaultWeek,away='',home='',as='',hs='',uncertain=false;
    if(columns.length>=2){
      let offset=0;if(/^\d+$/.test(columns[0])&&columns.length>=3){week=Number(columns[0]);offset=1}
      away=columns[offset];home=columns[offset+1];as=columns[offset+2]||'';hs=columns[offset+3]||'';
    }else{
      const wm=raw.match(/\bweek\s*(\d+)\b/i);if(wm)week=Number(wm[1]);
      const clean=raw.replace(/\bweek\s*\d+\b/i,'').trim();
      const split=clean.match(/^(.+?)\s+(?:@|at|vs\.?|versus)\s+(.+?)(?:\s+([0-9]{1,3})\s*[-–:]\s*([0-9]{1,3}))?$/i);
      if(split){away=split[1];home=split[2];as=split[3]||'';hs=split[4]||'';
        if(!as&&mode()==='results'){
          const a=away.match(/^(.*?)\s+(\d{1,3})$/),h=home.match(/^(.*?)\s+(\d{1,3})$/);
          if(a&&h){away=a[1];as=a[2];home=h[1];hs=h[2]}
        }
      }
      else{
        // OCR commonly places teams and scores together without a separator.
        const hits=teams.map(t=>({t,name:teamName(t)})).filter(x=>norm(clean).includes(norm(x.name))&&norm(x.name).length>3).sort((a,b)=>b.name.length-a.name.length);
        const unique=[];for(const h of hits)if(!unique.some(u=>norm(u.name).includes(norm(h.name))))unique.push(h);
        if(unique.length===2){const first=clean.toLowerCase().indexOf(unique[0].name.toLowerCase()),second=clean.toLowerCase().indexOf(unique[1].name.toLowerCase());away=(first<second?unique[0]:unique[1]).name;home=(first<second?unique[1]:unique[0]).name;uncertain=true}
      }
    }
    if(!away&&!home)return null;
    const cleanTeam=s=>String(s||'').replace(/^#?\d{1,2}\s+/,'').replace(/\s+\(?\d{1,3}-\d{1,3}\)?$/,'').trim();
    return {week,away:resolve(cleanTeam(away)),home:resolve(cleanTeam(home)),awayText:away,homeText:home,as:String(as),hs:String(hs),raw,source,uncertain,confirmed:false};
  }
  function parse(text,source){
    let week=Number($('sfImportWeek').value||0),pending=null;
    const output=[];
    for(const line of String(text||'').split(/\r?\n/)){
      const wm=line.match(/^\s*(?:week|wk)\s*(\d+)\s*$/i);if(wm){week=Number(wm[1]);pending=null;continue}
      const direct=parseLine(line,week,source);if(direct){output.push(direct);pending=null;continue}
      // Some screenshots OCR each side of a matchup on its own line.
      const content=line.trim().replace(/^#\d{1,2}\s+/,'');
      const candidates=teams.filter(t=>norm(content).includes(norm(teamName(t)))&&norm(teamName(t)).length>3).sort((a,b)=>teamName(b).length-teamName(a).length);
      const team=candidates[0];if(!team)continue;
      const score=content.match(/(?:^|\s)(\d{1,3})\s*$/)?.[1]||'';
      const side={team:id(team.team_id),score,raw:line.trim()};
      if(pending&&pending.team!==side.team){output.push({week,away:pending.team,home:side.team,as:pending.score,hs:side.score,source,raw:`${pending.raw} / ${side.raw}`,uncertain:true,confirmed:false});pending=null}
      else pending=side;
    }
    return output;
  }
  function addText(){if(!allowed())return;const parsed=parse($('sfImportText').value,'Text / CSV');if(!parsed.length)return note('No matchups recognized. Use one game per line: Away @ Home, or week,away,home,away score,home score.',true);rows.push(...parsed);render();note(`Added ${parsed.length} draft rows. Review team matches and home/away order before publishing.`)}
  async function loadOCR(signal){
    if(ocrWorker)return ocrWorker;
    progress('Starting the photo reader');
    if(!window.Tesseract){
      const response=await fetch('https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',{signal});
      if(!response.ok)throw Error('The photo reader could not download. Check your connection and retry.');
      const source=await response.text();
      await new Promise((resolve,reject)=>{
        // Scope native browser constructors so the legacy database URL cannot shadow them.
        window.sfImportWorkerFactory=function(...args){const worker=new window.Worker(...args);nativeWorkers.add(worker);worker.addEventListener('error',e=>{if(activeRead)activeRead.controller.abort(Error(e.message||'The photo reader stopped unexpectedly. Retry this screenshot.'))});return worker};
        const script=document.createElement('script');
        const bundleURL=window.URL.createObjectURL(new Blob(['(function(URL,Worker){\n',source,'\n}).call(window,window.URL,window.sfImportWorkerFactory);'],{type:'text/javascript'}));
        const cleanup=()=>{window.URL.revokeObjectURL(bundleURL);delete window.sfImportWorkerFactory;signal.removeEventListener('abort',abort)};
        const abort=()=>{script.remove();cleanup();reject(signal.reason)};
        signal.addEventListener('abort',abort,{once:true});
        script.src=bundleURL;script.onload=()=>{cleanup();window.Tesseract?resolve():reject(Error('The photo reader did not start. Retry this screenshot.'))};
        script.onerror=()=>{cleanup();reject(Error('The photo reader could not load. Check your connection and retry.'))};document.head.appendChild(script);
      });
    }
    const pending=window.Tesseract.createWorker('eng',1,{
      workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
      corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
      langPath:'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int',
      logger:message=>{
        if(!activeRead||signal.aborted)return;
        const reading=message.status==='recognizing text';
        const labels={'loading tesseract core':'Loading the photo reader','initializing tesseract':'Starting the photo reader','loading language traineddata':'Downloading English text recognition (cached for next time)','initializing api':'Preparing text recognition'};
        progress(reading?`Reading screenshot ${activeRead.index+1} of ${activeRead.total}`:(labels[message.status]||'Preparing the photo reader'),typeof message.progress==='number'?message.progress*100:null);
      },
      errorHandler:error=>{if(activeRead&&!signal.aborted)activeRead.controller.abort(Error(`Photo reader error: ${String(error)}. Retry this screenshot.`))}
    });
    pending.then(worker=>{if(signal.aborted)worker.terminate().catch(()=>{})},()=>{});
    const worker=await pending;if(signal.aborted){await worker.terminate();throw signal.reason}
    ocrWorker=worker;return worker;
  }
  async function readImages(){
    if(busy||!allowed()||context!==current())return;
    const files=[...$('sfImportImages').files];if(!files.length)return note('Select one or more screenshots first.',true);
    if(files.length>12)return note('Import up to 12 screenshots at a time to keep review manageable.',true);
    if(!teams.length)return note('Team names are still loading. Reopen the Import Desk and try again.',true);
    const startingContext=context,startingMode=mode(),controller=new AbortController(),signal=controller.signal;
    const job={controller,index:0,total:files.length,started:Date.now()};activeRead=job;busy=true;render();
    $('sfImportProgress').scrollIntoView({behavior:'smooth',block:'nearest'});
    progress('Starting the photo reader');note('Reading screenshots creates drafts only. The first use downloads the photo reader.');
    $('sfImportElapsed').textContent='0s elapsed';
    const clock=setInterval(()=>{$('sfImportElapsed').textContent=`${Math.floor((Date.now()-job.started)/1000)}s elapsed`},1000);
    let found=0,completed=0,raw=[];
    try{
      const worker=await bounded(loadOCR(signal),45000,'The photo reader could not start within 45 seconds. Check your connection and retry. No games were published.',signal);
      await bounded(worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'}),10000,'The photo reader could not prepare itself. Retry this screenshot.',signal);
      for(let i=0;i<files.length;i++){
        job.index=i;progress(`Preparing screenshot ${i+1} of ${files.length}`);
        const image=await prepareImage(files[i],signal);
        progress(`Reading screenshot ${i+1} of ${files.length}`,0);
        const result=await bounded(worker.recognize(image),60000,`Screenshot ${i+1} took longer than 60 seconds. Try a tighter crop of the game list. Completed draft rows are kept.`,signal);
        image.width=1;image.height=1;
        if(startingContext!==current()||startingMode!==mode()||!allowed())throw Error('League, season, or access changed. Reopen the Import Desk and read the screenshots again.');
        const text=result.data?.text||'';raw.push(`--- ${files[i].name} ---\n${text}`);
        const proposed=parse(text,files[i].name);rows.push(...proposed);found+=proposed.length;completed++;
        $('sfImportText').value=raw.join('\n\n');render();
        note(`Read ${completed} of ${files.length} screenshots · ${found} proposed games so far.`);
      }
      progress(`Finished · ${completed} screenshots · ${found} proposed games`,100);
      note(found?`Read ${completed} screenshots and proposed ${found} games. Compare the draft count with your screenshots, then review teams, home/away and scores.`:'The photo reader finished but found no matchups. Open Text or CSV to inspect the extracted text. Try a clearer crop of the game list.',!found);
    }catch(e){
      controller.abort(e);disposeOCR();progress(`Stopped · ${completed} of ${files.length} screenshots read`);
      note(`${e.message||String(e)}${completed?` ${found} proposed games from completed screenshots remain in your draft.`:''}`,true);
    }finally{clearInterval(clock);if(activeRead===job)activeRead=null;busy=false;render()}
  }
  async function publish(){
    if(busy||!allowed()||context!==current())return note('Reopen the Import Desk for the selected league and season.',true);
    render();const pending=rows.filter(r=>r.state==='ready');if(rows.some(r=>r.state==='problem')||!pending.length)return note('Resolve every flagged row before publishing.',true);
    const s=rt.getSeason();busy=true;render();let saved=0;
    try{
      const [entryGames,scheduleGames]=await Promise.all([rt.Data.games(rt.getDynasty().dynasty_id,s.season_id),rt.Data.scheduleGames(rt.getDynasty().dynasty_id,s.season_id)]);
      liveGames=[...(entryGames||[]),...(scheduleGames||[])];
      render();if(rows.some(r=>r.state==='problem'))throw Error('The live schedule changed. Review flagged rows before publishing.');
      const freshPending=rows.filter(r=>r.state==='ready');
      for(const r of freshPending){
        if(context!==current())throw Error('League or season changed. Import stopped.');
        note(`Publishing ${saved+1} of ${freshPending.length}…`);
        const existing=findGame(r);
        const homeRank=existing?(existing.home_away==='away'?existing.opponent_rank:existing.team_rank):null;
        const awayRank=existing?(existing.home_away==='away'?existing.team_rank:existing.opponent_rank):null;
        const payload={p_week_number:Number(r.week),p_home_team_id:r.home,p_away_team_id:r.away,p_home_score:r.hs===''?null:Number(r.hs),p_away_score:r.as===''?null:Number(r.as),p_home_rank:homeRank??null,p_away_rank:awayRank??null,p_overtime:existing?.overtime||false,p_game_type:existing?.game_type||'regular_season',p_result_method:existing?.result_method||'played'};
        if(existing)await rt.Data.editGameV2({p_game_id:existing.id,...payload});
        else await rt.Data.createGameSimple({p_season_id:s.season_id,...payload});
        saved++;r.state='published';r.published=true;
      }
      rows=rows.filter(r=>!r.published);await rt.loadSeason(s.season_id);note(`Published ${saved} games to ${rt.getDynasty()?.name||'this league'} · Season ${s.season_number}.`);
    }catch(e){await rt.loadSeason(s.season_id).catch(()=>{});note(`Published ${saved} of ${pending.length}. Stopped: ${e.message||e}. Remaining rows are still drafts.`,true)}finally{liveGames=null;busy=false;render()}
  }
  async function open(){
    if(busy||!allowed())return;
    const card=$('sfImportDesk');card.classList.remove('hidden');context=current();rows=[];teams=[];liveGames=null;
    $('sfImportLeague').textContent=`${rt.getDynasty()?.name||'Current league'} · Season ${rt.getSeason()?.season_number||''}`;
    $('sfImportWeek').value=rt.getSelectedWeek()??rt.currentWeek()??0;
    note('Loading team names for this season…');render();
    try{teams=await rt.Data.scheduleTeams(rt.getSeason().season_id);if(context!==current())return;note(`Ready. ${teams.length} teams available. Screenshots are read in your browser; review each proposed row.`);render()}
    catch(e){note(`Could not load season teams: ${e.message}`,true)}
    card.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function boot(){
    const admin=$('admin');if(!admin||$('sfImportDesk'))return;
    const button=document.createElement('button');button.type='button';button.id='sfImportOpen';button.className='btn primary';button.textContent='Import Schedule & Results';
    const entry=document.createElement('section');entry.id='sfImportEntry';entry.className='admin-card sf-import-entry';
    entry.innerHTML='<div><div class="kicker">SCHEDULE & RESULTS</div><h3>Game Imports</h3><p>Bring your screenshots into a draft, review the games, then publish to the selected league and season.</p></div>';
    entry.appendChild(button);const grid=admin.querySelector('.admin-grid');grid?grid.before(entry):admin.prepend(entry);
    const card=document.createElement('section');card.id='sfImportDesk';card.className='hidden';card.setAttribute('aria-labelledby','sfImportTitle');card.innerHTML=`<div class="kicker">COMMISSIONER · IMPORT DESK · QA 9.8.59</div><h3 id="sfImportTitle">Schedule & Results</h3><ol class="sf-import-steps" aria-label="Import steps"><li>1 · Upload</li><li>2 · Review</li><li>3 · Publish</li></ol><p id="sfImportLeague"></p><p>Upload screenshots or paste one game per line. Review every matchup before publishing to this league and season.</p><div class="sf-import-grid"><label>Import type<select id="sfImportMode"><option value="schedule">Season schedule</option><option value="results">Weekly results</option></select></label><label>Default week<input id="sfImportWeek" type="number" min="0" value="0"></label><label>Screenshots (up to 12)<input id="sfImportImages" type="file" accept="image/*" multiple></label></div><div class="sf-import-actions"><button id="sfImportRead" type="button">Read Screenshots</button><button id="sfImportClose" class="secondary" type="button">Close</button></div><div id="sfImportProgress" class="sf-import-progress hidden" role="status" aria-live="polite"><div class="sf-import-progress-top"><span class="sf-import-spinner" aria-hidden="true"></span><strong id="sfImportProgressTitle">Starting the photo reader</strong><span id="sfImportProgressPercent">Working…</span></div><progress id="sfImportProgressBar" max="100" aria-label="Screenshot reading progress"></progress><div class="sf-import-progress-bottom"><small id="sfImportElapsed">0s elapsed</small><button id="sfImportCancel" class="secondary hidden" type="button">Cancel Reading</button></div></div><details class="sf-import-text-details"><summary>Text or CSV · alternate input & extracted text</summary><label class="sf-import-raw">Text or CSV <small>Format: Away @ Home, or week,away,home,away score,home score. OCR text appears here for editing.</small><textarea id="sfImportText" placeholder="0,Georgia State,Tennessee\n1,Notre Dame,Ohio State,17,24"></textarea></label><div class="sf-import-actions"><button id="sfImportAdd" class="secondary" type="button">Add Rows From Text</button><button id="sfImportClear" class="secondary" type="button">Clear Draft</button></div></details><div id="sfImportNote" class="sf-import-note" role="status"></div><div id="sfImportRows" class="sf-import-rows"></div><div class="sf-import-foot"><strong id="sfImportCount">0 draft</strong><div class="sf-import-actions"><button id="sfImportPublish" type="button" disabled>Publish Reviewed Games</button></div><small>Existing final scores are never overwritten by a batch. Correct those games individually using the audited game editor.</small></div>`;
    entry.after(card);
    $('sfImportCancel').onclick=cancelRead;
    button.onclick=open;$('sfImportClose').onclick=()=>card.classList.add('hidden');$('sfImportAdd').onclick=addText;$('sfImportRead').onclick=readImages;$('sfImportPublish').onclick=publish;
    $('sfImportClear').onclick=()=>{rows=[];render();note('Draft cleared.')};$('sfImportMode').onchange=render;
    $('sfImportRows').addEventListener('change',e=>{const el=e.target.closest('[data-field]'),parent=e.target.closest('[data-row]');if(!el||!parent)return;rows[Number(parent.dataset.row)][el.dataset.field]=el.type==='checkbox'?el.checked:el.value;render()});
    $('sfImportRows').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;rows.splice(Number(b.dataset.remove),1);render()});
    const observer=new MutationObserver(()=>{const visible=allowed();entry.classList.toggle('hidden',!visible);if(!visible){cancelRead();card.classList.add('hidden');}if(!card.classList.contains('hidden')&&current()!==context){cancelRead();rows=[];card.classList.add('hidden')}});
    observer.observe(admin,{attributes:true,attributeFilter:['class']});
    entry.classList.toggle('hidden',!allowed());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
