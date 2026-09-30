/* Commissioner Import Desk: all extracted rows stay local until explicitly published. */
(() => {
  'use strict';
  const rt=window.CDHQ_RUNTIME;
  if(!rt)return;
  let rows=[],teams=[],busy=false,context='',ocrWorker=null,activeRead=null;
  const nativeWorkers=new Set();
  const $=id=>document.getElementById(id);
  const esc=rt.esc;
  const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/^the\s+/,'').replace(/[^a-z0-9]/g,'');
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
  function aliases(t){
    const extras={'miamioh':['Miami University','Miami Ohio'],'miami':['Miami FL','Miami Florida'],'hawaii':['Hawaii'],'appalachianstate':['App State']};
    return [teamName(t),t.abbreviation,...(extras[norm(teamName(t))]||[])].filter(Boolean);
  }
  function resolve(name){const n=norm(name);if(!n)return '';const matches=teams.filter(t=>aliases(t).some(a=>norm(a)===n));return matches.length===1?id(matches[0].team_id):''}
  function cellMatch(text){
    const clean=String(text||'').replace(/^\s*[#]?\d{1,2}\s*/,'').trim(),n=norm(clean);if(!n)return {team:'',text:clean};
    const matches=[];
    for(const t of teams)for(const alias of aliases(t)){
      const a=norm(alias);if(!a)continue;
      const exact=a.length>=5?n.includes(a):clean.split(/[^a-z0-9]+/i).some(token=>norm(token)===a);
      if(exact)matches.push({team:id(t.team_id),alias:a,length:a.length});
    }
    matches.sort((a,b)=>b.length-a.length);
    if(matches.length){const best=matches[0],competing=matches.some(m=>m.team!==best.team&&!best.alias.includes(m.alias));if(!competing)return {team:best.team,text:clean,suggested:false}}
    // Offer a unique close spelling as a suggestion; it always requires confirmation.
    const distance=(a,b)=>{let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=0;i<a.length;i++){const next=[i+1];for(let j=0;j<b.length;j++)next[j+1]=Math.min(next[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1));prev=next}return prev[b.length]};
    const ranked=teams.map(t=>({team:id(t.team_id),score:Math.min(...aliases(t).filter(a=>norm(a).length>=5).map(a=>distance(n,norm(a))))})).sort((a,b)=>a.score-b.score);
    if(n.length>=5&&ranked[0]?.score<=Math.max(1,Math.floor(n.length*.18))&&ranked[1]?.score>ranked[0].score)return {team:ranked[0].team,text:clean,suggested:true};
    return {team:'',text:clean};
  }
  function mode(){return $('sfImportMode')?.value||'schedule'}
  const eastern=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function kickoff(r){
    if(!r.date&&!r.time)return null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')||!/^\d{2}:\d{2}$/.test(r.time||''))throw Error('Enter both a valid date and kickoff time (ET).');
    const target=Date.parse(`${r.date}T${r.time}:00Z`);if(!Number.isFinite(target))throw Error('Enter a valid kickoff date.');
    let utc=target;
    for(let i=0;i<3;i++){const parts=Object.fromEntries(eastern.formatToParts(new Date(utc)).map(x=>[x.type,x.value]));const wall=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);utc+=target-wall}
    const parts=Object.fromEntries(eastern.formatToParts(new Date(utc)).map(x=>[x.type,x.value]));
    if(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`!==`${r.date}T${r.time}`)throw Error('This date or ET kickoff time is invalid.');
    return new Date(utc).toISOString();
  }
  function metadata(r,g){
    const o=g?oriented(g):null,awaySide=g?.home_away==='away';
    const homeRank=g?(awaySide?g.opponent_rank:g.team_rank):null,awayRank=g?(awaySide?g.team_rank:g.opponent_rank):null;
    return {p_kickoff_time:kickoff(r)||g?.kickoff_time||null,p_home_rank:r.hr===''||r.hr==null?homeRank??null:Number(r.hr),p_away_rank:r.ar===''||r.ar==null?awayRank??null:Number(r.ar)};
  }
  function metadataChanged(r,g){const m=metadata(r,g);return (r.date&&Date.parse(m.p_kickoff_time)!==Date.parse(g.kickoff_time))||(r.hr!==''&&r.hr!=null&&m.p_home_rank!==(g.home_away==='away'?g.opponent_rank:g.team_rank))||(r.ar!==''&&r.ar!=null&&m.p_away_rank!==(g.home_away==='away'?g.team_rank:g.opponent_rank))}
  function photoDate(text){
    const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];const match=text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[ ,]*(\d{1,2})/i);const year=Number($('sfImportYear')?.value||rt.getSeason()?.year);
    if(!match||!Number.isInteger(year)||year<1900||year>2200)return '';
    const value=`${year}-${String(months.indexOf(match[1].toLowerCase())+1).padStart(2,'0')}-${match[2].padStart(2,'0')}`;const weekday=text.match(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i);if(weekday&&['sun','mon','tue','wed','thu','fri','sat'][new Date(value+'T12:00:00Z').getUTCDay()]!==weekday[1].toLowerCase())return '';return value;
  }
  function photoTime(text){const m=text.replace(/\s/g,'').match(/(\d{1,2})[:.](\d{2})(AM|PM)/i);if(!m||+m[1]<1||+m[1]>12||+m[2]>59)return '';return `${String(+m[1]%12+(m[3].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${m[2]}`}
  function rankOf(text){const m=String(text||'').match(/^\s*#?(\d{1,2})\s*[A-Za-z]/);return m&&+m[1]>=1&&+m[1]<=25?m[1]:''}
  function rowStatus(r,seen){
    if(String(r.week).trim()===''||!Number.isInteger(Number(r.week))||Number(r.week)<0)return ['problem','Enter a valid week (Week 0 is supported).'];
    if(!r.home||!r.away||r.home===r.away)return ['problem',`Choose two different teams.${r.awayText||r.homeText?` OCR read: ${r.awayText||'?'} @ ${r.homeText||'?'}.`:''}`];
    if((r.uncertain||r.reviewRequired)&&!r.confirmed)return ['problem',r.reviewReason||'Confirm which team is home. Screenshot order alone may not establish home field.'];
    try{kickoff(r)}catch(e){return ['problem',e.message]}
    for(const field of ['hr','ar'])if(r[field]!==''&&r[field]!=null&&(!/^\d+$/.test(String(r[field]))||+r[field]<1||+r[field]>25))return ['problem','Ranks must be between 1 and 25, or blank.'];
    const k=key(r.week,r.home,r.away);if(seen.has(k))return ['problem','Duplicate matchup in this batch.'];seen.add(k);
    const existing=findGame(r),hasScore=r.hs!==''||r.as!=='';
    if(hasScore&&Number(r.week)===0)return ['problem','Week 0 final scores must be entered with the individual score editor.'];
    if(mode()==='results'&&(!hasScore||r.hs===''||r.as===''))return ['problem','Both scores are required for results.'];
    if(hasScore&&(!/^\d+$/.test(String(r.hs))||!/^\d+$/.test(String(r.as))||Number(r.hs)===Number(r.as)))return ['problem','Enter two non-tied, nonnegative scores.'];
    if(mode()==='results'&&!existing)return ['problem','No scheduled game matches this week and these teams.'];
    if(existing){
      const o=oriented(existing);
      if(o.home!==r.home||o.away!==r.away)return ['problem','Home/away order conflicts with the existing schedule.'];
      if(!hasScore)return existing.status==='completed'?['skip','Completed game retained.']:metadataChanged(r,existing)?['ready','Update kickoff and ranks on the scheduled game.']:['skip','Game already exists; no change needed.'];
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
    $('sfImportDesk').setAttribute('data-import-mode',mode());
    const seen=new Set();let ready=0,problems=0;
    host.innerHTML=rows.map((r,i)=>{
      const [state,reason]=rowStatus(r,seen);r.state=state;
      if(state==='ready')ready++;if(state==='problem')problems++;
      return `<div class="sf-import-row ${state}" data-row="${i}"><div class="sf-import-row-head"><strong>${esc(state==='ready'?'READY':state==='skip'?'ALREADY STORED':'NEEDS REVIEW')} · ${i+1}</strong><span>${esc(r.source||'Draft')}</span></div><div class="sf-import-fields"><label>Week<input data-field="week" type="number" min="0" value="${esc(r.week)}"></label><label>Home<select data-field="home">${optionList(r.home)}</select></label><label>Away<select data-field="away">${optionList(r.away)}</select></label><label class="sf-import-score">Home score<input data-field="hs" type="number" min="0" placeholder="—" value="${esc(r.hs)}"></label><label class="sf-import-score">Away score<input data-field="as" type="number" min="0" placeholder="—" value="${esc(r.as)}"></label></div><div class="sf-import-fields sf-import-metadata"><label>Date<input data-field="date" type="date" value="${esc(r.date||'')}"></label><label>Kickoff (ET)<input data-field="time" type="time" value="${esc(r.time||'')}"></label><label>Home rank<input data-field="hr" type="number" min="1" max="25" placeholder="—" value="${esc(r.hr||'')}"></label><label>Away rank<input data-field="ar" type="number" min="1" max="25" placeholder="—" value="${esc(r.ar||'')}"></label></div>${r.uncertain||r.reviewRequired?`<label class="sf-import-confirm"><input data-field="confirmed" type="checkbox" ${r.confirmed?'checked':''}>${esc(r.confirmLabel||'I checked which team is home')}</label>`:''}${r.preview?`<img class="sf-import-source-preview" src="${esc(r.preview)}" alt="Original screenshot row ${i+1}" loading="lazy">`:""}<small>${esc(reason)}${r.raw?` · Source: ${esc(r.raw.slice(0,160))}`:''}</small><button type="button" class="secondary" data-remove="${i}" aria-label="Remove row ${i+1}">Remove</button></div>`;
    }).join('');
    $('sfImportCount').textContent=`${rows.length} draft · ${ready} ready · ${problems} need review`;
    $('sfImportPublish').disabled=busy||ready===0||problems>0||!allowed()||current()!==context;
    for(const name of ['sfImportRead','sfImportMode','sfImportWeek','sfImportYear','sfImportImages','sfImportAdd','sfImportClear','sfImportText','sfImportOpen','sfImportClose'])if($(name))$(name).disabled=busy||!allowed();
    for(const el of host.querySelectorAll('input,select,button'))el.disabled=busy;
    $('sfImportCancel').classList.toggle('hidden',!activeRead);
    $('sfImportRead').textContent=activeRead?'Reading Screenshots…':'Read Screenshots';
    $('sfImportDesk').setAttribute('aria-busy',String(busy));
  }
  function parseLine(line,defaultWeek,source){
    const raw=String(line||'').trim();if(!raw||/^(week|home|away|team|rank|matchup|date|time|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)[\s,:]/i.test(raw))return null;
    // CSV/TSV: week,away,home,away_score,home_score (or away,home,... with chosen week).
    const columns=raw.split(/\t|,/).map(x=>x.trim().replace(/^"|"$/g,''));
    let week=defaultWeek,away='',home='',as='',hs='',date='',time='',ar='',hr='',uncertain=false;
    if(columns.length>=2){
      let offset=0;if(/^\d+$/.test(columns[0])&&columns.length>=3){week=Number(columns[0]);offset=1}
      away=columns[offset];home=columns[offset+1];as=columns[offset+2]||'';hs=columns[offset+3]||'';date=columns[offset+4]||'';time=columns[offset+5]||'';ar=columns[offset+6]||'';hr=columns[offset+7]||'';
      if(offset===0&&!resolve(away)&&!resolve(home))return null;
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
    return {week,date,time,ar:ar||rankOf(away),hr:hr||rankOf(home),away:resolve(cleanTeam(away)),home:resolve(cleanTeam(home)),awayText:away,homeText:home,as:String(as),hs:String(hs),raw,source,uncertain,confirmed:false};
  }
  function parse(text,source){
    let week=Number($('sfImportWeek').value||0);const output=[];
    for(const line of String(text||'').split(/\r?\n/)){
      const wm=line.match(/^\s*(?:week|wk)\s*(\d+)\s*$/i);if(wm){week=Number(wm[1]);continue}
      const direct=parseLine(line,week,source);if(direct)output.push(direct);
    }
    return output;
  }
  function wordsOf(data){return (data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).flatMap(l=>l.words||[]))).filter(w=>w.bbox&&w.bbox.x1>w.bbox.x0&&w.bbox.y1>w.bbox.y0)}
  const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]};
  function photoLayout(data,image){
    const words=wordsOf(data),headings=words.filter(w=>/^matchup$/i.test(w.text.trim())),headingY=headings.length?Math.max(...headings.map(w=>w.bbox.y1)):0;
    const markers=words.filter(w=>/^(at|@|vs\.?)$/i.test(w.text.trim())&&w.confidence>=30&&w.bbox.y0>headingY);
    let cluster=[];
    for(const seed of markers){const group=markers.filter(w=>Math.abs((w.bbox.x0+w.bbox.x1)/2-(seed.bbox.x0+seed.bbox.x1)/2)<image.width*.035);if(group.length>cluster.length)cluster=group}
    if(cluster.length<3)return null;
    cluster.sort((a,b)=>a.bbox.y0-b.bbox.y0);
    const original=cluster.map(w=>({x:(w.bbox.x0+w.bbox.x1)/2,y:(w.bbox.y0+w.bbox.y1)/2,kind:w.text.toLowerCase()}));
    const gaps=original.slice(1).map((r,i)=>r.y-original[i].y).filter(g=>g>median(cluster.map(w=>w.bbox.y1-w.bbox.y0))*1.5);
    if(!gaps.length)return null;const gap=median(gaps);if(gap>image.height*.12)return null;
    const rows=[];
    for(let i=0;i<original.length;i++){
      if(i){const before=original[i-1],delta=original[i].y-before.y,steps=Math.round(delta/gap);if(steps>1&&steps<=4&&Math.abs(delta/steps-gap)<gap*.2)for(let n=1;n<steps;n++)rows.push({x:before.x+(original[i].x-before.x)*n/steps,y:before.y+delta*n/steps,kind:'inferred'})}
      rows.push(original[i]);
    }
    const separatorX=median(rows.map(r=>r.x));
    const dateHeading=words.find(w=>/^date$/i.test(w.text.trim())&&w.bbox.x0>separatorX);
    const awayLeft=Math.max(0,separatorX-gap*4.85),awayRight=separatorX-gap*.4,homeLeft=separatorX+gap*1.85;
    const homeRight=dateHeading?dateHeading.bbox.x0-gap*.4:Math.min(image.width,separatorX+gap*5.8);
    if(awayRight<=awayLeft||homeRight<=homeLeft)return null;
    const timeHeading=words.find(w=>/^time/i.test(w.text.trim())&&w.bbox.x0>homeRight);
    return {words,rows,gap,separatorX,awayLeft,awayRight,homeLeft,homeRight,dateLeft:dateHeading?homeRight+gap*.15:null,timeLeft:timeHeading?.bbox.x0||image.width-gap*2.9};
  }
  function photoCrop(image,left,top,right,bottom,scale=4){
    left=Math.max(0,Math.floor(left));top=Math.max(0,Math.floor(top));right=Math.min(image.width,Math.ceil(right));bottom=Math.min(image.height,Math.ceil(bottom));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((right-left)*scale));canvas.height=Math.max(1,Math.round((bottom-top)*scale));
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,left,top,right-left,bottom-top,0,0,canvas.width,canvas.height);return canvas;
  }
  async function readPhoto(worker,image,source,signal){
    await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1',tessedit_char_whitelist:''});
    const scan=await worker.recognize(image,{}, {text:true,blocks:true});
    const layout=photoLayout(scan.data,image);
    if(!layout){
      // Only explicit one-line matchups can be used without spatial evidence.
      const output=parse(scan.data.text,source).filter(r=>/\s(?:@|at|vs\.?|versus)\s/i.test(r.raw)&&(r.home||r.away));
      return {rows:output,text:scan.data.text||'',detected:output.length};
    }
    const selectedWeek=Number($('sfImportWeek').value||0);let week=selectedWeek,weekRead=false;
    const fullWeek=(scan.data.text||'').match(/\bweek\s*(\d{1,2})\b/i);if(fullWeek){week=Number(fullWeek[1]);weekRead=true}
    await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789() &'});
    if(!weekRead){
      const first=layout.rows[0];const header=photoCrop(image,layout.awayLeft,first.y-layout.gap*2.5,layout.separatorX+layout.gap,first.y-layout.gap*1.5,3);
      const result=await worker.recognize(header),match=result.data.text.match(/\b(?:week|wk)\s*(\d{1,2})\b/i);if(match){week=Number(match[1]);weekRead=true}header.width=1;header.height=1;
    }
    const output=[],texts=[];
    for(let i=0;i<layout.rows.length;i++){
      if(signal.aborted)throw signal.reason;
      const row=layout.rows[i];if(activeRead){activeRead.cellIndex=i;activeRead.cellTotal=layout.rows.length}
      progress(`Screenshot ${activeRead?.index+1||1} · Reading game ${i+1} of ${layout.rows.length}`,i/layout.rows.length*100);
      const delta=row.x-layout.separatorX,top=row.y-layout.gap*.34,bottom=row.y+layout.gap*.34;
      const readCell=async(left,right)=>{
        const cell=photoCrop(image,left+delta,top,right+delta,bottom),seen=[];
        const spatial=layout.words.filter(w=>{const b=w.bbox,y=(b.y0+b.y1)/2,x=(b.x0+b.x1)/2;return Math.abs(y-row.y)<layout.gap*.38&&x>left+delta&&x<right+delta}).sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' ');
        await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789() &'});const first=await worker.recognize(cell);seen.push(first.data.text.trim());
        let chosen=cellMatch(seen[0]);const fromSpatial=cellMatch(spatial);
        if(!chosen.team||chosen.suggested){if(fromSpatial.team&&!fromSpatial.suggested)chosen=fromSpatial;else{await worker.setParameters({tessedit_pageseg_mode:'8'});const retry=await worker.recognize(cell);seen.push(retry.data.text.trim());const candidate=cellMatch(seen[1]);if(candidate.team&&(!candidate.suggested||!chosen.team))chosen=candidate;if(!chosen.team&&fromSpatial.team)chosen=fromSpatial}}
        cell.width=1;cell.height=1;return {...chosen,raw:seen.filter(Boolean).join(' / ')||spatial};
      };
      const away=await readCell(layout.awayLeft,layout.awayRight),home=await readCell(layout.homeLeft,layout.homeRight);
      const readExtra=async(left,right,whitelist)=>{await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:whitelist});const spatial=layout.words.filter(w=>w.bbox.x0>=left&&w.bbox.x0<right&&Math.abs((w.bbox.y0+w.bbox.y1)/2-row.y)<layout.gap*.4&&/[0-9]|Sep|Sat|Thu/i.test(w.text));const center=spatial.length?median(spatial.map(w=>(w.bbox.y0+w.bbox.y1)/2)):row.y;const crop=photoCrop(image,left,center-layout.gap*.3,right,center+layout.gap*.3,5);let result=await worker.recognize(crop);let text=result.data.text.trim();const valid=t=>whitelist.includes(':')?!!photoTime(t):!!photoDate(t);if(!valid(text)){await worker.setParameters({tessedit_pageseg_mode:'6'});result=await worker.recognize(crop);if(valid(result.data.text))text=result.data.text.trim();else {await worker.setParameters({tessedit_pageseg_mode:'8'});result=await worker.recognize(crop);if(valid(result.data.text))text=result.data.text.trim()}}if(!valid(text)){const candidate=spatial.sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' ');if(valid(candidate)&&spatial.every(w=>w.confidence>=70))text=candidate}crop.width=1;crop.height=1;return text};
      let date='',time='',dateRaw='',timeRaw='';
      if(layout.dateLeft){dateRaw=await readExtra(layout.dateLeft,Math.min(layout.timeLeft-8,layout.dateLeft+layout.gap*2.15),'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789, ');timeRaw=await readExtra(layout.timeLeft-8,Math.min(image.width,layout.timeLeft+layout.gap*1.9),'0123456789:AMPamp ');date=photoDate(dateRaw);time=photoTime(timeRaw)}
      const ar=rankOf(away.raw),hr=rankOf(home.raw);
      const review=['Check screenshot dates, ET kickoff times, and both ranks against the source row.'];if(layout.dateLeft&&(!date||!time))review.push('Check the date and ET kickoff time; one was unreadable.');if(weekRead&&week!==selectedWeek)review.push(`Screenshot shows Week ${week}, but you selected Week ${selectedWeek}. Confirm the screenshot week.`);if(!weekRead)review.push(`The screenshot week was unreadable; check selected Week ${week}.`);if(away.suggested||home.suggested)review.push('Check the suggested team spelling against the source row.');if(row.kind!=='at'&&row.kind!=='@')review.push('Check home/away order against the source row.');
      const preview=photoCrop(image,layout.awayLeft+delta,top,image.width,bottom,1.5).toDataURL('image/jpeg',.8);
      const raw=`${away.raw||'?'} @ ${home.raw||'?'}`;texts.push(`${week},${away.text||away.raw},${home.text||home.raw}`);
      output.push({week,away:away.team,home:home.team,awayText:away.raw,homeText:home.raw,as:'',hs:'',date,time,ar,hr,raw:raw+' · '+dateRaw+' '+timeRaw,source,preview,uncertain:false,confirmed:false,reviewRequired:review.length>0,reviewReason:review.join(' '),confirmLabel:'I checked teams, date, ET time, and ranks against this source row'});
    }
    if(activeRead){activeRead.cellIndex=null;activeRead.cellTotal=null}
    return {rows:output,text:texts.join('\n'),detected:layout.rows.length,weekRead,week};
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
        if(reading&&activeRead.cellTotal){progress(`Screenshot ${activeRead.index+1} · Reading game ${activeRead.cellIndex+1} of ${activeRead.cellTotal}`,(activeRead.cellIndex+(message.progress||0))/activeRead.cellTotal*100)}else progress(reading?`Reading screenshot ${activeRead.index+1} of ${activeRead.total}`:(labels[message.status]||'Preparing the photo reader'),typeof message.progress==='number'?message.progress*100:null);
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
    let found=0,completed=0,raw=[];const detectedWeeks=new Set();
    try{
      const worker=await bounded(loadOCR(signal),45000,'The photo reader could not start within 45 seconds. Check your connection and retry. No games were published.',signal);
      await bounded(worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'}),10000,'The photo reader could not prepare itself. Retry this screenshot.',signal);
      for(let i=0;i<files.length;i++){
        job.index=i;progress(`Preparing screenshot ${i+1} of ${files.length}`);
        const image=await prepareImage(files[i],signal);
        progress(`Reading screenshot ${i+1} of ${files.length}`,0);
        const result=await bounded(readPhoto(worker,image,files[i].name,signal),60000,`Screenshot ${i+1} took longer than 60 seconds. Try a tighter crop of the game list. Completed draft rows are kept.`,signal);
        image.width=1;image.height=1;
        if(startingContext!==current()||startingMode!==mode()||!allowed())throw Error('League, season, or access changed. Reopen the Import Desk and read the screenshots again.');
        const text=result.text||'';raw.push(`--- ${files[i].name} ---\n${text}`);
        const proposed=result.rows;for(const row of proposed)detectedWeeks.add(row.week);rows.push(...proposed);found+=proposed.length;completed++;
        $('sfImportText').value=raw.join('\n\n');render();
        note(`Read ${completed} of ${files.length} screenshots · ${found} proposed games so far.`);
      }
      progress(`Finished · ${completed} screenshots · ${found} proposed games`,100);
      note(found?`Read ${completed} screenshots and proposed ${found} games · Week ${[...detectedWeeks].sort((a,b)=>a-b).join(', ')}. Compare the draft count with your screenshots, then review teams, home/away and scores.`:'The photo reader finished but found no matchups. Open Text or CSV to inspect the extracted text. Try a clearer crop of the game list.',!found);
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
        const meta=metadata(r,existing),hasScore=r.hs!==''||r.as!=='';
        const schedulePayload={p_week_number:Number(r.week),p_home_team_id:r.home,p_away_team_id:r.away,...meta,p_game_type:existing?.game_type||'regular_season',p_event_name:existing?.event_name||null,p_network:existing?.network||null};
        const call=async(name,body)=>rt.req('/rest/v1/rpc/'+name,{method:'POST',token:rt.session().access_token,body});
        if(!hasScore){
          if(existing)await call('update_schedule_game',{p_game_id:existing.id,...schedulePayload});
          else await call('create_schedule_game',{p_season_id:s.season_id,...schedulePayload});
        }else{
          if(Number(r.week)===0)throw Error('Week 0 final scores must be entered with the individual score editor.');
          if(existing&&metadataChanged(r,existing))await call('update_schedule_game',{p_game_id:existing.id,...schedulePayload});
          const payload={p_week_number:Number(r.week),p_home_team_id:r.home,p_away_team_id:r.away,p_home_score:Number(r.hs),p_away_score:Number(r.as),p_home_rank:meta.p_home_rank,p_away_rank:meta.p_away_rank,p_overtime:existing?.overtime||false,p_game_type:existing?.game_type||'regular_season',p_result_method:existing?.result_method||'played'};
          if(existing)await rt.Data.editGameV2({p_game_id:existing.id,...payload});
          else {const gameId=await call('create_schedule_game',{p_season_id:s.season_id,...schedulePayload});await rt.Data.editGameV2({p_game_id:gameId,...payload})}
        }
        saved++;r.state='published';r.published=true;
      }
      rows=rows.filter(r=>!r.published);await rt.loadSeason(s.season_id);note(`Published ${saved} games to ${rt.getDynasty()?.name||'this league'} · Season ${s.season_number}.`);
    }catch(e){await rt.loadSeason(s.season_id).catch(()=>{});note(`Published ${saved} of ${pending.length}. Stopped: ${e.message||e}. Remaining rows are still drafts.`,true)}finally{liveGames=null;busy=false;render()}
  }
  async function open(){
    if(busy||!allowed())return;
    const card=$('sfImportDesk');card.classList.remove('hidden');context=current();rows=[];teams=[];liveGames=null;
    $('sfImportLeague').textContent=`${rt.getDynasty()?.name||'Current league'} · Season ${rt.getSeason()?.season_number||''}`;
    $('sfImportYear').value=rt.getSeason()?.year||'';
    $('sfImportWeek').value=rt.getSelectedWeek()??rt.currentWeek()??0;
    note('Loading team names for this season…');render();
    try{teams=await rt.Data.scheduleTeams(rt.getSeason().season_id);if(context!==current())return;note(`Ready. ${teams.length} teams available. Screenshots are read in your browser; review each proposed row.`);render()}
    catch(e){note(`Could not load season teams: ${e.message}`,true)}
    card.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function installBuildMarker(){
    // Replace the legacy observer target so this QA build has one version authority.
    const old=$('sfBuildMarker');if(!old)return;
    const marker=old.cloneNode(true);old.replaceWith(marker);
    const mark=()=>{if(marker.textContent!=='QA 9.8.61')marker.textContent='QA 9.8.61';const more=$('sfMoreBuildVersion');if(more)more.textContent='QA 9.8.61'};
    mark();new MutationObserver(mark).observe(marker,{childList:true,characterData:true,subtree:true});
    window.addEventListener('pageshow',mark);
  }
  function boot(){
    const admin=$('admin');if(!admin||$('sfImportDesk'))return;
    const button=document.createElement('button');button.type='button';button.id='sfImportOpen';button.className='btn primary';button.textContent='Import Schedule & Results';
    const entry=document.createElement('section');entry.id='sfImportEntry';entry.className='admin-card sf-import-entry';
    entry.innerHTML='<div><div class="kicker">SCHEDULE & RESULTS</div><h3>Game Imports</h3><p>Bring your screenshots into a draft, review the games, then publish to the selected league and season.</p></div>';
    entry.appendChild(button);const grid=admin.querySelector('.admin-grid');grid?grid.before(entry):admin.prepend(entry);
    const card=document.createElement('section');card.id='sfImportDesk';card.className='hidden';card.setAttribute('aria-labelledby','sfImportTitle');card.innerHTML=`<div class="kicker">COMMISSIONER · IMPORT DESK · QA 9.8.61</div><h3 id="sfImportTitle">Schedule & Results</h3><ol class="sf-import-steps" aria-label="Import steps"><li>1 · Upload</li><li>2 · Review</li><li>3 · Publish</li></ol><p id="sfImportLeague"></p><p>Upload screenshots or paste one game per line. Review matchups, dates, ET kickoff times, and ranks before publishing. Blank metadata preserves existing values. Dates use the season year below.</p><div class="sf-import-grid"><label>Import type<select id="sfImportMode"><option value="schedule">Season schedule</option><option value="results">Weekly results</option></select></label><label>Default week<input id="sfImportWeek" type="number" min="0" value="0"></label><label>Season year<input id="sfImportYear" type="number" min="1900" max="2200" placeholder="Year shown in game"></label><label>Screenshots (up to 12)<input id="sfImportImages" type="file" accept="image/*" multiple></label></div><div class="sf-import-actions"><button id="sfImportRead" type="button">Read Screenshots</button><button id="sfImportClose" class="secondary" type="button">Close</button></div><div id="sfImportProgress" class="sf-import-progress hidden" role="status" aria-live="polite"><div class="sf-import-progress-top"><span class="sf-import-spinner" aria-hidden="true"></span><strong id="sfImportProgressTitle">Starting the photo reader</strong><span id="sfImportProgressPercent">Working…</span></div><progress id="sfImportProgressBar" max="100" aria-label="Screenshot reading progress"></progress><div class="sf-import-progress-bottom"><small id="sfImportElapsed">0s elapsed</small><button id="sfImportCancel" class="secondary hidden" type="button">Cancel Reading</button></div></div><details class="sf-import-text-details"><summary>Text or CSV · alternate input & extracted text</summary><label class="sf-import-raw">Text or CSV <small>Format: Away @ Home, or week,away,home,away score,home score[, YYYY-MM-DD, HH:MM (ET), away rank, home rank]. OCR text appears here for editing.</small><textarea id="sfImportText" placeholder="0,Georgia State,Tennessee\n1,Notre Dame,Ohio State,17,24"></textarea></label><div class="sf-import-actions"><button id="sfImportAdd" class="secondary" type="button">Add Rows From Text</button><button id="sfImportClear" class="secondary" type="button">Clear Draft</button></div></details><div id="sfImportNote" class="sf-import-note" role="status"></div><div id="sfImportRows" class="sf-import-rows"></div><div class="sf-import-foot"><strong id="sfImportCount">0 draft</strong><div class="sf-import-actions"><button id="sfImportPublish" type="button" disabled>Publish Reviewed Games</button></div><small>Existing final scores are never overwritten by a batch. Correct those games individually using the audited game editor.</small></div>`;
    entry.after(card);
    $('sfImportCancel').onclick=cancelRead;
    button.onclick=open;$('sfImportClose').onclick=()=>card.classList.add('hidden');$('sfImportAdd').onclick=addText;$('sfImportRead').onclick=readImages;$('sfImportPublish').onclick=publish;
    $('sfImportClear').onclick=()=>{rows=[];render();note('Draft cleared.')};$('sfImportMode').onchange=render;
    $('sfImportRows').addEventListener('change',e=>{const el=e.target.closest('[data-field]'),parent=e.target.closest('[data-row]');if(!el||!parent)return;rows[Number(parent.dataset.row)][el.dataset.field]=el.type==='checkbox'?el.checked:el.value;render()});
    $('sfImportRows').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;rows.splice(Number(b.dataset.remove),1);render()});
    const observer=new MutationObserver(()=>{const visible=allowed();entry.classList.toggle('hidden',!visible);if(!visible){cancelRead();card.classList.add('hidden');}if(!card.classList.contains('hidden')&&current()!==context){cancelRead();rows=[];card.classList.add('hidden')}});
    observer.observe(admin,{attributes:true,attributeFilter:['class']});
    entry.classList.toggle('hidden',!allowed());
    const priorKickoff=window.gdKickoffLabel;window.gdKickoffLabel=g=>g?.kickoff_time?new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(g.kickoff_time))+' ET':priorKickoff?priorKickoff(g):'';
    installBuildMarker();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
