/* DOM/runtime smoke checks; no browser or pixel rendering. Set SETKA_JSDOM to a jsdom package path if it is not installed locally. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let JSDOM,VirtualConsole;
for(const location of ['jsdom',process.env.SETKA_JSDOM,path.join(process.env.TEMP||'/tmp','codex-setka-dom/node_modules/jsdom')].filter(Boolean)){
  try{({JSDOM,VirtualConsole}=require(location));break;}catch{}
}
if(!JSDOM)throw new Error('Startup checks require jsdom. Install it outside the repo and set SETKA_JSDOM to that package directory.');
const old={rows:['111','010','101'],grids:{rows:['10','01'],cur:0,align:'center',text:'',textBlocks:[],colors:{},groups:{},dots:{},lines:{},scenes:[],tool:'',version:1},rmb:{cell:'tri',al:'zz',ln:'each',out:true}};
function boot(savedDock){
  const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
  const html=fs.readFileSync(path.join(__dirname,'Zerkalius-setka.html'),'utf8');
  const dom=new JSDOM(html,{url:'http://setka.test/setka/Zerkalius-setka.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  const w=dom.window,ctx=dom.getInternalVMContext(),frames=new Map();let frame=0;
  w.localStorage.setItem('zazerkalius_v1',JSON.stringify(old));
  if(savedDock)w.localStorage.setItem('setka-menu-dock-v1',JSON.stringify(savedDock));
  Object.defineProperties(w,{innerWidth:{value:1280,writable:true},innerHeight:{value:800,writable:true}});
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top});
  const nativeRect=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.matches('.setka-title'))return rect(0,0,1280,36);
    if(this.id==='mayatnikRail'||this.matches('#mayatnikRail>.gz-rail'))return rect(280,5,996,26);
    if(this.id==='setkaFooter')return rect(4,772,1272,28);
    if(this.matches('#mayatnikRail .gz-group'))return rect(parseFloat(this.style.getPropertyValue('--may-dock-x'))||280,parseFloat(this.style.getPropertyValue('--may-dock-y'))||5,120,24);
    if(this.matches('#mayatnikRail .gz-head'))return this.parentElement.getBoundingClientRect();
    return nativeRect.call(this);
  };
  const nativeRects=w.HTMLElement.prototype.getClientRects;
  w.HTMLElement.prototype.getClientRects=function(){return this.matches('#mayatnikRail .gz-group,#mayatnikRail .gz-head')?[this.getBoundingClientRect()]:nativeRects.call(this);};
  w.requestAnimationFrame=fn=>{frames.set(++frame,fn);return frame;};w.cancelAnimationFrame=id=>frames.delete(id);
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.ResizeObserver=class{observe(){}disconnect(){}};
  w.Path2D=class{moveTo(){}lineTo(){}closePath(){}arc(){}rect(){}addPath(){}};
  const noop=()=>{},context=new Proxy({measureText:t=>({width:String(t).length*7}),getLineDash:()=>[],createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get:(o,k)=>k in o?o[k]:noop});
  w.HTMLCanvasElement.prototype.getContext=function(){context.canvas=this;return context;};
  Object.defineProperties(w.HTMLCanvasElement.prototype,{clientWidth:{get:()=>800},clientHeight:{get:()=>600}});
  w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,right:800,bottom:600,width:800,height:600,x:0,y:0});
  w.SVGElement.prototype.getBBox=()=>({x:0,y:0,width:120,height:24});
  w.HTMLElement.prototype.scrollIntoView=noop;w.HTMLElement.prototype.setPointerCapture=noop;w.HTMLElement.prototype.releasePointerCapture=noop;
  w.confirm=()=>true;w.prompt=()=>null;
  for(const script of [...w.document.querySelectorAll('script[src]')]){
    const file=path.resolve(__dirname,script.getAttribute('src').split('?')[0]);
    vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const flush=()=>{for(let n=0;n<10&&frames.size;n++){const next=[...frames.values()];frames.clear();for(const fn of next)fn(n*16);}assert.equal(frames.size,0,'refresh must settle without a perpetual animation loop');assert.deepEqual(errors,[]);};
  flush();
  return {w,dom,flush,run:code=>vm.runInContext(code,ctx),proxy:id=>w.document.querySelector('#mayatnikRail [data-source="'+id+'"]')};
}
test('real standalone scripts start; every live toolbar control has one proxy; no legacy settings proxy',()=>{
 const app=boot();try{const {w}=app,source=w.document.getElementById('gridsToolbar');assert.equal(source.hidden,true);
  assert.equal(w.document.querySelectorAll('#mayatnikRail .gz-group').length,6);
  const controls=[...source.querySelectorAll('button,input,select,textarea')].filter(e=>e.id!=='bRmbSettings');
  assert.equal(w.document.querySelectorAll('#mayatnikRail [data-pan]').length,controls.length);
  for(const control of controls.filter(e=>e.id))assert.ok(app.proxy(control.id),control.id);
  assert.equal(app.proxy('bRmbSettings'),null);
  for(const id of ['pageUndo','pageRedo','pageHelp','gridsRowsLock','gridsRowAdd'])assert.ok(w.document.getElementById(id).classList.contains('gz-hx'),id);
 }finally{app.dom.window.close();}
});

test('header is one strip; four-edge dragging persists separately and reopening does not move slots',()=>{
 const app=boot();try{const {w}=app,nav=w.document.getElementById('mayatnikRail');assert.equal(nav.parentElement.className,'setka-title');
  const group=nav.querySelector('.gz-group'),head=group.querySelector('.gz-head'),id=group.dataset.id;
  const fire=(target,type,x,y)=>{const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);};
  for(const [edge,x,y] of [['left',64,100],['right',1216,100],['bottom',442,786],['top',592,17]]){
   const before=head.getBoundingClientRect();fire(head,'pointerdown',before.left+60,before.top+12);fire(w,'pointermove',x,y);
   assert.notEqual(w.document.getElementById('mayMenuDockGrid').style.display,'none');
   fire(w,'pointerup',x,y);app.flush();const saved=JSON.parse(w.localStorage.getItem('setka-menu-dock-v1'));
   assert.equal(saved[id].edge,edge);assert.equal(group.dataset.dockEdge,edge);assert.equal(w.localStorage.getItem('mayatnik-menu-dock-v509'),null);
   const restored=boot(saved);try{assert.equal(restored.w.document.querySelector('[data-id="'+id+'"]').dataset.dockEdge,edge);}finally{restored.dom.window.close();}
  }
  const before=[...nav.querySelectorAll('.gz-group')].map(g=>g.style.getPropertyValue('--may-dock-y'));
  group.classList.add('gz-open');w.setkaMenuRefresh();app.flush();
  assert.deepEqual([...nav.querySelectorAll('.gz-group')].map(g=>g.style.getPropertyValue('--may-dock-y')),before);
 }finally{app.dom.window.close();}
});

test('popup rules override shared in-flow menu styles and coordinates remain viewport-fixed',()=>{
 const app=boot({edit:{edge:'bottom',index:0},grid:{edge:'left',index:0},view:{edge:'right',index:4}});try{const {w}=app;
  for(const file of ['../mayatnik/mayatnik-button-standard.css','setka-menu.css']){const s=w.document.createElement('style');s.textContent=fs.readFileSync(path.resolve(__dirname,file),'utf8');w.document.head.append(s);}
  for(const id of ['edit','grid','view']){const g=w.document.querySelector('[data-id="'+id+'"]');g.classList.add('gz-open');const list=g.querySelector('.setka-menu-body');Object.defineProperty(list,'scrollHeight',{value:220});}
  w.setkaMenuRefresh();app.flush();
  for(const id of ['edit','grid','view']){const g=w.document.querySelector('[data-id="'+id+'"]'),list=g.querySelector('.setka-menu-body');assert.equal(w.getComputedStyle(list).position,'fixed');assert.equal(w.getComputedStyle(g).height,'24px');assert.equal(list.style.getPropertyPriority('left'),'important');assert.equal(list.style.getPropertyPriority('top'),'important');}
  const bottom=w.document.querySelector('[data-id="edit"]'),left=w.document.querySelector('[data-id="grid"]');
  // Supply real relative button rectangles to the shared contour builder: its upper
  // cap must remain inside the scrolling popup, rather than being clipped at -10px.
  const box=bottom.querySelector('.setka-menu-body'),padding=parseFloat(w.getComputedStyle(box).paddingTop);
  assert.equal(padding,14);box.getBoundingClientRect=()=>({left:0,top:0,width:120,height:240});
  const cells=[...box.querySelectorAll(':scope > .gz-hx')].filter(e=>!e.hidden);
  cells.forEach((e,i)=>{e.getBoundingClientRect=()=>({left:0,top:padding+i*26,width:120,height:24});});
  w.mayButtonStandardRefresh();
  const cap=box.querySelector('.may-standard-contours .cap');assert.ok(cap,'shared closing cap exists');
  const coords=cap.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);assert.ok(coords.every(n=>n>=0),'upper cap stays inside scroll clip');
  assert.ok(parseFloat(bottom.querySelector('.setka-menu-body').style.top)<bottom.getBoundingClientRect().top);
  assert.equal(parseFloat(left.querySelector('.setka-menu-body').style.left),left.getBoundingClientRect().left);
  assert.ok(parseFloat(left.querySelector('.setka-menu-body').style.top)>left.getBoundingClientRect().bottom);
  const right=w.document.querySelector('[data-id="view"]');assert.equal(parseFloat(right.querySelector('.setka-menu-body').style.left),right.getBoundingClientRect().left);assert.ok(parseFloat(right.querySelector('.setka-menu-body').style.top)>right.getBoundingClientRect().bottom);
 }finally{app.dom.window.close();}
});
test('proxy mode button renders all four grid modes without modifying rows',()=>{
 const app=boot();try{const rows=app.run('JSON.stringify(gridsState().rows)'),seen=[];
  for(let i=0;i<4;i++){seen.push(app.run('rmbSt().cell'));app.proxy('bRmbCell').click();app.flush();assert.equal(app.run('JSON.stringify(gridsState().rows)'),rows);}
  assert.deepEqual(seen,['tri','rmb','square','ring']);
 }finally{app.dom.window.close();}
});
test('import replaces only standalone cells, edits/undo/save leave source rows intact',()=>{
 const app=boot();try{const {w}=app,original=w.localStorage.getItem('zazerkalius_v1');
  app.run("gridsState().colors={'0,0':'#ff0000'};gridsState().dots={'0,0':{color:'#ff0000',size:2}};");
  w.document.getElementById('gridsRowsImport').click();app.flush();
  assert.equal(app.run('JSON.stringify(gridsState().rows)'),JSON.stringify(old.rows));
  assert.equal(app.run('Object.keys(gridsState().colors).length'),0);assert.equal(app.run('Object.keys(gridsState().dots).length'),0);
  app.proxy('gridsClear').click();app.flush();assert.equal(app.run('gridsState().rows.some(row=>row.includes("1"))'),false);
  w.document.getElementById('pageUndo').click();app.flush();assert.equal(app.run('JSON.stringify(gridsState().rows)'),JSON.stringify(old.rows));
  assert.equal(w.localStorage.getItem('zazerkalius_v1'),original);
  assert.equal(app.run('Z.rows'),undefined);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('zerklus_setka_v1')).grids.rows,old.rows);
 }finally{app.dom.window.close();}
});
test('dynamic scene choices and native field proxies update live sources, visibility and disabled states',()=>{
 const app=boot();try{const {w}=app;
  app.proxy('gridsSceneNew').click();app.flush();
  const scene=app.proxy('gridsScenes'),options=scene.gzList.options();assert.ok(options.some(o=>o.name==='Сцена 1'));
  const number=app.proxy('gridsStroke').querySelector('input');number.value='7';number.dispatchEvent(new w.Event('input',{bubbles:true}));app.flush();assert.equal(w.document.getElementById('gridsStroke').value,'7');
  const color=app.proxy('gridsColor').querySelector('input');color.value='#abcdef';color.dispatchEvent(new w.Event('input',{bubbles:true}));app.flush();assert.equal(w.document.getElementById('gridsColor').value,'#abcdef');
  assert.equal(app.proxy('bRmbAxisApply').hidden,true);app.proxy('bRmbAxis').click();app.flush();assert.equal(app.proxy('bRmbAxisApply').hidden,false);assert.equal(app.proxy('bRmbAxisApply').getAttribute('aria-disabled'),'true');
  const head=w.document.querySelector('#mayatnikRail .gz-head'),pin=head.querySelector('.gz-pin');pin.click();app.flush();assert.ok(head.parentElement.classList.contains('gz-pinned'));assert.ok(JSON.parse(w.localStorage.getItem('grozd:setka')).pin.includes(head.parentElement.dataset.id));
 }finally{app.dom.window.close();}
});
test('dynamic letter actions use shared buttons and retain deletion handlers',()=>{
 const app=boot();try{const {w}=app;w.prompt=()=> 'А';app.proxy('bRmbType').click();app.flush();
  const stats=w.document.getElementById('rmbTextStats');assert.equal(stats.hidden,false);
  const buttons=[...stats.querySelectorAll('button')];assert.ok(buttons.length>=2);assert.ok(buttons.every(b=>b.classList.contains('gz-hx')));
  assert.equal(stats.querySelectorAll('th.gz-hx,td.gz-hx').length,0,'numeric table cells keep their existing form');
  const erase=buttons.find(b=>/все|всё/i.test(b.title));assert.ok(erase);erase.click();app.flush();assert.equal(stats.hidden,true);
 }finally{app.dom.window.close();}
});
