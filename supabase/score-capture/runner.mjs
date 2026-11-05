import {matchFinal,twitchSnapshot,youtubeSnapshot,canProposePreview,readScore} from './detector.mjs';
export async function runCapture({rest,key,enabled,channels,now=Date.now(),fetcher=fetch,vision=readScore}){
 if(!enabled)return {state:'disabled'};
 if(!key)return {state:'needs_api_key'};
 const json=async path=>{const r=await rest(path);if(!r.ok)throw Error('Capture data HTTP '+r.status);return r.json()};
 const live=await json('coach_live_status?select=person_id,is_live,live_url,last_url,started_at,last_started_at,last_ended_at&or=(is_live.eq.true,last_ended_at.gte.'+new Date(now-300000).toISOString()+')');
 const seasons=await json('v_dynasty_seasons?is_active=eq.true&select=season_id,dynasty_id');
 const settings=await json('dynasty_settings?select=dynasty_id,settings');
 const current=new Map(seasons.map(s=>[s.season_id,s.dynasty_id]));
 const weeks=new Map(settings.map(s=>[s.dynasty_id,s.settings?.active_week]));
 const unique=new Map();
 for(const c of channels){
  const platform=String(c.platform).toLowerCase();
  const l=live.find(l=>l.person_id===c.person_id);
  if(!l)continue;
  const streamUrl=l.is_live?l.live_url:l.last_url;
  const snapshot=platform==='twitch'?twitchSnapshot(c.stream_url):platform==='youtube'?youtubeSnapshot(streamUrl):null;
  if(snapshot)unique.set(c.person_id,{...c,platform,stream_url:streamUrl||c.stream_url,snapshot});
 }
 const results=[];
 // At most 4 coaches per run, 96 attempted scans per coach/day, one per five-minute bucket.
 for(const [person,c] of [...unique].slice(0,4)){
  try{
   const day=await json('stream_score_scan_claims?select=bucket&person_id=eq.'+person+'&bucket=gte.'+(Math.floor(now/86400000)*288)+'&limit=96');
   if(day.length>=96){results.push({person_id:person,state:'daily_limit'});continue}
   const bucket=Math.floor(now/300000);
   const claim=await rest('stream_score_scan_claims',{method:'POST',body:JSON.stringify({person_id:person,bucket})});
   if(claim.status===409){results.push({person_id:person,state:'already_checked'});continue}if(!claim.ok)throw Error('Claim failed');
   const rows=(await json('v_schedule_entries?or=(person_id.eq.'+person+',opponent_person_id.eq.'+person+')&status=neq.completed&is_bye=eq.false')).filter(g=>current.has(g.season_id)&&weeks.get(g.dynasty_id)!=null&&Number(g.week_number)===Number(weeks.get(g.dynasty_id))&&g.status!=='cancelled');
   if(!rows.length){results.push({person_id:person,state:'no_current_matchup'});continue}
   const r=await fetcher(c.snapshot,{signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!r.ok||!r.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('Snapshot unavailable');
   if(Number(r.headers.get('content-length')||0)>1000000)throw Error('Snapshot too large');
   const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>1000000)throw Error('Snapshot too large');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const seen=await json('stream_score_scan_claims?select=bucket&person_id=eq.'+person+'&frame_hash=eq.'+hash+'&limit=1');
   if(seen.length){results.push({person_id:person,state:'unchanged_snapshot'});continue}
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   const image='data:image/jpeg;base64,'+btoa(binary);
   const found=await vision({image,teams:rows.flatMap(g=>[g.team_name,g.opponent_team]),key,fetcher});
   const prior=await json('stream_score_scan_claims?select=state,stream_url,frame_hash&person_id=eq.'+person+'&bucket=gte.'+(bucket-288));
   const proposal=canProposePreview(c.platform,prior,c.stream_url,hash)?matchFinal(found,rows):null;
   if(proposal){
    const saved=await rest('stream_score_candidates?on_conflict=game_id,home_score,away_score',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({...proposal,person_id:person,stream_url:c.stream_url,image_data:image,frame_hash:hash})});
    if(!saved.ok)throw Error('Proposal save failed');
   }
   await rest('stream_score_scan_claims?person_id=eq.'+person+'&bucket=eq.'+bucket,{method:'PATCH',body:JSON.stringify({frame_hash:hash,stream_url:c.stream_url,state:proposal?'proposed':found.status==='in_progress'?'in_progress':'no_final'})});
   results.push({person_id:person,state:proposal?'proposed':'no_final'});
  }catch(e){results.push({person_id:person,state:'error',message:String(e.message).slice(0,120)})}
 }
 // Retain rate-limit/dedup records for two days; evidence remains with proposals.
 await rest('stream_score_scan_claims?bucket=lt.'+(Math.floor(now/300000)-576),{method:'DELETE'});
 return {state:'pilot',results};
}
