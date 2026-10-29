const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Safari and installed iOS standalone modes are identified separately',()=>{
  const workflows=read('assets/graphite/workflows.js');
  const end=workflows.indexOf('/* Graphite & Crimson application.');
  assert(end>0,'Standalone detection should run before the application starts');
  const detector=workflows.slice(0,end);
  for(const [name,iosFlag,mediaFlag,expected] of [
    ['Safari browser',false,false,false],
    ['iPhone Home Screen',true,false,true],
    ['manifest standalone',false,true,true]
  ]){
    const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{
      url:'https://saturday-foundry.netlify.app/',runScripts:'outside-only'
    });
    Object.defineProperty(dom.window.navigator,'standalone',{configurable:true,value:iosFlag});
    dom.window.matchMedia=()=>({matches:mediaFlag});
    dom.window.eval(detector);
    assert.equal(dom.window.document.documentElement.classList.contains('sf-standalone'),expected,name);
    dom.window.close();
  }
});

test('installed iPhone dock matches compact Safari dimensions and retains 44px touch targets',()=>{
  const css=read('assets/graphite/responsive.css');
  const html=read('index.html');
  const compatibility=read('foundry.html');
  assert.match(css,/html\.sf-standalone \.bottomnav\{/);
  assert.match(css,/html\.sf-standalone \.bottomnav button\{[^}]*min-height:44px;height:44px;max-height:44px/);
  assert.match(css,/html\.sf-standalone \.bottomnav \.icon\{width:18px;height:18px\}/);
  assert.match(css,/html\.sf-standalone \.bottomnav button\.on:before\{height:2px;width:20px/);
  assert.match(css,/safe-area-inset-bottom/);
  assert(html.includes('sfStandaloneMode'),'Bundled app must detect Home Screen mode');
  assert(html.includes('html.sf-standalone .bottomnav button'),'Bundled CSS must include dock override');
  assert.equal(html,compatibility,'Both entry points must match');
  assert.match(html,/<meta name="sf-version" content="10\.1\.2">/);
});

test('PWA entry points, root launch and manifest are explicitly non-cacheable',()=>{
  const headers=read('_headers');
  for(const route of ['/','/index.html','/foundry.html','/manifest.webmanifest']){
    assert(headers.split('\n').some((line,i,all)=>line===route&&all[i+1]?.trim()==='Cache-Control: no-cache, no-store, must-revalidate'),
      route+' must not preserve old HTML or web-app metadata');
  }
  const manifest=JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url,'/');
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.short_name,'Foundry');
});
