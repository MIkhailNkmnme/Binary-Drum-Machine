const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.SETKA_JSDOM||'C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const read=name=>fs.readFileSync(__dirname+'/'+name,'utf8');
function boot(saved={},detached=false,setup){
 const dom=new JSDOM('<body><div id="mayTemplateLauncher"><button id="bTemplatePanel">Library</button></div><button id="bTemplateSave" disabled></button></body>',{url:'http://test/',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.requestAnimationFrame=()=>1;w.HTMLCanvasElement.prototype.getContext=()=>null;w.MayatnikLibraryDetached=detached;w.MayatnikLibraryExport=require('./mayatnik-library-export.js');
 for(const [key,value]of Object.entries(saved))w.localStorage.setItem(key,value);
 if(setup)setup(w);
 w.eval(read('mayatnik-template-folders.js'));w.eval(read('mayatnik-template-panel.js'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const style=w.document.createElement('style');style.textContent=read('mayatnik-template-panel.css');w.document.head.append(style);
 const api=w.MayatnikTemplatePanel,launch=w.document.getElementById('bTemplatePanel');launch.onclick=()=>api.toggle();
 return {dom,w,api,launch,panel:w.document.getElementById('mayatnikTemplatePanel')};
}
test('library minimises to its launcher, restores the selected section and width, and never strands keyboard focus',()=>{
 const a=boot({'mayatnik-template-panel-width':'700','mayatnik-library-tab':'settings'});try{
  a.launch.focus();a.launch.click();assert.equal(a.api.isOpen(),true);assert.equal(a.w.getComputedStyle(a.launch.parentElement).display,'none');
  assert.equal(a.w.document.activeElement.dataset.libraryTab,'settings');assert.equal(a.panel.querySelector('[data-library-tab=settings]').tabIndex,0);
  a.panel.querySelector('[data-library-tab=layers]').click();const close=a.panel.querySelector('[data-library-close]');close.focus();close.click();
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
  const css=read('mayatnik-template-panel.css');assert.match(css,/\.mtp-tabs\{[^}]*flex-direction:row;flex-wrap:nowrap;overflow-x:auto/);assert.match(css,/\.mtp-tabs \.mtp-command\{flex:0 0 60px;width:60px/);assert.doesNotMatch(css,/\.mtp-navigation \.mtp-tabs/);
  assert.equal(tabs.previousElementSibling,a.panel.querySelector('.mtp-heading'));for(const b of tabs.children){const s=a.w.getComputedStyle(b);assert.equal(s.width,'60px');assert.equal(s.height,'24px');assert.equal(b.title,b.getAttribute('aria-label'));}
  a.w.document.body.classList.add('may-mobile-menu');a.w.dispatchEvent(new a.w.Event('may-mobile-menu-change'));assert.equal(a.w.getComputedStyle(a.launch.parentElement).display,'none');assert.equal(tabs.parentElement,a.panel);
  const commands=a.panel.querySelector('.mtp-section-commands');assert.equal(commands.children.length,5);for(const mobile of [false,true]){a.w.document.body.classList.toggle('may-mobile-menu',mobile);for(const b of commands.children){const s=a.w.getComputedStyle(b);assert.equal(s.width,'24px');assert.equal(s.height,'24px');assert.equal(b.textContent,'');assert.ok(b.querySelector('.mtp-heading-glyph'));assert.ok(b.title);assert.ok(b.getAttribute('aria-label'));}}assert.equal(a.w.getComputedStyle(commands.querySelector('[data-section-delete] .mtp-heading-edge')).stroke,'#ff625c');
  assert.ok(commands.querySelector('[data-library-export]'));assert.equal(a.w.getComputedStyle(a.panel.querySelector('.mtp-selection button:not([data-library-save])')).width,'120px');
  for(const mobile of [false,true]){a.w.document.body.classList.toggle('may-mobile-menu',mobile);for(const b of a.panel.querySelectorAll('[data-library-layout]')){const s=a.w.getComputedStyle(b),icon=a.w.getComputedStyle(b.querySelector('svg'));assert.equal(s.width,'24px');assert.equal(s.height,'24px');assert.equal(icon.width,'24px');assert.equal(icon.height,'24px');assert.ok(b.getAttribute('aria-label'));}const search=a.w.getComputedStyle(a.panel.querySelector('.mtp-search'));assert.equal(search.width,'120px');assert.equal(search.flexGrow,'0');assert.equal(search.flexBasis,'120px');assert.equal(search.maxWidth,'100%');assert.equal(search.height,'28px');}
  const footer=a.panel.querySelector('.mtp-viewbar');assert.equal(footer.parentElement,a.panel);assert.equal(a.panel.lastElementChild,footer);assert.equal(workspace.contains(footer),false);assert.equal(a.w.getComputedStyle(footer).justifyContent,'flex-end');assert.equal(a.w.getComputedStyle(footer).flexShrink,'0');assert.equal(a.w.getComputedStyle(workspace).overflow,'auto');assert.equal(a.w.getComputedStyle(a.panel).overflow,'hidden');
 }finally{a.dom.window.close();}
});
test('template area dialog raises the limit, offers explicit unlimited and synchronizes both library sections',()=>{
 let value=4096;const a=boot({},false,w=>{w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.mayTemplateLimit={get:()=>value,set:n=>{value=n;w.dispatchEvent(new w.Event('may-template-limit-change'));}};});try{
  a.api.openTab('templates');const trigger=a.panel.querySelector('.mtp-template-pane [data-template-limit]');assert.equal(trigger.disabled,false);assert.equal(a.w.getComputedStyle(trigger).width,'120px');trigger.click();const dialog=a.panel.querySelector('#mayTemplateLimitDialog'),input=dialog.querySelector('input'),[apply,unlimited,cancel]=dialog.querySelectorAll('button');assert.equal(dialog.open,true);assert.equal(input.value,'4096');input.value='16384';apply.click();assert.equal(value,16384);assert.equal(dialog.open,false);assert.match(trigger.title,/16.*384/);
  trigger.click();input.value='32768';cancel.click();assert.equal(value,16384);trigger.click();unlimited.click();assert.equal(value,0);assert.equal(dialog.open,false);for(const b of a.panel.querySelectorAll('[data-template-limit]'))assert.match(b.title,/без лимита/);
  a.api.openTab('settings');assert.equal(a.panel.querySelector('.mtp-settings-pane [data-template-limit]').disabled,false);a.panel.querySelector('.mtp-settings-pane [data-template-limit]').click();input.value='4096';apply.click();assert.equal(value,4096);assert.equal(a.api.isOpen(),true);
 }finally{a.dom.window.close();}
});
test('header has just two 24px diamond icons after the left title, without visible command text',()=>{
 const a=boot();try{a.api.setOpen(true);const head=a.panel.querySelector('.mtp-heading');assert.equal(a.panel.querySelector('[data-library-minimise]'),null);assert.equal(head.firstElementChild.tagName,'STRONG');assert.equal(a.w.getComputedStyle(head.firstElementChild).flexGrow,'1');
  const icons=[...head.querySelectorAll('button')];assert.deepEqual(icons.map(b=>b.hasAttribute('data-library-window')?'window':'close'),['window','close']);
  for(const b of icons){const s=a.w.getComputedStyle(b);assert.equal(s.width,'24px');assert.equal(s.height,'24px');assert.equal(s.minHeight,'24px');assert.equal(b.textContent,'');assert.ok(b.title);assert.equal(b.getAttribute('aria-label'),b.title);assert.equal(b.querySelector('svg').getAttribute('aria-hidden'),'true');assert.ok(b.querySelector('.mtp-heading-glyph').getAttribute('d'));assert.equal(s.clipPath,'polygon(50% 0,100% 50%,50% 100%,0 50%)');}
  a.w.document.body.classList.add('may-mobile-menu');for(const b of icons)assert.equal(a.w.getComputedStyle(b).minHeight,'24px');
 }finally{a.dom.window.close();}
});
test('folders live collapsed in the third toolbar row and the card workspace has no reserved sidebar',()=>{
 const a=boot();try{a.api.setOpen(true);const nav=a.panel.querySelector('.mtp-navigation'),toolbar=a.panel.querySelector('.mtp-toolbar'),workspace=a.panel.querySelector('.mtp-workspace');
  assert.equal(nav.parentElement,toolbar);assert.equal(toolbar.previousElementSibling,a.panel.querySelector('.mtp-tabs'));assert.equal(nav.nextElementSibling,a.panel.querySelector('.mtp-file-commands'));assert.equal(nav.open,false);assert.equal(a.w.getComputedStyle(nav.querySelector('.mtp-folder-tree')).display,'none');
  assert.equal(workspace.children.length,1);assert.equal(workspace.firstElementChild.className,'mtp-main');assert.equal(a.w.getComputedStyle(workspace).gridTemplateColumns,'minmax(0,1fr)');assert.equal(workspace.querySelector('.mtp-navigation'),null);
  nav.querySelector('summary').click();assert.equal(nav.open,true);assert.equal(nav.querySelector('.mtp-folder-empty').textContent,'Нет папок');assert.equal(a.w.getComputedStyle(nav.querySelector('.mtp-folder-tree')).position,'absolute');
  a.w.document.body.classList.add('may-mobile-menu');assert.equal(nav.parentElement,toolbar);assert.equal(a.w.getComputedStyle(nav.querySelector('.mtp-folder-tree')).overflow,'auto');
 }finally{a.dom.window.close();}
});
test('top folder tree preserves nested folder selection, parent navigation and user names',()=>{
 const a=boot({'mayatnik-template-folders-v1':JSON.stringify({nodes:[{kind:'folder',id:'parent',name:'Папка родитель',parent:''},{kind:'folder',id:'child',name:'Дочерняя папка',parent:'parent'}]})});try{
  a.api.setOpen(true);const nav=a.panel.querySelector('.mtp-navigation');nav.querySelector('summary').click();nav.querySelector('[data-folder-id=child]').click();
  assert.match(a.panel.querySelector('.mtp-address').textContent,/Папка родитель \/ Дочерняя папка$/);assert.equal(nav.querySelector('[data-folder-id=child]').getAttribute('aria-pressed'),'true');assert.equal(nav.querySelector('[data-folder-id=child]').dataset.userLabel,'');assert.equal(nav.querySelector('[data-folder-id=child]').style.getPropertyValue('--mtp-depth'),'1');
  a.panel.querySelector('[data-library-up]').click();assert.match(a.panel.querySelector('.mtp-address').textContent,/\/ Папка родитель$/);assert.equal(nav.querySelector('[data-folder-id=parent]').getAttribute('aria-pressed'),'true');a.panel.querySelector('[data-library-up]').click();assert.equal(a.panel.querySelector('[data-library-up]').disabled,true);
  nav.querySelector('summary').click();assert.equal(nav.open,false);assert.equal(a.w.getComputedStyle(nav.querySelector('.mtp-folder-tree')).display,'none');
 }finally{a.dom.window.close();}
});
test('detached browser library retains close and hides the separate-window action',()=>{
 const a=boot({},true);try{a.api.setOpen(true);assert.equal(a.panel.querySelector('[data-library-minimise]'),null);assert.equal(a.panel.querySelector('[data-library-window]').hidden,true);let closed=false;a.w.close=()=>{closed=true;};a.panel.querySelector('button[title="Закрыть библиотеку"]').click();assert.equal(closed,true);}finally{a.dom.window.close();}
});
