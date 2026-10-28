// Existing app session and refresh flow, with a preview write guard.
const URL="https://byenidxnyuqzrcrbwihm.supabase.co";
const KEY="sb_publishable_TlJTktsyhLGDZ43NmOViDA_ueesX7QI";
const STORE="cdhq_supabase_session_v1";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const signed=n=>`${Number(n||0)>0?"+":""}${Number(n||0)}`;
const initials=n=>String(n||"TBD").split(/\s+/).map(x=>x[0]).join("").slice(0,3).toUpperCase();
function msg(el,t,type=""){el.textContent=t;el.className=`notice ${type}`;el.classList.remove("hidden")}function hide(el){el.classList.add("hidden")}
function session(){try{return JSON.parse(localStorage.getItem(STORE)||"null")}catch{return null}}function save(s){s?.access_token?localStorage.setItem(STORE,JSON.stringify(s)):localStorage.removeItem(STORE)}
let authRefreshPromise=null,authResumePromise=null;
function isFutureJwtError(error){return /(?:jwt|token).*(?:issued at future|not yet valid|used before issued)/i.test(String(error?.message||error||''));}
function expiredSessionError(){const error=Error('Your Saturday Foundry session expired. Please sign in again.');error.sessionExpired=true;return error;}
function rejectedRefresh(error){
 return [400,401,403].includes(error?.status)&&(['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_not_found','user_banned'].includes(error?.code)||/invalid refresh token|refresh token.*(?:not found|already used|expired|revoked)|session.*(?:expired|not found|revoked)/i.test(error?.message||''));
}
function jwtExpMs(token){
 try{const p=JSON.parse(atob(String(token||"").split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));return Number(p?.exp||0)*1000}catch{return 0}
}
async function refreshAuthSingleFlight(){
 if(authRefreshPromise)return authRefreshPromise;
 authRefreshPromise=Promise.resolve().then(async()=>{
   const before=session();
   try{
     if(!before?.refresh_token)throw expiredSessionError();
     const fresh=await req('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:before.refresh_token},timeoutMs:12000,retry:1,authRetry:false});
     if(!fresh?.access_token)throw Error('Session refresh failed');
     const merged={...before,...fresh,user:fresh.user||before.user};
     const current=session();
     // A logout or a different sign-in while the refresh was in flight wins.
     if(!current?.access_token)throw expiredSessionError();
     if(current.refresh_token!==before.refresh_token)return current;
     save(merged);
     return merged;
   }catch(err){
     // Do not erase a newer session written by another successful refresh/sign-in.
     const now=session();
     const rejected=rejectedRefresh(err);
     if(rejected&&(!now?.access_token || now.refresh_token===before.refresh_token))save(null);
     if(!rejected)throw err;
     if(now?.access_token&&now.refresh_token!==before.refresh_token)return now;
     throw expiredSessionError();
   }finally{authRefreshPromise=null}
 });
 return authRefreshPromise;
}
async function req(path,{method="GET",body,token,timeoutMs=15000,retry=0,authRetry=true,clockRetry=0}={}){
 if(path.startsWith('/rest/v1/') && method!=='GET' && !ALLOWED_RPC.has(path.slice('/rest/v1/rpc/'.length).split('?')[0]))throw Error('Unsupported league action.');
 if(method!=='GET' && WRITE_RPC.has(path.slice('/rest/v1/rpc/'.length).split('?')[0]))retry=0;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),Math.max(3000,Number(timeoutMs)||15000));
 try{
   const r=await fetch(URL+path,{method,headers:{"apikey":KEY,"Content-Type":"application/json",...(token?{"Authorization":`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,cache:"no-store"});
   const tx=await r.text();let d=null;try{d=tx?JSON.parse(tx):null}catch{d=tx}
   if(!r.ok){
     const errText=String(d?.message||d?.msg||d?.error_description||d?.error||`Request failed (${r.status})`);
     const failure=Error(errText);failure.status=r.status;failure.code=d?.code||d?.error_code;
     // This rejection happens before the request runs. Reuse the same token;
     // minting a newer JWT can extend the server's clock mismatch.
     if(r.status===401&&isFutureJwtError(failure)&&!path.includes('/token')){
       if(clockRetry<4){clearTimeout(timer);await new Promise(resolve=>setTimeout(resolve,[500,1000,2000,4000][clockRetry]));return req(path,{method,body,token,timeoutMs,retry,authRetry,clockRetry:clockRetry+1});}
       failure.sessionRecoverable=true;throw failure;
     }
     const expired=/(jwt|token).*(expired|invalid)|expired.*(jwt|token)/i.test(errText);
     if(authRetry&&token&&expired&&!path.startsWith('/auth/v1/')){
       const fresh=await refreshAuthSingleFlight();
       return req(path,{method,body,token:fresh.access_token,timeoutMs,retry,authRetry:false});
     }
     throw failure;
   }
   return d;
 }catch(err){
   const timedOut=err?.name==="AbortError";
   if(retry>0&&(timedOut||err instanceof TypeError)){
     await new Promise(resolve=>setTimeout(resolve,350));
     return req(path,{method,body,token,timeoutMs,retry:retry-1,authRetry,clockRetry});
   }
   if(timedOut)throw Error("Saturday Foundry could not reach the server. Please check your connection and try again.");
   throw err;
 }finally{clearTimeout(timer)}
}
async function refreshSession(){
 let s=session();
 if(!s?.access_token)return null;
 // Refresh proactively when the JWT is already expired or within 60 seconds of expiry.
 const exp=jwtExpMs(s.access_token);
 if(exp && exp<=Date.now()+60000){
   try{return await refreshAuthSingleFlight()}catch(error){if(error.sessionExpired)return null;throw error}
 }
 try{
   const user=await req("/auth/v1/user",{token:s.access_token});
   const latest=session();
   if(!latest?.access_token)throw expiredSessionError();
   if(latest.access_token!==s.access_token)return latest;
   const merged={...latest,user};save(merged);return merged;
 }catch(error){
   if(isFutureJwtError(error)||![401,403].includes(error?.status))throw error;
   try{return await refreshAuthSingleFlight()}catch(error){if(error.sessionExpired)return null;throw error}
 }
}
