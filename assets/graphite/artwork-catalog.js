/* Shared, read-only artwork metadata. New team art needs no frontend deployment. */
let teamArtwork={rows:[],loaded:false,checkedAt:0},teamArtworkRequest=null;
function validArtworkUrl(value){try{const u=new window.URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2048?u.href:null}catch{return null}}
function teamArtworkEntry(teamId){return teamArtwork.rows.find(a=>a.team_id===teamId)||null}
function teamArtworkColor(teamId,fallback='#303840'){const color=teamArtworkEntry(teamId)?.accent_color;return /^#[0-9a-f]{6}$/i.test(color||'')?color:fallback}
async function loadTeamArtwork(force=false){
 const token=session()?.access_token;if(!token)return;
 if(!force&&teamArtwork.loaded&&Date.now()-teamArtwork.checkedAt<60000)return;
 if(teamArtworkRequest?.token===token)return teamArtworkRequest.promise;
 const request={token,promise:null};teamArtworkRequest=request;
 request.promise=(async()=>{try{
  const rows=await read('team_artwork_catalog','published=eq.true&order=team_id.asc','team_id,image_url,alt_text,accent_color,updated_at');
  if(session()?.access_token!==token||teamArtworkRequest!==request)return;
  teamArtwork={rows:rows.filter(r=>uid(r.team_id)&&validArtworkUrl(r.image_url)).map(r=>({...r,image_url:validArtworkUrl(r.image_url)})),loaded:true,checkedAt:Date.now()};
  refreshReportMarkup();
 }catch{/* Artwork is optional. Preserve known artwork or use official team marks. */}
 finally{if(teamArtworkRequest===request)teamArtworkRequest=null}})();
 return request.promise;
}
function reportArtworkFailed(img){img.onerror=null;const host=img.closest('.report-art');host?.classList.add('report-art-mark');const credit=host?.querySelector('.art-credit');if(credit)credit.textContent='TEAM SPOTLIGHT';img.remove()}
