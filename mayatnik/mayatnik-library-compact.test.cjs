const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const read=name=>fs.readFileSync(__dirname+'/'+name,'utf8');
function boot(saved={},detached=false){
 const dom=new JSDOM('<body><div id="mayTemplateLauncher"><button id="bTemplatePanel">Library</button></div><button id="bTemplateSave" disabled></button></body>',{url:'http://test/',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.requestAnimationFrame=()=>1;w.HTMLCanvasElement.prototype.getContext=()=>null;w.MayatnikLibraryDetached=detached;
 for(const [key,value]of Object.entries(saved))w.localStorage.setItem(key,value);
 w.eval(read('mayatnik-template-folders.js'));w.eval(read('mayatnik-template-panel.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const style=w.document.createElement('style');style.textContent=read('mayatnik-template-panel.css');w.document.head.append(style);
 const api=w.MayatnikTemplatePanel,launch=w.document.getElementById('bTemplatePanel');launch.onclick=()=>api.toggle();
 return {dom,w,api,launch,panel:w.document.getElementById('mayatnikTemplatePanel')};
}
test('library minimises to its launcher, restores the selected section and width, and never strands keyboard focus',()=>{
 const a=boot({'mayatnik-template-panel-width':'700','mayatnik-library-tab':'settings'});try{
  a.launch.focus();a.launch.click();assert.equal(a.api.isOpen(),true);assert.equal(a.w.getComputedStyle(a.launch.parentElement).display,'none');
  assert.equal(a.w.document.activeElement.dataset.libraryTab,'settings');assert.equal(a.panel.querySelector('[data-library-tab=settings]').tabIndex,0);
  a.panel.querySelector('[data-library-tab=layers]').click();const minimise=a.panel.querySelector('[data-library-minimise]');minimise.focus();minimise.click();
  assert.equal(a.api.isOpen(),false);assert.equal(a.panel.hidden,true);assert.equal(a.w.localStorage.getItem('mayatnik-template-panel-open'),'0');assert.equal(a.w.document.activeElement,a.launch);
  assert.notEqual(a.w.getComputedStyle(a.launch.parentElement).display,'none');a.launch.click();assert.equal(a.w.document.activeElement.dataset.libraryTab,'layers');
  assert.equal(a.w.document.body.style.getPropertyValue('--may-template-panel-width'),'700px');assert.equal(a.w.localStorage.getItem('mayatnik-library-tab'),'layers');
  a.panel.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(a.api.isOpen(),false);assert.equal(a.w.document.activeElement,a.launch);
 }finally{a.dom.window.close();}
});
test('restored open state hides the launcher and keeps all five sections above the folder workspace',()=>{
 const a=boot({'mayatnik-template-panel-open':'1','mayatnik-library-tab':'frames'});try{
  assert.equal(a.api.isOpen(),true);assert.equal(a.w.getComputedStyle(a.launch.parentElement).display,'none');
  const tabs=a.panel.querySelector('.mtp-tabs'),workspace=a.panel.querySelector('.mtp-workspace');assert.equal(tabs.parentElement,a.panel);assert.ok(tabs.compareDocumentPosition(workspace)&a.w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.deepEqual([...tabs.children].map(b=>b.dataset.libraryTab),['templates','layers','frames','settings','sequences']);assert.equal(workspace.querySelector('[role=tablist]'),null);
  const current=tabs.querySelector('[aria-selected=true]');current.focus();current.dispatchEvent(new a.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  assert.equal(a.w.document.activeElement.dataset.libraryTab,'settings');assert.equal(tabs.querySelectorAll('[tabindex="0"]').length,1);
  const css=read('mayatnik-template-panel.css');assert.match(css,/\.mtp-tabs\{[^}]*flex-direction:row;flex-wrap:nowrap;overflow-x:auto/);assert.match(css,/\.mtp-tabs \.mtp-command\{flex:0 0 120px;width:120px/);assert.doesNotMatch(css,/\.mtp-navigation \.mtp-tabs/);
  a.w.document.body.classList.add('may-mobile-menu');a.w.dispatchEvent(new a.w.Event('may-mobile-menu-change'));assert.equal(a.w.getComputedStyle(a.launch.parentElement).display,'none');assert.equal(tabs.parentElement,a.panel);
 }finally{a.dom.window.close();}
});
test('detached browser library retains close and hides embedded-only minimise',()=>{
 const a=boot({},true);try{a.api.setOpen(true);assert.equal(a.panel.querySelector('[data-library-minimise]').hidden,true);assert.equal(a.panel.querySelector('[data-library-window]').hidden,true);let closed=false;a.w.close=()=>{closed=true;};a.panel.querySelector('button[title="Закрыть библиотеку"]').click();assert.equal(closed,true);}finally{a.dom.window.close();}
});
