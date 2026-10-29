const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('advanced tools render frameless and size the frame to its content',()=>{
 const wf=read('assets/graphite/workflows.js');
 assert(wf.includes('onload="sizeToolsFrame(this)"'),'Tools frame should size itself on load');
 assert(wf.includes('function sizeToolsFrame(frame)'),'Frame sizer should be defined');
 const css=read('assets/graphite/responsive.css');
 assert(!css.includes('100dvh - 295px'),'Tools frame should not be a fixed-height box');
 const frameRule=css.slice(css.indexOf('.advanced-frame{'),css.indexOf('}',css.indexOf('.advanced-frame{')));
 assert(frameRule.includes('border:0'),'Tools frame should be borderless');

 const src=wf.slice(wf.indexOf('function sizeToolsFrame(frame)'),wf.indexOf('const nativeGo=go'));
 const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
 const w=dom.window;
 w.eval(src);
 const inner=new JSDOM('<!doctype html><body><div id="app"></div></body>');
 const app=inner.window.document.getElementById('app');
 Object.defineProperty(app,'offsetTop',{configurable:true,get:()=>10});
 Object.defineProperty(app,'offsetHeight',{configurable:true,get:()=>800});
 const frame={contentDocument:inner.window.document,contentWindow:{addEventListener(){}},style:{}};
 w.sizeToolsFrame(frame);
 assert.equal(frame.style.height,'834px','Frame height should match content height');
});
