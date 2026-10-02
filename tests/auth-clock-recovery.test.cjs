const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function fixture(replies){
 const values=new Map(),calls=[],waits=[],logs=[];
 const button={dataset:{},disabled:false,textContent:'Enter Saturday Foundry',addEventListener(event,fn){this.click=fn}};
 const elements={signInBtn:button,authMessage:{},loginEmail:{value:'test@example.com'},loginPassword:{value:'test-password'}};
 const ctx={URL:'https://test.supabase.co',KEY:'publishable',STORE:'session',AbortController,TypeError,Date,atob,
  localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},
  setTimeout(fn,ms){if(ms<3000){waits.push(ms);queueMicrotask(fn)}return 1},clearTimeout(){},
  console:{warn:(...args)=>logs.push(args)},window:{},$:id=>elements[id]||null,
  hide(){},msg(el,text){el.textContent=text},signedOut(){ctx.signedOutCalls++},signedOutCalls:0,
  fetch:async(url,options)=>{calls.push({url,options});const reply=replies.shift();if(!reply)throw Error('Unexpected request');if(reply instanceof Error)throw reply;return {ok:reply.status<400,status:reply.status,text:async()=>JSON.stringify(reply.body)}}};
 vm.createContext(ctx);
 vm.runInContext(html.slice(html.indexOf('function session(){'),html.indexOf('\nconst Data={')),ctx);
 vm.runInContext('save({access_token:"original-token",refresh_token:"refresh-token",user:{id:"user"}})',ctx);
 return {ctx,calls,waits,logs,button,elements,run:code=>vm.runInContext(code,ctx)};
}
const skew={status:401,body:{code:'PGRST303',message:'JWT issued at future'}};
test('explicit JWT timing rejection retries a data query with the same token',async()=>{
 const f=fixture([skew,skew,{status:200,body:[{dynasty_id:'league'}]}]);
 const rows=await f.run('req("/rest/v1/v_my_dynasties?select=*",{token:session().access_token})');
 assert.equal(rows[0].dynasty_id,'league');assert.equal(f.calls.length,3);assert.deepEqual(f.waits,[750,1500]);
 for(const call of f.calls)assert.equal(call.options.headers.Authorization,'Bearer original-token');
 assert.equal(f.run('session().access_token'),'original-token');assert.equal(f.logs.length,0);
});
test('persistent timing failure is bounded, friendly and preserves the session',async()=>{
 const f=fixture([skew,skew,skew]);
 await assert.rejects(f.run('req("/rest/v1/v_my_dynasties?select=*",{token:session().access_token})'),err=>err.authClockSkew&&err.code==='PGRST303'&&!/JWT/.test(err.message));
 assert.equal(f.calls.length,3);assert.equal(f.run('session().access_token'),'original-token');
 const diagnostic=JSON.stringify(f.logs);assert(!diagnostic.includes('original-token'));assert(!diagnostic.includes('refresh-token'));assert(!diagnostic.includes('select='));
});
test('other unauthorized errors and ambiguous mutation failures are never timing-retried',async()=>{
 const f=fixture([{status:401,body:{code:'PGRST303',message:'Invalid signature'}}]);
 await assert.rejects(f.run('req("/rest/v1/test",{token:session().access_token})'),/Invalid signature/);
 assert.equal(f.calls.length,1);assert.deepEqual(f.waits,[]);
 const g=fixture([{status:500,body:{message:'JWT issued at future'}}]);
 await assert.rejects(g.run('req("/rest/v1/rpc/save",{method:"POST",body:{},token:session().access_token})'));
 assert.equal(g.calls.length,1);
});
test('restored sessions do not refresh or disappear on a timing rejection',async()=>{
 const f=fixture([skew,skew,skew]);
 await assert.rejects(f.run('refreshSession()'),err=>err.authClockSkew);
 assert.equal(f.calls.length,3);assert(f.calls.every(call=>call.url.endsWith('/auth/v1/user')));
 assert.equal(f.run('session().access_token'),'original-token');
});
test('refresh timing failure retains credentials; actual revoked refresh removes them',async()=>{
 const f=fixture([skew]);await assert.rejects(f.run('refreshAuthSingleFlight()'),err=>err.authClockSkew);
 assert.equal(f.run('session().refresh_token'),'refresh-token');
 const g=fixture([{status:400,body:{message:'Invalid refresh token'}}]);
 await assert.rejects(g.run('refreshAuthSingleFlight()'),/session expired/);assert.equal(g.run('session()'),null);
});
test('Try again resumes the existing session without submitting the password again',async()=>{
 const f=fixture([{status:200,body:{id:'user'}}]);
 f.ctx.enterCalls=0;f.ctx.passwordCalls=0;
 f.run('const Data={signIn:async()=>{passwordCalls++;return session()}};async function enter(){enterCalls++;authResumePending=false;$("signInBtn").textContent="Enter Saturday Foundry"}');
 const start=html.indexOf('function bindCriticalAuth(){'),end=html.indexOf('\n$("heismanSeason")',start);
 assert(end>start);f.run(html.slice(start,end));f.run('bindCriticalAuth();showAuthFailure({authClockSkew:true})');
 assert.equal(f.button.textContent,'Try again');assert(!/JWT/.test(f.elements.authMessage.textContent));
 f.elements.loginEmail.value='';f.elements.loginPassword.value='';
 await f.button.click({preventDefault(){}});
 assert.equal(f.ctx.passwordCalls,0);assert.equal(f.ctx.enterCalls,1);assert.equal(f.button.disabled,false);
 assert.equal(f.button.textContent,'Enter Saturday Foundry');
});
