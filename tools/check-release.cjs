const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const {version}=JSON.parse(read('package.json'));
const main=read('index.html');
assert.equal(main,read('foundry.html'),'The compatibility entry point must match the native site');
assert(main.includes(`content="${version}"`),'Native release metadata is stale');
assert(!main.includes('__SF_VERSION__')&&!main.includes('__SF_BADGE__'),'Unexpanded release placeholders');
assert(main.includes('id="app"')&&main.includes('function leagueChooser('),'The main entry point must be the native site');
for(const name of ['index.html']){
  let index=0;
  for(const match of read(name).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    if(/\bsrc\s*=/.test(match[1])||/\btype\s*=\s*["'](?:application\/ld\+json|application\/json)["']/.test(match[1]))continue;
    new vm.Script(match[2],{filename:`${name}:script-${++index}`});
  }
}
assert.deepEqual(fs.readdirSync(path.join(root,'.github/workflows')).filter(n=>/\.ya?ml$/.test(n)),['release-checks.yml'],'Only the read-only release checks should be active');
const workflow=read('.github/workflows/release-checks.yml');
assert(workflow.includes('contents: read')&&!workflow.includes('contents: write'),'Release checks must not rewrite production');
assert.equal(JSON.parse(read('package-lock.json')).version,version,'Dependency lock version is stale');
console.log(`Release ${version}: entry points, script syntax and workflow checks passed.`);
