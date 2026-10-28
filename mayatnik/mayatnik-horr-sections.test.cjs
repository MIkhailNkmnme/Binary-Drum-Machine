const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'jsdom'),Search=require('./mayatnik-button-search.js');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),standard=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8');
const mount=menu.slice(menu.indexOf('  function mountHorrSections('),menu.indexOf('  window.mayHorrSections ='));
const ids=['size','build','fields','overlay','run'];
function fixture(storage={}){
 const dom=new JSDOM('<div id="paintTools"><div class="gz-group gz-open" data-id="horr"><button class="gz-head">Хорр</button><div class="gz-wide"><div class="gz-hx gz-pair" data-horr-section="build"><span>Построить</span></div><button class="gz-hx" data-horr-section="size">Размер 512</button><div class="may-rows-custom" data-horr-section="size"><input aria-label="Число строк" value="512"><button class="gz-hx">Задать</button></div><button class="gz-hx" data-horr-section="fields" id="mayCompareField">Поле</button><button class="gz-hx" data-horr-section="overlay" id="mayCompareP123">Все три</button><button class="gz-hx" data-horr-section="run" data-n="testBuildMode" hidden disabled>Сборка кадров</button><button class="gz-hx" data-horr-section="run" data-n="testFrameSave">Запомнить</button><button class="gz-hx" data-n="bReset">Сброс</button><button class="gz-hx" data-n="resetTransport">Стоп</button></div></div></div>',{url:'https://test/',pretendToBeVisual:true,runScripts:'outside-only'}),w=dom.window,doc=w.document,group=doc.querySelector('.gz-group'),nodes=[...group.querySelectorAll('[data-horr-section]')];
 const rect={left:20,top:80,right:140,bottom:104,width:120,height:24};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return this.rect||rect};
 w.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden],[data-horr-inactive="true"],.may-horr-home')?[]:[this.getBoundingClientRect()]};
 const keyNodes=[...group.querySelectorAll('button,.gz-hx,[role="button"]')].filter(n=>!n.matches('.gz-head'));
 let calls=0;for(const node of keyNodes)node.onclick=()=>calls++;
 for(const [key,value]of Object.entries(storage))w.localStorage.setItem(key,value);
 const ctx={document:doc,getComputedStyle:w.getComputedStyle.bind(w),icon:(node,kind)=>'url("'+kind+'")',controlSelector:'button,.gz-hx,[role="button"]'};vm.createContext(ctx);
 vm.runInContext(mount+';globalThis.mount=mountHorrSections;',ctx);
 const keyCode=standard.slice(standard.indexOf('  function controlKey('),standard.indexOf('  function miniGlyph('));vm.runInContext(keyCode+';globalThis.key=controlKey;',ctx);
 const before=keyNodes.map(node=>[node,node.parentElement,ctx.key(node)]),api=ctx.mount(group,{storage:w.localStorage});
 return{dom,w,doc,group,nodes,before,api,key:ctx.key,get calls(){return calls},close(){api.destroy();dom.window.close()}};
}
test('five ordinary buttons replace selector; settings start closed without disturbing saved section',()=>{
 const f=fixture({'mayatnik-horr-section-v1':'overlay'});try{
  assert.equal(f.api.get(),null);assert.equal(f.doc.querySelector('[data-n="horrSection"]'),null);assert.deepEqual([...f.api.buttons.keys()],ids);
  assert.deepEqual([...f.api.buttons.values()].map(b=>b.textContent),['Размер','Построение','Поля','Наложение','Прогон']);
  for(const b of f.api.buttons.values()){assert.equal(b.tagName,'BUTTON');assert.equal(b.gzList,undefined);assert.equal(b.getAttribute('aria-expanded'),'false');}
  for(const node of f.nodes)assert.equal(node.inert,true);
  assert.equal(f.w.localStorage.getItem('mayatnik-horr-section-v1'),'overlay');assert.equal(f.w.localStorage.getItem('mayatnik-horr-section-open-v1'),null);
 }finally{f.close();}
});
test('all subgroups retain live nodes, parents, handlers, mini keys, common commands and hidden/disabled flags',()=>{
 const f=fixture({'mayatnik-dd-pins':'["horr"]','mayatnik-control-mini-v464':'["old"]'});try{
  for(const id of ids){f.api.buttons.get(id).click();assert.equal(f.api.get(),id);assert.equal(f.api.popup.parentNode,f.doc.body);assert.equal(f.api.popup.hidden,false);
   assert.equal(f.api.popup.querySelector('.gz-wide'),f.before[0][1]);
   for(const [node,parent,key]of f.before){assert.equal(f.key(node),key);assert.equal(typeof node.onclick,'function');if(node.closest('[data-horr-section]'))assert.equal(node.parentElement,parent);}
   for(const node of f.nodes){assert.equal(node.dataset.horrInactive,String(node.dataset.horrSection!==id));assert.equal(node.inert,node.dataset.horrSection!==id);}
   for(const button of f.api.buttons.values())assert.equal(f.group.contains(button),true);
   for(const cmd of ['bReset','resetTransport'])assert.equal(f.group.contains(f.doc.querySelector('[data-n="'+cmd+'"]')),true);
  }
  f.api.buttons.get('run').click();assert.equal(f.api.get(),null);assert.equal(f.api.popup.hidden,true);assert.equal(f.group.contains(f.before[0][0]),true);
  assert.equal(f.calls,0);assert.equal(f.w.localStorage.getItem('mayatnik-dd-pins'),'["horr"]');assert.equal(f.w.localStorage.getItem('mayatnik-control-mini-v464'),'["old"]');
  const mode=f.doc.querySelector('[data-n="testBuildMode"]');assert.equal(mode.hidden,true);assert.equal(mode.disabled,true);
 }finally{f.close();}
});
test('open state survives reload separately from last section; closing and invalid legacy values are safe',()=>{
 const f=fixture();f.api.choose('overlay');const saved=Object.fromEntries(Object.entries(f.w.localStorage));f.close();
 const g=fixture(saved),h=fixture({'mayatnik-horr-section-v1':'obsolete'});try{
  assert.equal(g.api.get(),'overlay');g.api.choose(null);assert.equal(g.w.localStorage.getItem('mayatnik-horr-section-v1'),'overlay');assert.equal(g.w.localStorage.getItem('mayatnik-horr-section-open-v1'),'0');
  assert.equal(h.api.get(),null);assert.equal(h.w.localStorage.getItem('mayatnik-horr-section-v1'),'obsolete');
 }finally{g.close();h.close();}
});
test('outside click, Escape and keyboard navigation preserve focus and never execute settings',()=>{
 const f=fixture();try{
  const size=f.api.buttons.get('size');size.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(f.api.get(),'size');assert.equal(f.doc.activeElement,f.nodes.find(n=>n.matches('button[data-horr-section="size"]')));
  f.doc.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(f.api.get(),null);assert.equal(f.doc.activeElement,size);
  size.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(f.doc.activeElement,f.api.buttons.get('build'));assert.equal(f.calls,0);
  f.api.choose('size');f.nodes.find(n=>n.matches('button[data-horr-section="size"]')).focus();f.api.choose('fields');assert.equal(f.doc.activeElement,f.api.buttons.get('fields'));
  f.doc.body.dispatchEvent(new f.w.Event('pointerdown',{bubbles:true}));assert.equal(f.api.get(),null);
 }finally{f.close();}
});
test('popup flips at right edge and returns home while parent is folded',async()=>{
 const f=fixture();try{
  const button=f.api.buttons.get('size');f.api.choose('size');assert.equal(f.api.popup.dataset.side,'right');
  button.rect={left:890,right:1010,top:500,bottom:524,width:120,height:24};f.api.place();assert.equal(f.api.popup.dataset.side,'left');assert.equal(f.api.popup.style.left,'764px');
  f.group.classList.remove('gz-open');await Promise.resolve();assert.equal(f.api.popup.hidden,true);assert.equal(f.group.contains(f.nodes[0]),true);
  f.group.classList.add('gz-open');await Promise.resolve();assert.equal(f.api.popup.hidden,false);assert.equal(f.api.get(),'size');
 }finally{f.close();}
});
test('search collects inactive controls at home/in portal and reveals logical group without execution or persistence',async()=>{
 const f=fixture();let search;try{
  const field=f.doc.getElementById('mayCompareField');f.w.mayMenuSearchReveal=(group,target)=>{assert.equal(group,f.group);return f.api.reveal(target);};
  search=Search.create({document:f.doc,window:f.w});f.w.mayButtonSearch=search;assert.ok(search.find('поле').some(r=>r.node===field));f.api.choose('size');
  const before=Object.fromEntries(Object.entries(f.w.localStorage)),record=search.find('поле').find(r=>r.node===field);assert.ok(record);assert.equal(field.inert,true);
  await search.choose(record);assert.equal(f.api.get(),'fields');assert.equal(field.inert,false);assert.equal(search.getState().current,field);assert.equal(f.calls,0);assert.deepEqual(Object.fromEntries(Object.entries(f.w.localStorage)),before);
  field.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(search.getState().current,null);assert.equal(f.api.get(),'size');
 }finally{search?.destroy();f.close();}
});
test('production mini toggles work in portal and persist after close/reopen, with standard outlines and contour',()=>{
 const f=fixture();try{
  f.w.eval(standard);f.api.choose('fields');f.w.mayButtonStandardRefresh();
  const node=f.doc.getElementById('mayCompareField');assert.ok(node.querySelector('.may-standard-outline'));
  node.dispatchEvent(new f.w.MouseEvent('contextmenu',{bubbles:true,button:2}));assert.equal(node.classList.contains('may-control-mini'),true);
  assert.ok(JSON.parse(f.w.localStorage.getItem('mayatnik-control-mini-v464')).includes('id:mayCompareField'));
  f.api.choose(null);f.api.choose('fields');f.w.mayButtonStandardRefresh();assert.equal(node.classList.contains('may-control-mini'),true);assert.ok(f.api.popup.querySelector(':scope>.may-standard-contours'));
 }finally{f.close();}
});
test('clicking another main subgroup during search commits that choice instead of restoring temporary opening',async()=>{
 const f=fixture();let search;try{
  f.group.classList.remove('gz-open');f.w.mayMenuSearchReveal=(_,target)=>f.api.reveal(target);
  search=Search.create({document:f.doc,window:f.w});f.w.mayButtonSearch=search;
  await search.choose(search.find('все три')[0]);assert.equal(f.api.get(),'overlay');
  const size=f.api.buttons.get('size');size.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0}));assert.equal(f.api.popup.hidden,false);assert.ok(f.group.classList.contains('gz-open'));
  size.click();await new Promise(resolve=>f.w.requestAnimationFrame(resolve));
  assert.equal(search.getState().current,null);assert.equal(f.api.get(),'size');assert.equal(f.api.popup.hidden,false);assert.ok(f.group.classList.contains('gz-open'));
  assert.equal(f.w.localStorage.getItem('mayatnik-horr-section-v1'),'size');assert.equal(f.calls,0);
 }finally{search?.destroy();f.close();}
});
test('production preserves independent row-run and assembly handlers',()=>{
 assert.match(menu,/const mbRows = mkMode\('Сборка строк'\), mbFrames = mkMode\('Сборка кадров'\)/);
 assert.match(menu,/mbRows\.hidden = comparison \|\| fr; mbFrames\.hidden = comparison \|\| !fr/);
 assert.match(menu,/label: 'Прогон', tip: rowRunTitle/);assert.match(menu,/bR\?\.click\(\); bp\.gzSync/);
 assert.match(menu,/window\.mayTestBuildMode\?\.toggle\?\.\(\);\s*window\.mayTestPrepare\?\.\(\)/);
});
test('real root outside guard keeps portal mounted between pointerdown and the original click handler',async()=>{
 const f=fixture();try{
  f.w.mayHorrSections=f.api;
  const ctx={window:f.w,activeList:null,ups:()=>[f.group],rail:{close(){f.group.classList.remove('gz-open')}},addEventListener:f.w.addEventListener.bind(f.w)};vm.createContext(ctx);
  const fn=menu.slice(menu.indexOf('  function popupContains('),menu.indexOf('  const clearListUnder ='));
  const guard=menu.split('\n').find(line=>line.includes("addEventListener('pointerdown'")&&line.includes('for (const b of ups())'));
  vm.runInContext(fn+guard,ctx);f.api.choose('fields');const field=f.doc.getElementById('mayCompareField');
  field.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0}));await Promise.resolve();assert.equal(f.api.popup.hidden,false);assert.ok(f.group.classList.contains('gz-open'));
  field.click();assert.equal(f.calls,1);
  f.doc.body.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0}));await Promise.resolve();assert.equal(f.api.popup.hidden,true);assert.equal(f.group.classList.contains('gz-open'),false);
 }finally{f.close();}
});
