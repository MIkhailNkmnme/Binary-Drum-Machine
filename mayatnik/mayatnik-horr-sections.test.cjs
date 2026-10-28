const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require(process.env.SETKA_JSDOM||'jsdom'),Search=require('./mayatnik-button-search.js');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8'),standard=fs.readFileSync(__dirname+'/mayatnik-button-standard.js','utf8');
const mount=menu.slice(menu.indexOf('  function mountHorrSections('),menu.indexOf('  window.mayHorrSections ='));
function fixture(storage={}){
 const dom=new JSDOM('<div id="paintTools"><div class="gz-group" data-id="horr"><button class="gz-head">Хорр</button><div class="gz-wide"><div class="gz-hx gz-pair" data-horr-section="build"><span>Построить</span></div><button class="gz-hx" data-horr-section="size">Размер</button><div class="may-rows-custom" data-horr-section="size"><button class="gz-hx">Задать</button></div><button class="gz-hx" data-horr-section="fields" id="mayCompareField">Поле</button><button class="gz-hx" data-horr-section="overlay" id="mayCompareP123">Все три</button><button class="gz-hx" data-horr-section="run" data-n="testBuildMode" hidden disabled>Сборка кадров</button><button class="gz-hx" data-horr-section="run" data-n="testFrameSave">Запомнить</button><button class="gz-hx" data-n="bReset">Сброс</button><button class="gz-hx" data-n="resetTransport">Стоп</button></div></div></div>',{url:'https://test/',pretendToBeVisual:true}),w=dom.window,doc=w.document,group=doc.querySelector('.gz-group'),nodes=[...group.querySelectorAll('[data-horr-section]')];
 const keyNodes=[...new Set([...nodes,...nodes.flatMap(node=>[...node.querySelectorAll('button,.gz-hx,[role="button"]')])])];
 let calls=0,refreshes=0;for(const node of keyNodes)node.onclick=()=>calls++;
 for(const [key,value]of Object.entries(storage))w.localStorage.setItem(key,value);
 const ctx={document:doc,getComputedStyle:w.getComputedStyle.bind(w),icon:(node,kind)=>'url("'+kind+'")',controlSelector:'button,.gz-hx,[role="button"]'};vm.createContext(ctx);
 vm.runInContext(mount+';globalThis.mount=mountHorrSections;',ctx);
 const keyCode=standard.slice(standard.indexOf('  function controlKey('),standard.indexOf('  function miniGlyph('));vm.runInContext(keyCode+';globalThis.key=controlKey;',ctx);
 const before=keyNodes.map(node=>[node,node.parentElement,ctx.key(node)]),api=ctx.mount(group,{storage:w.localStorage,listHover:(b,o)=>b.gzList=o,after:()=>refreshes++});
 return{dom,w,doc,group,nodes,before,api,key:ctx.key,get calls(){return calls},get refreshes(){return refreshes}};
}
test('five sections keep every live node, handlers, parent and old mini key; choosing a section never executes commands',()=>{
 const f=fixture({'mayatnik-dd-pins':'["horr"]','mayatnik-control-mini-v464':'["old"]'});try{
  assert.equal(f.api.get(),'size');assert.equal(f.api.button.getAttribute('aria-label'),'Раздел Хорра: Размер');assert.equal(f.refreshes,0);
  assert.deepEqual(Array.from(f.api.button.gzList.options(),x=>x.key),['size','build','fields','overlay','run']);
  const icons=f.api.button.gzList.options().map(option=>option.icon);assert.equal(new Set(icons).size,5);assert.deepEqual(Array.from(f.api.button.gzList.options(),option=>option.icon),Array.from(icons));
  for(const option of f.api.button.gzList.options()){option.pick();for(const [node,parent,key]of f.before){assert.equal(node.parentElement,parent);assert.equal(f.key(node),key);}
  for(const node of f.nodes){assert.equal(node.dataset.horrInactive,String(node.dataset.horrSection!==option.key));assert.equal(node.inert,node.dataset.horrSection!==option.key);}}
  for(const [node,parent,key]of f.before){assert.equal(node.parentElement,parent);assert.equal(f.key(node),key);assert.equal(typeof node.onclick,'function');}
  assert.equal(f.calls,0);assert.equal(f.w.localStorage.getItem('mayatnik-dd-pins'),'["horr"]');assert.equal(f.w.localStorage.getItem('mayatnik-control-mini-v464'),'["old"]');
  const mode=f.doc.querySelector('[data-n="testBuildMode"]');assert.equal(mode.hidden,true);assert.equal(mode.disabled,true);
  for(const id of ['bReset','resetTransport'])assert.equal(f.doc.querySelector('[data-n="'+id+'"]').inert,undefined);
 }finally{f.dom.window.close();}
});
test('section survives reload and invalid stored values fall back without rewriting existing storage',()=>{
 const f=fixture();f.api.choose('overlay');const saved=f.w.localStorage.getItem('mayatnik-horr-section-v1');f.dom.window.close();
 const g=fixture({'mayatnik-horr-section-v1':saved}),h=fixture({'mayatnik-horr-section-v1':'obsolete'});try{assert.equal(g.api.get(),'overlay');assert.equal(h.api.get(),'size');assert.equal(h.w.localStorage.getItem('mayatnik-horr-section-v1'),'obsolete');}finally{g.dom.window.close();h.dom.window.close();}
});
test('focus leaves a section before its controls become inaccessible; hidden and disabled mode flags remain untouched',()=>{
 const f=fixture();try{const size=f.nodes.find(n=>n.dataset.horrSection==='size');size.focus();assert.equal(f.doc.activeElement,size);f.api.choose('fields');assert.equal(f.doc.activeElement,f.api.button);assert.equal(size.inert,true);assert.equal(f.doc.querySelector('[data-n="testBuildMode"]').hidden,true);}finally{f.dom.window.close();}
});
test('search finds inactive sections and default reveal forwards the actual target before highlighting, without command execution or persistence',async()=>{
 const f=fixture(),rect={left:10,top:10,right:130,bottom:34,width:120,height:24};let search;
 try{
  const field=f.doc.getElementById('mayCompareField');field.getClientRects=()=>field.inert?[]:[rect];field.getBoundingClientRect=()=>rect;
  f.w.mayMenuSearchReveal=(group,target)=>{assert.equal(group,f.group);assert.equal(target,field);f.api.reveal(target);};
  search=Search.create({document:f.doc,window:f.w});const record=search.find('поле').find(r=>r.node===field);assert.ok(record);assert.equal(field.inert,true);
  await search.choose(record);assert.equal(f.api.get(),'fields');assert.equal(field.inert,false);assert.equal(search.getState().current,field);assert.equal(f.calls,0);assert.equal(f.w.localStorage.getItem('mayatnik-horr-section-v1'),null);
 }finally{search?.destroy();f.dom.window.close();}
});
test('production controls retain all five category assignments and both independent transports',()=>{
 for(const section of ['size','build','fields','overlay','run'])assert.ok(menu.includes("section(" )&&menu.includes("'"+section+"'"));
 assert.match(menu,/const mbRows = mkMode\('Сборка строк'\), mbFrames = mkMode\('Сборка кадров'\)/);
 assert.match(menu,/mbRows\.hidden = comparison \|\| fr; mbFrames\.hidden = comparison \|\| !fr/);
 assert.match(menu,/label: 'Прогон', tip: rowRunTitle/);assert.match(menu,/bR\?\.click\(\); bp\.gzSync/);
 assert.match(menu,/window\.mayTestBuildMode\?\.toggle\?\.\(\);\s*window\.mayTestPrepare\?\.\(\)/);
});
