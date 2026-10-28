// Reused unchanged from main 9.10.16: national ledger and American tiebreaks.
function conferenceModel(data){
const rt={getState:()=>data};
  const norm=x=>String(x||'').trim();
  const canon=x=>norm(x).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const getState=()=>rt.getState?.()||{};
  const dynastyTeams=()=>{const st=getState();return new Set((st.programs||[]).flatMap(p=>[String(p.team_id||''),canon(p.team_name)]).filter(Boolean));};
  const dynastyConfs=()=>{const st=getState();return new Set((st.programs||[]).map(p=>norm(p.conference||p.team_conference)).filter(Boolean));};

  // EA/real-world Sun Belt alignment used by this dynasty season. The conference
  // championship is East champion vs West champion, so Sun Belt cannot be ranked
  // as a single 14-team table for championship qualification.
  const SUN_BELT_DIVISIONS={
    East:new Set(['appalachian state','app state','coastal carolina','georgia southern','georgia state','james madison','marshall','old dominion']),
    West:new Set(['arkansas state','louisiana','louisiana lafayette','south alabama','southern mississippi','southern miss','texas state','troy','ul monroe','ulm','louisiana monroe'])
  };
  function isSunBelt(conf){const c=canon(conf);return c==='sun belt'||c==='sun belt conference';}
  function isAmerican(conf){return ['american','american conference','american athletic','american athletic conference'].includes(canon(conf));}
  function sunBeltDivision(name){const n=canon(name);for(const [division,names] of Object.entries(SUN_BELT_DIVISIONS)){if(names.has(n))return division;}return null;}

  function uniqueGames(){
    const st=getState(),m=new Map();
    // Conference Race needs the national schedule ledger, not only user-controlled
    // game entries. New dynasties can have complete CPU results in scheduleGames
    // while state.games contains only the Foundry coaches, which made CPU teams
    // incorrectly display 0-0 overall records.
    const source=(Array.isArray(st.scheduleGames)&&st.scheduleGames.length)?st.scheduleGames:(st.games||[]);
    for(const g of source){
      if(!g||g.is_bye)continue;
      const k=String(g.id||`${g.week_number}|${g.team_name}|${g.opponent_team}`);
      if(!m.has(k))m.set(k,g);
    }
    return [...m.values()];
  }
  function teamKey(id,name){return id?`id:${id}`:`name:${canon(name)}`;}
  function logo(id,name){
    const st=getState();
    const p=(st.programs||[]).find(x=>String(x.team_id||'')===String(id||'')||canon(x.team_name)===canon(name));
    return p?.logo_url||p?.team_logo_url||window.CDHQLogoResolver?.knownLogo?.(name)||'';
  }
  function build(){
    const st=getState(),teams=new Map(),games=uniqueGames(),dyn=dynastyTeams();
    const ensure=(id,name,conf)=>{
      const key=teamKey(id,name);
      if(!teams.has(key))teams.set(key,{key,id,name:norm(name)||'Unknown',conf:norm(conf),cw:0,cl:0,w:0,l:0,pf:0,pa:0,pdOverride:null,rem:0,headToHead:new Map(),dynasty:dyn.has(String(id||''))||dyn.has(canon(name))});
      const t=teams.get(key);if(!t.conf&&conf)t.conf=norm(conf);return t;
    };
    for(const g of games){
      const a=ensure(g.team_id,g.team_name,g.team_conference),b=ensure(g.opponent_team_id,g.opponent_team,g.opponent_conference);
      const type=String(g.game_type||'regular_season').toLowerCase();
      const confGame=['regular_season','conference'].includes(type)&&(!!g.is_conference_game||type==='conference'||(a.conf&&b.conf&&canon(a.conf)===canon(b.conf)));
      // Imported/sim rows are CPU context. If a dynasty-controlled program appears in one,
      // do not let that row create a second result on top of the coach's authoritative HQ game.
      // This keeps Conference Race aligned with the Overview standings ledger.
      const importedDynastyDuplicate=String(g.result_method||'').toLowerCase()==='sim'&&(a.dynasty||b.dynasty);
      if(g.status==='completed'&&g.points_for!=null&&g.points_against!=null&&!importedDynastyDuplicate){
        const pf=Number(g.points_for),pa=Number(g.points_against);
        if(Number.isFinite(pf)&&Number.isFinite(pa)&&pf!==pa){
          a.pf+=pf;a.pa+=pa;b.pf+=pa;b.pa+=pf;
          if(pf>pa){a.w++;b.l++;if(confGame){a.cw++;b.cl++;}}else{a.l++;b.w++;if(confGame){a.cl++;b.cw++;}}
          if(confGame){
            for(const [team,opponent,won] of [[a,b,pf>pa],[b,a,pa>pf]]){
              const record=team.headToHead.get(opponent.key)||{w:0,l:0};
              record[won?'w':'l']++;team.headToHead.set(opponent.key,record);
            }
          }
        }
      }else if(g.status==='scheduled'&&confGame){a.rem++;b.rem++;}
    }
    // For dynasty-controlled teams, the main Overview standings are the authoritative
    // overall record. Conference Race may enrich that record with CPU context, but it must
    // never disagree with the coach card on W-L or point differential.
    for(const t of teams.values()){
      if(!t.dynasty)continue;
      const auth=(st.standings||[]).find(r=>String(r.team_id||'')===String(t.id||'')||canon(r.team_name)===canon(t.name));
      if(auth){
        const w=Number(auth.wins),l=Number(auth.losses),pd=Number(auth.point_differential);
        if(Number.isFinite(w))t.w=w;
        if(Number.isFinite(l))t.l=l;
        if(Number.isFinite(pd))t.pdOverride=pd;
      }
    }
    return [...teams.values()].filter(t=>t.conf);
  }
  function sortRows(a,b){
    const ap=(a.cw+a.cl)?a.cw/(a.cw+a.cl):0,bp=(b.cw+b.cl)?b.cw/(b.cw+b.cl):0;
    return bp-ap||b.cw-a.cw||a.cl-b.cl||b.w-a.w||(b.pf-b.pa)-(a.pf-a.pa);
  }
  // American rules 10.3 and 10.5-10.6: percentage first, then head-to-head.
  // Resolve whole tied groups; a pairwise comparator can cycle in a three-way tie.
  // Missing CFP/computer inputs leave a tie unresolved, never skip to overall W-L.
  function americanRows(teams){
    const pct=t=>t.cw+t.cl?t.cw/(t.cw+t.cl):-1;
    const byName=(a,b)=>a.name.localeCompare(b.name)||a.key.localeCompare(b.key);
    function resolve(group){
      if(group.length<2)return [group];
      const records=group.map(team=>{
        const opponents=group.filter(other=>other!==team).map(other=>team.headToHead.get(other.key));
        return {team,complete:opponents.every(r=>r&&r.w+r.l>0),sweep:opponents.every(r=>r&&r.w>0&&r.l===0),w:opponents.reduce((n,r)=>n+(r?.w||0),0),l:opponents.reduce((n,r)=>n+(r?.l||0),0)};
      });
      let top=[];
      if(records.every(r=>r.complete)){
        const best=Math.max(...records.map(r=>r.w/(r.w+r.l)));
        top=records.filter(r=>r.w/(r.w+r.l)===best).map(r=>r.team);
      }else top=records.filter(r=>r.sweep).map(r=>r.team);
      if(!top.length||top.length===group.length)return [[...group].sort(byName)];
      return [...resolve(top),...resolve(group.filter(t=>!top.includes(t)))];
    }
    const groups=[];
    for(const team of [...teams].sort((a,b)=>pct(b)-pct(a)||byName(a,b))){
      const last=groups[groups.length-1];
      if(last&&pct(last[0])===pct(team))last.push(team);else groups.push([team]);
    }
    const rows=[];
    for(const group of groups.flatMap(resolve)){
      const rank=rows.length+1,played=pct(group[0])>=0;
      group.forEach(t=>rows.push({...t,raceRank:rank,raceTied:group.length>1,racePlayed:played,raceQualifier:played&&rank+group.length-1<=2}));
    }
    return rows;
  }

return {teams:build(), americanRows,isAmerican,isSunBelt,sunBeltDivision,sortRows};
}
