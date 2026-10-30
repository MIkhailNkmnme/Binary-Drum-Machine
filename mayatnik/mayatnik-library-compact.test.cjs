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
 const a=boot();try{a.api.setOpen(true);const head=a.panel.querySelector('.mtp-heading');assert.equal(a.panel.querySelector('[data-library-minimise]'),null);assert.equal(head.firstElementChild.tagName,'NAV');assert.equal(a.w.getComputedStyle(head.firstElementChild).flexGrow,'1');
  const icons=[...head.querySelectorAll(':scope > .mtp-heading-icon')];assert.deepEqual(icons.map(b=>b.hasAttribute('data-library-window')?'window':'close'),['window','close']);
  for(const b of icons){const s=a.w.getComputedStyle(b);assert.equal(s.width,'24px');assert.equal(s.height,'24px');assert.equal(s.minHeight,'24px');assert.equal(b.textContent,'');assert.ok(b.title);assert.equal(b.getAttribute('aria-label'),b.title);assert.equal(b.querySelector('svg').getAttribute('aria-hidden'),'true');assert.ok(b.querySelector('.mtp-heading-glyph').getAttribute('d'));assert.equal(s.clipPath,'polygon(50% 0,100% 50%,50% 100%,0 50%)');}
  a.w.document.body.classList.add('may-mobile-menu');for(const b of icons)assert.equal(a.w.getComputedStyle(b).minHeight,'24px');
 }finally{a.dom.window.close();}
});
test('header path replaces the folder/up controls and the card workspace has no reserved sidebar',()=>{
 const a=boot();try{a.api.setOpen(true);const nav=a.panel.querySelector('.mtp-header-path'),toolbar=a.panel.querySelector('.mtp-toolbar'),workspace=a.panel.querySelector('.mtp-workspace');
  assert.equal(nav.parentElement.className,'mtp-heading');assert.equal(toolbar.previousElementSibling,a.panel.querySelector('.mtp-tabs'));assert.equal(a.panel.querySelector('.mtp-navigation,[data-library-up],.mtp-location'),null);
  assert.equal(workspace.children.length,1);assert.equal(workspace.firstElementChild.className,'mtp-main');assert.equal(a.w.getComputedStyle(workspace).gridTemplateColumns,'minmax(0,1fr)');assert.equal(workspace.querySelector('.mtp-navigation'),null);
  a.api.openTab('sequences');assert.equal(nav.title,'Библиотека / Послед-ти');assert.equal(nav.textContent,nav.title);nav.querySelectorAll('button')[1].click();assert.equal(a.panel.querySelector('[data-library-tab=sequences]').getAttribute('aria-selected'),'true');assert.equal(a.w.getComputedStyle(nav).overflow,'hidden');assert.equal(a.w.getComputedStyle(workspace).scrollbarWidth,'none');
 }finally{a.dom.window.close();}
});
test('header breadcrumbs preserve nested parent navigation and user folder names',()=>{
 const a=boot({'mayatnik-template-folders-v1':JSON.stringify({nodes:[{kind:'folder',id:'parent',name:'Папка родитель',parent:''},{kind:'folder',id:'child',name:'Дочерняя папка',parent:'parent'}]})},false,w=>{w.mayTemplateLibrary={list:()=>[],allIds:()=>[],getState:()=>({}),subscribe:()=>()=>{},refresh(){}};});try{
  a.api.setOpen(true);a.panel.querySelector('.mtp-folder .mtp-preview').click();a.panel.querySelector('.mtp-folder .mtp-preview').click();const nav=a.panel.querySelector('.mtp-header-path');
  assert.match(nav.textContent,/Папка родитель \/ Дочерняя папка$/);assert.equal(nav.querySelector('[data-folder-id=child]').dataset.userLabel,'');assert.equal(nav.querySelector('[data-folder-id=child]').title,'Дочерняя папка');
  nav.querySelector('[data-folder-id=parent]').click();assert.match(nav.textContent,/\/ Папка родитель$/);nav.querySelector('[data-folder-id=""]').click();assert.equal(nav.textContent,'Библиотека / Шаблоны');assert.ok(a.panel.querySelector('.mtp-folder'));
 }finally{a.dom.window.close();}
});
test('detached browser library retains close and hides the separate-window action',()=>{
 const a=boot({},true);try{a.api.setOpen(true);assert.equal(a.panel.querySelector('[data-library-minimise]'),null);assert.equal(a.panel.querySelector('[data-library-window]').hidden,true);let closed=false;a.w.close=()=>{closed=true;};a.panel.querySelector('button[title="Закрыть библиотеку"]').click();assert.equal(closed,true);}finally{a.dom.window.close();}
});
test('template list card gives the right preview its whole height and retains left text, actions and tile presentation',async()=>{
 const item={id:'tall',name:'Высокий шаблон с длинным названием',hex:'#ff5500',parts:[{width:2,height:8,data:new Uint32Array(16)}]},actions=[];
 const a=boot({'mayatnik-library-layout':'list'},false,w=>{w.mayTemplateLibrary={list:()=>[item],allIds:()=>[item.id],getState:()=>({selectedId:'tall'}),subscribe:()=>()=>{},refresh(){},select:id=>actions.push(['select',id]),action:(id,action)=>actions.push([action,id])};});try{
  a.api.setOpen(true);const card=a.panel.querySelector('[data-template-id=tall]'),preview=card.querySelector('.mtp-preview'),name=card.querySelector('.mtp-name'),metrics=card.querySelector('.mtp-metrics'),buttons=card.querySelector('.mtp-card-actions'),image=preview.querySelector('img');assert.equal(name.textContent,item.name);assert.equal(buttons.children.length,8);
  for(const mobile of [false,true]){a.w.document.body.classList.toggle('may-mobile-menu',mobile);const p=a.w.getComputedStyle(preview),im=a.w.getComputedStyle(image);assert.equal(p.gridColumn,'2');assert.equal(p.gridRow,'1 / 4');assert.equal(p.height,'100%');assert.equal(im.width,'100%');assert.equal(im.height,'100%');assert.equal(im.objectFit,'contain');assert.equal(im.imageRendering,'pixelated');for(const n of [name,metrics,buttons])assert.equal(a.w.getComputedStyle(n).gridColumn,'1');assert.equal(a.w.getComputedStyle(buttons).flexWrap,'wrap');assert.equal(a.w.getComputedStyle(name).whiteSpace,'normal');}
  const visible=buttons.querySelector('[data-template-visibility]'),before=a.w.getComputedStyle(visible).width;visible.disabled=false;assert.equal(a.w.getComputedStyle(visible).width,before);preview.click();buttons.querySelector('button[title="Добавить копию шаблона на поле"]').click();await Promise.resolve();assert.deepEqual(actions,[['select','tall'],['insert','tall']]);
  a.panel.querySelector('[data-library-layout=tiles]').click();assert.equal(a.panel.querySelector('[data-template-id=tall]'),card);assert.equal(a.w.getComputedStyle(preview).aspectRatio,'1');assert.notEqual(a.w.getComputedStyle(preview).gridColumn,'2');assert.equal(a.w.getComputedStyle(image).objectFit,'contain');
  a.panel.querySelector('[data-library-layout=list]').click();assert.equal(a.panel.querySelector('[data-template-id=tall]'),card);assert.equal(a.w.getComputedStyle(preview).gridRow,'1 / 4');assert.equal(a.w.localStorage.getItem('mayatnik-library-layout'),'list');
  assert.equal(buttons.querySelector('details,summary'),null);for(const b of buttons.children){const s=a.w.getComputedStyle(b);assert.equal(s.width,'24px');assert.equal(s.height,'24px');assert.equal(b.textContent,'');assert.equal(s.clipPath,'polygon(50% 0,100% 50%,50% 100%,0 50%)');assert.ok(b.querySelector('.mtp-heading-edge'));assert.ok(b.title);assert.ok(b.getAttribute('aria-label'));}
  actions.length=0;a.w.prompt=()=> 'Новое название';for(const b of buttons.children)b.click();await Promise.resolve();assert.deepEqual(actions.map(a=>a[0]),['visible','skip-selection','insert','download','colour','delete-library','save','rename']);assert.ok(visible.querySelector('svg'),'state synchronization preserves the SVG');
  const skip=buttons.querySelector('[data-template-skip]');skip.setAttribute('aria-pressed','true');assert.equal(a.w.getComputedStyle(skip.querySelector('.mtp-heading-edge')).strokeWidth,'2');skip.setAttribute('aria-pressed','false');assert.equal(a.w.getComputedStyle(skip.querySelector('.mtp-heading-edge')).strokeWidth,'1');
  actions.length=0;name.dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,detail:1}));name.dispatchEvent(new a.w.MouseEvent('click',{bubbles:true,detail:2}));name.dispatchEvent(new a.w.MouseEvent('dblclick',{bubbles:true,detail:2,cancelable:true}));await Promise.resolve();assert.deepEqual(actions,[['select','tall'],['rename','tall']],'second native click does not repeat select before renaming');
  a.panel.querySelector('[data-library-layout=tiles]').click();for(const b of buttons.children){assert.equal(a.w.getComputedStyle(b).width,'24px');assert.equal(a.w.getComputedStyle(b).height,'24px');}assert.equal(a.w.getComputedStyle(buttons).flexWrap,'wrap');
 }finally{a.dom.window.close();}
});
