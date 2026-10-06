/* Career-aware fictional editorial. Pure, deterministic and scoped to one league. */
(function(root){
 'use strict';
 const same=(a,b)=>String(a)===String(b);
 const number=x=>Number(x)||0;
 const record=games=>({wins:games.filter(g=>g.result==='W').length,losses:games.filter(g=>g.result==='L').length});
 const fmt=r=>`${r.wins}-${r.losses}`;
 const completed=g=>g.status==='completed'&&['W','L'].includes(g.result);
 const order=(a,b)=>number(a.season_number)-number(b.season_number)||number(a.week_number)-number(b.week_number)||String(a.id).localeCompare(String(b.id));
 const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 function context(input,coach,sn){
  const all=input.games.filter(g=>same(g.person_id,coach.person_id)).sort(order);
  const stops=(input.stops||[]).filter(s=>same(s.person_id,coach.person_id)&&number(s.season_number)<=sn);
  const season=all.filter(g=>number(g.season_number)===sn),games=season.filter(completed);
  const stop=stops.find(s=>number(s.season_number)===sn);
  const team=season.at(-1)?.team_name||stop?.team_name||coach.team_name;
  const previousNumbers=[...new Set([...all,...stops].map(s=>number(s.season_number)).filter(n=>n>0&&n<sn))].sort((a,b)=>b-a);
  const prevNo=previousNumbers[0],prevGames=all.filter(g=>number(g.season_number)===prevNo&&completed(g));
  const prevStop=stops.find(s=>number(s.season_number)===prevNo);
  const previous=prevNo?{season:prevNo,team:prevStop?.team_name||prevGames.at(-1)?.team_name,record:prevStop&&prevStop.wins!=null&&prevStop.losses!=null?{wins:number(prevStop.wins),losses:number(prevStop.losses)}:record(prevGames)}:null;
  const move=(input.moves||[]).find(m=>same(m.person_id,coach.person_id)&&number(m.season_number)===sn);
  const from=move?.from_team_name||(previous?.team&&previous.team!==team?previous.team:null);
  const bySeason=new Map();for(const s of [...all,...stops])if(number(s.season_number)>0&&number(s.season_number)<=sn&&s.team_name)bySeason.set(number(s.season_number),s.team_name);
  let tenure=1;for(const n of [...bySeason.keys()].filter(n=>n<sn).sort((a,b)=>b-a)){if(bySeason.get(n)!==team)break;tenure++;}
  if(move?.from_team_name&&move.from_team_name!==team)tenure=1;
  return {all,season,games,team,previous,from,tenure,record:record(games)};
 }
 function build(input){
  const sn=number(input.season),league=String(input.dynasty||''),edition=String(input.edition||'');
  // Never use another league/edition's rows as the preceding season.
  input={...input,games:(input.games||[]).filter(g=>(!g.dynasty_id||same(g.dynasty_id,league))&&(!g.game_edition||same(g.game_edition,edition))),stops:(input.stops||[]).filter(s=>!s.dynasty_id||same(s.dynasty_id,league)),moves:(input.moves||[]).filter(s=>!s.dynasty_id||same(s.dynasty_id,league))};
  const chapters=[],profiles=[];
  for(const coach of input.coaches||[]){
   const c=context(input,coach,sn),name=coach.coach_name||'Unknown',base=`${league}|${edition}|${coach.person_id}|${sn}`;
   profiles.push({coach,...c});
   const used=new Set();
   // Rotate adjacent years through different scene openings without random refreshes.
   const scenePick=(items,kind)=>items[(hash(`${coach.person_id}|${kind}`)+sn)%items.length];
   const add=(kind,g,title,fact,scene,importance=0,link='legacy')=>{
    const id=`${base}|${kind}|${g?.id||'opening'}`;
    const label=g?`Week ${g.week_number}`:'Season opening';
    const formats=['DOCUMENTARY','LOCAL COLUMN','BEHIND THE HEADSET'];
    chapters.push({id,kind,coach,team:g?.team_name||c.team,season:sn,week:g?number(g.week_number):-1,game:g,headline:title,fact,scene,importance,link,format:formats[(hash(base)+chapters.filter(x=>same(x.coach.person_id,coach.person_id)).length)%formats.length],label,record:g?record(c.games.filter(x=>order(x,g)<=0)):c.record});
   };
   const priorText=c.previous?`Season ${c.previous.season}: ${fmt(c.previous.record)} at ${c.previous.team||'the previous program'}. `:'';
   const pastYears=new Set(c.all.filter(g=>number(g.season_number)<sn&&g.team_name===c.from).map(g=>number(g.season_number)));
   if(c.from){
    add('move',null,`${name}: ${c.from} to ${c.team}`,`${name} moved from ${c.from} to ${c.team}. ${priorText}`,
     `${scenePick(['The old office was somebody else’s now.','There was a new crest on the jacket, and a familiar weight behind it.','The first thing that changed was the view from the office.'],'move')} ${pastYears.size?`${pastYears.size} recorded season${pastYears.size===1?'':'s'} at ${c.from} had given ${name} a history. `:''}At ${c.team}, history bought attention; the next chapter would have to earn belief.`,80);
   }else{
    const last=c.previous?.record;
    const title=last?(last.wins>=10?`Year ${c.tenure}: defending a ${fmt(last)} standard`:last.wins<last.losses?`Year ${c.tenure}: what survives ${fmt(last)}`:`Year ${c.tenure}: beyond ${fmt(last)}`):'Before the first answer';
    add('opening',null,`${name}: ${title.toLowerCase()}`,`${priorText}Year ${c.tenure} at ${c.team}.`,
     last?`${last.wins>=10?'The trophy cabinet was easier to look at than the blank schedule.':last.wins<last.losses?'In the imagined quiet of the film room, last season was still taking up a chair.':'The imagined offseason meeting began with an empty whiteboard.'} ${name} had already shown what one version of ${c.team} could be. Season ${sn} would ask whether that was a foundation, a ceiling, or something left behind.`:`In this fictional opening scene, ${name} leaves the schedule pinned to the wall. No speeches yet. At ${c.team}, the first result will give the room something real to talk about.`,0);
   }
   for(let i=0;i<c.games.length;i++){
    const g=c.games[i],before=c.games.slice(0,i),through=c.games.slice(0,i+1),r=record(through),old=record(before),win=g.result==='W';
    const score=g.points_for!=null&&g.points_against!=null?`${g.points_for}-${g.points_against}`:'final score not recorded',opp=g.opponent_team||'the opponent';
    const fact=`${name} · ${g.team_name||c.team} ${win?'beat':'lost to'} ${g.opponent_rank?`#${g.opponent_rank} `:''}${opp}, ${score}. Season record: ${fmt(r)}.`;
    // Opponent identity follows a person through school changes when available.
    const opponentId=g.opponent_person_id||input.games.find(x=>same(x.id,g.id)&&!same(x.person_id,g.person_id))?.person_id;
    const meetings=c.all.filter(x=>completed(x)&&order(x,g)<0&&(opponentId?same(x.opponent_person_id||input.games.find(y=>same(y.id,x.id)&&!same(y.person_id,x.person_id))?.person_id,opponentId):x.opponent_team===opp));
    const defeats=meetings.filter(x=>x.result==='L').length;
    let kind,title,scene,importance=0,link='legacy';
    if(['national_championship','conference_championship','bowl','playoff'].includes(g.game_type)){
     kind=`postseason-${g.game_type}-${win?'win':'loss'}`;link='hardware';importance=win&&g.game_type==='national_championship'?100:win?85:70;
     title=win?`${name}: ${g.event_name||g.game_type.replace(/_/g,' ')} earned`:`${name}: the ending they have to carry`;
     scene=win?`${scenePick(['The imagined final interview starts late. Nobody is in a hurry to leave.','In the fictional locker-room scene, the noise finally gives way to a long silence.','A fictional columnist puts the season notes away and starts a fresh page.'],kind)} ${c.from?`The move from ${c.from} now has a result attached to its promise.`:c.previous?`Last season’s ${fmt(c.previous.record)} is now a point of comparison, rather than the final word.`:'The program has an ending worth keeping.'}`:`In the imagined journey home, ${name} keeps the conversation short. ${c.previous?`A year after ${fmt(c.previous.record)}, this season has supplied its own ending.`:'The season is over; the meaning will take longer to settle.'} The next chapter starts with what they choose to carry forward.`;
    }else if(win&&defeats&&meetings.at(-1)?.result==='L'&&!used.has(`revenge-${opponentId||opp}`)){
     kind=`revenge-${opponentId||opp}`;title=`${name}: an old argument, a new answer`;importance=75;link='rivalries';
     scene=`The fictional press room waits for a grand statement. ${name} offers only a small nod. ${defeats} earlier defeat${defeats===1?'':'s'} in this matchup had made the question familiar. This time, the answer is different${c.from?`, even with ${name} wearing ${c.team} colors`:''}.`;
    }else if(!win&&old.losses===0&&old.wins>=4){
     kind='first-loss';title=`${name}: perfection leaves the room`;importance=70;
     scene=`In the imagined Monday meeting, nobody mentions the unbeaten record. It no longer exists. ${old.wins} wins had turned possibility into expectation; ${opp} has changed the assignment. ${name} now has to discover which parts of that confidence survive a loss.`;
    }else if(win&&number(g.opponent_rank)>0&&number(g.opponent_rank)<=10){
     kind='ranked';title=`${name}: ${opp} becomes part of the résumé`;importance=65;link='records';
     scene=`${scenePick(['A fictional local column tears up its cautious opening paragraph.','In an imagined radio studio, the producer crosses out the first question.','The fictional documentary cuts from the score to the empty practice field.'],'ranked')} ${c.from?`The argument about whether ${name} could win away from ${c.from} now has another piece of evidence.`:c.previous?`For a program coming off ${fmt(c.previous.record)}, this result gives the year a different reference point.`:`${name} has given ${c.team} a result that will follow them into the next matchup.`}`;
    }else if(win&&c.previous&&r.wins>c.previous.record.wins&&old.wins<=c.previous.record.wins){
     kind='progress';title=`${name}: beyond last year’s ceiling`;importance=60;link='records';
     scene=`In the fictional office scene, last year’s record gets moved from the center of the board to the corner. ${c.previous.record.wins} wins used to be the comparison. ${r.wins} have made it a starting point. ${c.from?`At a different program, ${name} is learning which parts of the old blueprint still work.`:`Year ${c.tenure} at ${c.team} is giving the project a new shape.`}`;
    }else if(i===0){
     kind='first-answer';title=c.from?`${name}: the new job meets Saturday`:`${name}: the first answer arrives`;
     scene=`${scenePick(['In the fictional corridor outside the press room, the opening-week speeches already feel distant.','The imagined film-room scene begins with the final score still on the screen.','A fictional beat writer closes the preseason notebook and opens another.'],'first-answer')} ${c.from?`The first recorded result at ${c.team} begins to test the promise of leaving ${c.from}.`:c.previous?`After ${fmt(c.previous.record)} last season, ${name} has the first piece of this year’s answer.`:`${name} has a real result to build the next week around.`}`;
    }else if(!win&&i>=2&&before.slice(-2).every(x=>x.result==='L')&&!used.has('crossroads')){
     kind='crossroads';title=`${name}: the room gets quieter`;importance=45;
     scene=`The fictional staff meeting ends without a rallying cry. Three consecutive losses have made the small questions feel larger. ${c.from?`The new job at ${c.team} is testing what ${name} learned at ${c.from}.`:`In year ${c.tenure}, ${name} has to decide what to change and what still deserves trust.`}`;
    }else continue;
    // One development per theme per season; routine games become the factual season montage.
    if(used.has(kind))continue;used.add(kind);add(kind,g,title,fact,scene,importance,link);
   }
  }
  return {chapters:chapters.sort((a,b)=>b.week-a.week||b.importance-a.importance||String(a.coach.coach_name).localeCompare(String(b.coach.coach_name))),profiles};
 }
 const api={build,context,record};if(typeof module==='object'&&module.exports)module.exports=api;else root.SFChronicleEngine=api;
})(typeof window!=='undefined'?window:globalThis);
