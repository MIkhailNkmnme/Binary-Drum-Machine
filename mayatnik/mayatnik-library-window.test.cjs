const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const script=fs.readFileSync(__dirname+'/mayatnik-library-window.js','utf8'),folders=fs.readFileSync(__dirname+'/mayatnik-template-folders.js','utf8'),panel=fs.readFileSync(__dirname+'/mayatnik-template-panel.js','utf8');
function windowDom(){const dom=new JSDOM('<html><body><p id="mayLibraryConnection" hidden></p><button id="bTemplateSave" disabled></button></body></html>',{url:'http://test/mayatnik/mayatnik-library.html',runScripts:'outside-only'}),w=dom.window;w.structuredClone=structuredClone;w.HTMLCanvasElement.prototype.getContext=()=>null;w.requestAnimationFrame=f=>w.setTimeout(f,0);return dom;}
test('detached window shares live APIs, folder store and save action; source close disables disconnected view',async()=>{const source=windowDom(),popup=windowDom(),s=source.window,w=popup.window;try{
 s.maySettingsLibrary={ready:Promise.resolve(),list:()=>[],getState:()=>({}),subscribe:()=>()=>{}};s.eval(folders);let selected=null,saved=0,notify;const entries=[{id:'a',name:'A',hex:'#eeeeee',parts:[]}];s.mayTemplateLibrary={list:()=>entries,allIds:()=>entries.map(t=>t.id),getState:()=>({selectedId:selected}),subscribe:fn=>(notify=fn,()=>{}),refresh(){},select:id=>{selected=id;notify?.();}};const store=s.MayatnikTemplateFolders.create(s.localStorage);s.MayatnikTemplatePanel={getFolderStore:()=>store};const original=s.document.getElementById('bTemplateSave');original.disabled=false;original.onclick=()=>saved++;
 Object.defineProperty(w,'opener',{value:s});let tick;w.setInterval=f=>(tick=f,1);w.clearInterval=()=>{};w.eval(folders);Object.defineProperty(w.document,'readyState',{value:'interactive',configurable:true});w.eval(script);w.eval(panel);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await new Promise(r=>setTimeout(r,25));
 assert.equal(w.mayTemplateLibrary,s.mayTemplateLibrary);assert.equal(w.maySettingsLibrary,s.maySettingsLibrary);assert.equal(w.MayatnikTemplatePanel.getFolderStore(),store);assert.equal(w.MayatnikTemplatePanel.isOpen(),true);assert.equal(w.document.querySelector('[data-library-window]').hidden,true);w.document.querySelector('[data-template-id=a] .mtp-preview').click();assert.equal(selected,'a');w.document.querySelector('[data-library-save]').click();assert.equal(saved,1);
 store.addFolder('Shared');await new Promise(r=>setTimeout(r,20));assert.match(w.document.querySelector('.mtp-folder').textContent,/Shared/);original.disabled=true;await new Promise(r=>setTimeout(r,20));assert.equal(w.document.querySelector('[data-library-save]').disabled,true);
 s.mayTemplateLibrary={};tick();assert.ok(w.document.documentElement.classList.contains('may-library-disconnected'));assert.equal(w.document.getElementById('mayLibraryConnection').hidden,false);
 }finally{w.close();s.close();}});
test('direct navigation without opener explains how to open the library and exposes no active panel',()=>{const dom=windowDom();try{dom.window.eval(script);assert.ok(dom.window.document.documentElement.classList.contains('may-library-disconnected'));assert.match(dom.window.document.getElementById('mayLibraryConnection').textContent,/кнопкой «Окно»/);}finally{dom.window.close();}});

test('opening a separate library hides the source, preserves its tab and routes later opens to that window',()=>{
 const dom=windowDom(),w=dom.window;try{
  w.eval(folders);w.eval(panel);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const api=w.MayatnikTemplatePanel;api.openTab('frames');let openedUrl,focused=0,shown=[];
  const popup={closed:false,focus:()=>focused++,MayatnikTemplatePanel:{openTab:tab=>shown.push(tab)}};
  w.open=url=>(openedUrl=url,popup);w.document.querySelector('[data-library-window]').click();
  assert.equal(new URL(openedUrl).searchParams.get('tab'),'frames');assert.equal(api.isOpen(),false);
  assert.equal(w.document.body.classList.contains('may-template-panel-open'),false);
  assert.equal(w.document.querySelector('.mtp-resize').hidden,true);
  api.openTab('layers');assert.equal(api.isOpen(),false);assert.deepEqual(shown,['layers']);assert.ok(focused>=2);
  popup.closed=true;api.openTab('templates');assert.equal(api.isOpen(),true);
 }finally{w.close();}
});

test('blocked popup leaves the source library visible with a retry notice',()=>{
 const dom=windowDom(),w=dom.window;try{
  w.eval(folders);w.eval(panel);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.MayatnikTemplatePanel.openTab('frames');
  w.open=()=>null;w.document.querySelector('[data-library-window]').click();
  assert.equal(w.MayatnikTemplatePanel.isOpen(),true);assert.equal(w.document.querySelector('[data-window-notice]').hidden,false);
 }finally{w.close();}
});
