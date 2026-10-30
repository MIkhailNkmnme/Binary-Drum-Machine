const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('C:/Users/Mhl/AppData/Local/Temp/codex-setka-dom/node_modules/jsdom');
const menu=fs.readFileSync(__dirname+'/mayatnik-menu.js','utf8');
function fixture(){
 const dom=new JSDOM('<div id="mayatnikRail"></div><header><div id="paintTools"><div class="gz-group gz-open may-menu-side-stack may-docked may-dock-side" data-id="gifscale"><button class="gz-head"></button><div class="gz-soty"><button class="gz-hx">Record</button></div><div class="gz-wide"><button class="gz-hx">Sequence</button></div></div></div></header>'),doc=dom.window.document,box=doc.querySelector('.gz-group'),head=box.querySelector('.gz-head');
 head.getBoundingClientRect=()=>({left:14,top:137,bottom:161});
 const ctx={document:doc,innerWidth:1440,innerHeight:1000,pushStrip(){}};
 ctx.mobileMenu={get matches(){return ctx.innerWidth<=600;}};
 vm.createContext(ctx);vm.runInContext(menu.slice(menu.indexOf('  function syncRailFlyouts()'),menu.indexOf('  function pushStrip()')),ctx);
 return{dom,doc,box,head,ctx,sync:()=>ctx.syncRailFlyouts(),get list(){return box.querySelector('.may-rail-list')}};
}
test('left and right side docks clear floating important offsets and retain live controls in flow',()=>{
 const f=fixture();try{
  for(const edge of ['left','right']){
   f.box.dataset.dockEdge=edge;f.sync();const list=f.list,buttons=[...list.querySelectorAll('button')];let clicks=0;buttons[0].onclick=()=>clicks++;
   list.style.cssText='left:14px!important;top:163px!important;max-height:24px;overflow:auto;padding-bottom:14px!important';
   Object.defineProperty(list,'scrollHeight',{value:1000,configurable:true});f.sync();
   assert.equal(list.style.cssText,'',edge+' resets stale viewport coordinates and internal scroll');
   assert.equal(f.head.getAttribute('aria-expanded'),'true');assert.deepEqual([...list.querySelectorAll('button')],buttons);
   buttons[0].click();assert.equal(clicks,1);f.sync();assert.equal(list.style.cssText,'');
  }
 }finally{f.dom.window.close();}
});
test('side dock moves to floating top/bottom and mobile, then restores flow without retaining offsets',()=>{
 const f=fixture();try{
  f.sync();const list=f.list;
  for(const bottom of [false,true]){
   f.box.classList.remove('may-dock-side');f.box.classList.toggle('pt-bot',bottom);f.sync();
   assert.equal(list.style.maxHeight,bottom?'123px':'823px');
   if(!bottom){assert.equal(list.style.left,'14px');assert.equal(list.style.top,'163px');assert.equal(list.style.getPropertyPriority('top'),'important');}
   f.box.classList.add('may-dock-side');f.sync();assert.equal(list.style.cssText,'');
  }
  f.box.classList.remove('pt-bot');f.ctx.innerWidth=390;f.sync();assert.equal(list.style.top,'163px');
  f.ctx.innerWidth=1440;f.sync();assert.equal(list.style.cssText,'');
  f.box.classList.remove('gz-open');f.sync();assert.equal(f.head.getAttribute('aria-expanded'),'false');assert.equal(list.style.cssText,'');
 }finally{f.dom.window.close();}
});
test('original rail retains flow while a regular top group retains viewport positioning',()=>{
 const f=fixture();try{
  f.box.classList.remove('may-dock-side');f.sync();assert.equal(f.list.style.top,'163px');
  f.doc.getElementById('mayatnikRail').append(f.box);f.sync();assert.equal(f.list.style.cssText,'');assert.equal(f.head.getAttribute('aria-expanded'),'true');
 }finally{f.dom.window.close();}
});
