/* DOM/runtime smoke checks; no browser or pixel rendering. Set SETKA_JSDOM to a jsdom package path if it is not installed locally. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let JSDOM,VirtualConsole;
for(const location of ['jsdom',process.env.SETKA_JSDOM,path.join(process.env.TEMP||'/tmp','codex-setka-dom/node_modules/jsdom')].filter(Boolean)){
  try{({JSDOM,VirtualConsole}=require(location));break;}catch{}
}
if(!JSDOM)throw new Error('Startup checks require jsdom. Install it outside the repo and set SETKA_JSDOM to that package directory.');
const old={rows:['111','010','101'],grids:{rows:['10','01'],cur:0,align:'center',text:'',textBlocks:[],colors:{},groups:{},dots:{},lines:{},scenes:[],tool:'',version:1},rmb:{cell:'tri',al:'zz',ln:'each',out:true}};
function boot(savedDock,ownState){
  const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
  const html=fs.readFileSync(path.join(__dirname,'Zerkalius-setka.html'),'utf8');
  const dom=new JSDOM(html,{url:'http://setka.test/setka/Zerkalius-setka.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  const w=dom.window,ctx=dom.getInternalVMContext(),frames=new Map();let frame=0;
  w.localStorage.setItem('zazerkalius_v1',JSON.stringify(old));
  if(ownState)w.localStorage.setItem('zerklus_setka_v1',JSON.stringify(ownState));
  if(savedDock)w.localStorage.setItem('setka-menu-dock-v1',JSON.stringify(savedDock));
  Object.defineProperties(w,{innerWidth:{value:1280,writable:true},innerHeight:{value:800,writable:true}});
  const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top});
  const nativeRect=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    if(this.matches('.setka-title'))return rect(0,0,1280,36);
    if(this.id==='mayatnikRail'||this.matches('#mayatnikRail>.gz-rail'))return rect(280,5,996,26);
    if(this.id==='setkaFooter')return rect(4,772,1272,28);
    if(this.matches('#mayatnikRail .gz-group'))return rect(parseFloat(this.style.getPropertyValue('--may-dock-x'))||280,parseFloat(this.style.getPropertyValue('--may-dock-y'))||5,120,24+(this.matches('.may-menu-side-stack.may-dock-side.gz-open')?(this.querySelector('.setka-menu-body')?.scrollHeight||0):0));
    if(this.matches('#mayatnikRail .gz-head')){const r=this.parentElement.getBoundingClientRect();return rect(r.left,r.top,120,24);}
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
  assert.equal(w.document.querySelectorAll('#mayatnikRail .gz-group').length,7);
  const controls=[...source.querySelectorAll('button,input,select,textarea')].filter(e=>e.id!=='bRmbSettings');
  assert.equal(w.document.querySelectorAll('#mayatnikRail [data-pan]').length,controls.length-source.querySelectorAll('[data-setka-pair]').length);
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
  for(const id of ['edit','grid','view']){const g=w.document.querySelector('[data-id="'+id+'"]'),list=g.querySelector('.setka-menu-body');if(id==='edit'){assert.equal(w.getComputedStyle(list).position,'fixed');assert.equal(w.getComputedStyle(g).height,'24px');assert.equal(list.style.getPropertyPriority('left'),'important');assert.equal(list.style.getPropertyPriority('top'),'important');}else{assert.equal(w.getComputedStyle(list).position,'relative');assert.equal(w.getComputedStyle(g).height,'auto');assert.equal(list.style.left,'');assert.equal(list.style.top,'');}}
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
  assert.ok(left.classList.contains('may-menu-side-stack'));
  const right=w.document.querySelector('[data-id="view"]');assert.ok(right.classList.contains('may-menu-side-stack'));
 }finally{app.dom.window.close();}
});
test('proxy mode button renders all four grid modes without modifying rows',()=>{
 const app=boot();try{const rows=app.run('JSON.stringify(gridsState().rows)'),seen=[];
  for(let i=0;i<4;i++){seen.push(app.run('rmbSt().cell'));app.proxy('bRmbCell').click();app.flush();assert.equal(app.run('JSON.stringify(gridsState().rows)'),rows);}
  assert.deepEqual(seen,['tri','rmb','square','ring']);
 }finally{app.dom.window.close();}
});

test('shared side stack pushes following groups, scrolls overflow and restores saved slots',()=>{
 const app=boot({edit:{edge:'left',index:0},grid:{edge:'left',index:1},view:{edge:'right',index:0},draw:{edge:'right',index:1}});
 try{const {w}=app,saved=w.localStorage.getItem('setka-menu-dock-v1');
  for(const [edge,first,next] of [['left','edit','grid'],['right','view','draw']]){
   const group=w.document.querySelector('[data-id="'+first+'"]'),lower=w.document.querySelector('[data-id="'+next+'"]'),body=group.querySelector('.setka-menu-body');
   group.classList.remove('gz-open');w.setkaMenuRefresh();app.flush();const original=lower.getBoundingClientRect().top;
   Object.defineProperty(body,'scrollHeight',{configurable:true,value:780});group.classList.add('gz-open');w.setkaMenuRefresh();app.flush();
   assert.ok(lower.getBoundingClientRect().top>=group.getBoundingClientRect().bottom,'opened group pushes following header');
   const bar=w.document.querySelector('.may-menu-side-scroll[data-edge="'+edge+'"]');assert.equal(bar.style.display,'block');
   body.dispatchEvent(new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:1000}));app.flush();
   assert.ok(bar.scrollTop>0);assert.ok(lower.getBoundingClientRect().bottom<=770,'scroll exposes last header');
   assert.equal(w.localStorage.getItem('setka-menu-dock-v1'),saved,'temporary push/scroll must not rewrite slots');
   group.classList.remove('gz-open');w.setkaMenuRefresh();app.flush();assert.equal(lower.getBoundingClientRect().top,original);assert.equal(bar.scrollTop,0);assert.equal(bar.style.display,'none');
  }
  app.run("rmbSt().bg='#123456';renderRmb();");assert.equal(w.document.documentElement.style.getPropertyValue('--bg'),'#123456');
 }finally{app.dom.window.close();}
});

test('scene dropdown opens beside its whole group on either edge; history lives at bottom',()=>{
 const app=boot();try{const {w}=app,scene=app.proxy('gridsScenes'),body=scene.closest('.setka-menu-body');
  assert.equal(scene.gzList.col(),body);assert.equal(scene.gzList.placement,undefined);
  Object.defineProperty(w.HTMLElement.prototype,'offsetWidth',{configurable:true,get(){return this.classList.contains('gz-ladder')?120:0;}});
  Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{configurable:true,get(){return this.classList.contains('gz-ladder')?104:0;}});
  for(const left of [4,1156]){
   body.getBoundingClientRect=()=>({left,right:left+120,top:50,bottom:450,width:120,height:400});
   scene.getBoundingClientRect=()=>({left:left+4,right:left+116,top:120,bottom:144,width:112,height:24});
   scene.getClientRects=()=>[scene.getBoundingClientRect()];scene.click();app.flush();
   const list=w.document.querySelector('.gz-ladder');assert.ok(list);const x=parseFloat(list.style.left);
   assert.ok(x>=left+124||x+120<=left-4,'dropdown must not overlap its parent column');
   assert.ok(x>=4&&x+120<=1276,'dropdown stays in viewport');
   scene.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  }
  for(const id of ['pageUndo','pageRedo']){assert.ok(w.document.getElementById(id).closest('#setkaFooter'));assert.equal(w.document.querySelector('.setka-title #'+id),null);}
  assert.equal(w.document.getElementById('setkaFooter').hasAttribute('aria-hidden'),false);
 }finally{app.dom.window.close();}
});
test('Hub templates replace only standalone cells, edits/undo/save leave source rows intact',()=>{
 const app=boot();try{const {w}=app,original=w.localStorage.getItem('zazerkalius_v1');
  app.run("gridsState().colors={'0,0':'#ff0000'};gridsState().dots={'0,0':{color:'#ff0000',size:2}};");
  w.document.getElementById('gridsTemplateBase').click();app.flush();const expected=app.run('JSON.stringify(ZZ_INITIAL_ROWS.filter((_,i)=>i!==1))');assert.deepEqual(JSON.parse(expected).slice(0,5),['1','11','111','1000','10101']);
  assert.equal(app.run('JSON.stringify(gridsState().rows)'),expected);
  assert.equal(app.run('Object.keys(gridsState().colors).length'),0);assert.equal(app.run('Object.keys(gridsState().dots).length'),0);
  app.proxy('gridsClear').click();app.flush();assert.equal(app.run('gridsState().rows.some(row=>row.includes("1"))'),false);
  w.document.getElementById('pageUndo').click();app.flush();assert.equal(app.run('JSON.stringify(gridsState().rows)'),expected);
  assert.equal(w.localStorage.getItem('zazerkalius_v1'),original);
  assert.equal(app.run('Z.rows'),undefined);
  assert.equal(JSON.stringify(JSON.parse(w.localStorage.getItem('zerklus_setka_v1')).grids.rows),expected);w.document.getElementById('gridsTemplateSerp').click();app.flush();assert.deepEqual(JSON.parse(app.run('JSON.stringify(gridsState().rows.slice(0,5))')),['1','11','101','1111','10001']);assert.equal(w.document.getElementById('gridsRowsImport').hidden,true);
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

test('help floats above the field, stays open inside and closes outside or on Escape',()=>{
 const app=boot();try{const {w}=app,button=w.document.getElementById('pageHelp'),panel=w.document.getElementById('setkaHelpPanel'),root=w.document.getElementById('w-rmb');
  const style=w.document.createElement('style');style.textContent=fs.readFileSync(path.join(__dirname,'setka-menu.css'),'utf8');w.document.head.append(style);
  const before=app.run('JSON.stringify(rmbSt())');button.click();assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(w.getComputedStyle(panel).position,'fixed');
  panel.querySelector('p').click();assert.ok(root.classList.contains('setka-help'));
  w.document.getElementById('rmbCv').click();assert.equal(root.classList.contains('setka-help'),false);assert.equal(button.getAttribute('aria-expanded'),'false');
  button.click();panel.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));assert.equal(root.classList.contains('setka-help'),false);
  assert.equal(app.run('JSON.stringify(rmbSt())'),before);
 }finally{app.dom.window.close();}
});

test('plain mouse drag moves every bit even with brush, erase, edit selection or axis active',()=>{
 const app=boot();try{const {w}=app,cv=w.document.getElementById('rmbCv');
  const fire=(type,x,y,extra={})=>{const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y,...extra});Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:'mouse'}});cv.dispatchEvent(e);};
  for(const mode of ['view','brush','erase','edit','axis']){
   app.run("gridsState().tool='';Object.assign(rmbSt(),{edit:false,axisMode:false,cell:'square',s:20,ox:100,oy:100});renderRmb();");
   if(mode==='brush'||mode==='erase')app.run("gridsState().tool='"+mode+"';");
   if(mode==='edit')app.run("rmbSt().edit=true;rmbEditor.setSelection([[0,0]]);");
   if(mode==='axis')app.run('rmbSt().axisMode=true;');
   const before=app.run('JSON.stringify(gridsState().rows)'),history=app.run('undoStack.length');
   const point=JSON.parse(app.run("JSON.stringify((()=>{const r=rmbSt(),rows=gridsState().rows,g={...rmbLayout(rows,rows.length,r.al,r.cell),rows,cell:r.cell,tw:r.s,ox:r.ox,oy:r.oy},p=rmbHighlightPolygon(0,0,g);return [p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length];})())"));
   const [x,y]=point;fire('pointerdown',x,y);fire('pointermove',x+40,y+25);fire('pointerup',x+40,y+25);app.flush();
   assert.equal(app.run('rmbSt().ox'),140,mode);assert.equal(app.run('rmbSt().oy'),125,mode);
   assert.equal(app.run('JSON.stringify(gridsState().rows)'),before,mode+' must not paint or move cells');assert.equal(app.run('undoStack.length'),history);
  }
  app.run("gridsState().tool='brush';rmbSt().axisMode=false;Object.assign(rmbSt(),{s:20,ox:100,oy:100});renderRmb();");
  fire('pointerdown',110,110,{shiftKey:true});fire('pointerup',110,110,{shiftKey:true});app.flush();assert.equal(app.run('gridsState().rows[0]'),'11','modified gesture still paints');
  const before=app.run('JSON.stringify(gridsState().rows)');fire('pointerdown',110,110);fire('pointermove',170,170);fire('pointercancel',170,170);app.flush();
  assert.equal(app.run('rmbSt().ox'),100);assert.equal(app.run('rmbSt().oy'),100);assert.equal(app.run('JSON.stringify(gridsState().rows)'),before);
 }finally{app.dom.window.close();}
});


test('parity pairs stay independent, persist, and filter actual cell drawing in all four modes',()=>{
 const app=boot();try{const {w}=app;
  app.run("Object.assign(gridsState(),{rows:['11','11'],colors:{},groups:{},text:'',textBlocks:[]});Object.assign(rmbSt(),{s:30,ox:300,oy:200,out:false,num:false,sh:false,edit:false,axisMode:false,axes:[],parity:{}});");
  w.Path2D=class{constructor(){this.moves=0;}moveTo(){this.moves++;}lineTo(){}closePath(){}arc(){}rect(){}addPath(){}};
  const g=w.document.getElementById('rmbCv').getContext('2d');let moves=0,clips=0;g.fill=p=>{moves+=p?.moves||0;};g.clip=()=>clips++;
  const render=()=>{moves=0;clips=0;app.run('renderRmb()');return moves;};
  for(const mode of ['tri','rmb','square','ring']){
   app.run("rmbSt().cell='"+mode+"';rmbSt().parity={};");const all=render();assert.ok(all>0,mode);
   app.run('rmbSt().parity.cellsEven=false;');assert.equal(render(),all/2,mode+' checkerboard halves');assert.equal(clips,1);
   app.run('rmbSt().parity.cellsOdd=false;');assert.equal(render(),0,mode+' both lattices hidden');
   app.run('rmbSt().parity={rowsOdd:false};');assert.ok(render()>0,mode+' row2 remains');app.run('rmbSt().parity.rowsEven=false;');assert.equal(render(),0,mode+' both row sets hidden');
  }
  app.run('rmbSt().parity={};renderRmb();');app.flush();const original=app.run('JSON.stringify(gridsState().rows)');
  app.proxy('gridCellsEven').click();app.proxy('gridRowsOdd').click();app.flush();
  assert.equal(app.run('rmbVisible(0,1)'),false);assert.equal(app.run('rmbVisible(1,0)'),true);assert.equal(app.run('rmbVisible(1,1)'),false);
  for(const [id,on]of [['gridCellsEven',false],['gridCellsOdd',true],['gridRowsEven',true],['gridRowsOdd',false]])assert.equal(app.proxy(id).getAttribute('aria-pressed'),String(on),id);
  assert.equal(app.run('JSON.stringify(gridsState().rows)'),original);
  const saved=JSON.parse(w.localStorage.getItem('zerklus_setka_v1')),next=boot(null,saved);try{assert.equal(next.run('rmbSt().parity.cellsEven'),false);assert.equal(next.run('rmbSt().parity.rowsOdd'),false);assert.equal(next.run('JSON.stringify(gridsState().rows)'),original);}finally{next.dom.window.close();}
 }finally{app.dom.window.close();}
});

test('scale menu centers the field, anchors both edges, blocks fit and wheel, and restores its saved controls',()=>{
 const app=boot();try{const {w}=app,cv=w.document.getElementById('rmbCv');
  app.run("Object.assign(rmbSt(),{s:30,ox:160,oy:120,fol:false});renderRmb();");
  const start=app.run('rmbSt().s');app.proxy('setkaScaleAxis').click();app.flush();assert.equal(app.run('rmbSt().ox'),400);assert.equal(app.run('rmbSt().s'),start);
  const pair=app.proxy('setkaScaleTop').closest('.setka-scale-edges'),joint=pair.querySelector('.zcf-pair-switch');assert.ok(joint);
  app.proxy('setkaScaleTop').click();app.flush();assert.equal(app.run('rmbSt().oy'),10);assert.equal(app.run('rmbSt().scalePrefs.bottom'),false);
  joint.click();app.flush();assert.equal(joint.getAttribute('aria-pressed'),'true');assert.equal(app.run('rmbSt().scalePrefs.bottom'),true);
  cv.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-200,bubbles:true,cancelable:true}));app.run('rmbFit();');app.flush();assert.equal(app.run('rmbSt().s'),start);
  joint.click();app.proxy('setkaScaleLock').click();app.flush();app.run('rmbFit();');cv.dispatchEvent(new w.WheelEvent('wheel',{deltaY:200,bubbles:true,cancelable:true}));assert.equal(app.run('rmbSt().s'),start);
  const touch=(type,id,x)=>{const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:100});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});cv.dispatchEvent(e);};
  touch('pointerdown',1,100);touch('pointerdown',2,200);touch('pointermove',2,350);touch('pointerup',1,100);touch('pointerup',2,350);app.flush();assert.equal(app.run('rmbSt().s'),start,'block includes pinch');
  const stepper=app.proxy('setkaScaleBase'),parts=stepper.querySelectorAll('.may-snap-part');parts[3].click();app.flush();assert.equal(app.run('rmbSt().scalePrefs.base'),3);assert.equal(parts[2].textContent,'3');parts[1].click();app.flush();assert.equal(app.run('rmbSt().scalePrefs.base'),1);
  const saved=JSON.parse(w.localStorage.getItem('zerklus_setka_v1')),next=boot({scale:{edge:'right',index:3,pinned:true}},saved);try{
   assert.equal(next.run('rmbSt().scalePrefs.axis'),true);assert.equal(next.run('rmbSt().scalePrefs.lock'),true);assert.equal(next.run('rmbSt().scalePrefs.base'),1);assert.equal(next.run('rmbSt().s'),start);
   assert.equal(next.proxy('setkaScaleAxis').getAttribute('aria-pressed'),'true');assert.equal(next.proxy('setkaScaleLock').getAttribute('aria-pressed'),'true');assert.equal(next.w.document.querySelector('[data-id="scale"]').dataset.dockEdge,'right');
  }finally{next.dom.window.close();}
 }finally{app.dom.window.close();}
});

test('hidden cells reject brush, selection, keyboard movement and mirror writes in all modes',()=>{
 const app=boot();try{const {w}=app,cv=w.document.getElementById('rmbCv');
  const fire=(type,p)=>{const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:p[0],clientY:p[1],shiftKey:true});Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:'mouse'}});cv.dispatchEvent(e);};
  const point=(r,c)=>JSON.parse(app.run(`JSON.stringify((()=>{const v=rmbSt(),rows=gridsState().rows,g={...rmbLayout(rows,rows.length,v.al,v.cell),cell:v.cell,rm:v.cell==='rmb',rows,tw:v.s,ox:v.ox,oy:v.oy};if(v.cell==='ring'||v.cell==='square'){const p=ZZGridShapes.center(${r},${c},g);return [g.ox+p[0]*g.tw,g.oy+p[1]*g.tw];}const p=rmbHighlightPolygon(${r},${c},g);return [p.reduce((s,v)=>s+v[0],0)/p.length,p.reduce((s,v)=>s+v[1],0)/p.length];})())`));
  for(const mode of ['tri','rmb','square','ring']){
   app.run(`Object.assign(gridsState(),{rows:['00','00'],colors:{},groups:{},tool:'brush'});Object.assign(rmbSt(),{cell:'${mode}',s:40,ox:300,oy:200,parity:{cellsEven:false},axisMode:false,edit:false});renderRmb();`);
   const hidden=point(0,0),shown=point(0,1);fire('pointerdown',hidden);fire('pointerup',hidden);assert.equal(app.run("gridsState().rows.join('/')"),'00/00',mode+' hidden brush');
   fire('pointerdown',shown);fire('pointerup',shown);assert.equal(app.run('gridsState().rows[0]'),'01',mode+' visible brush');
   app.run("gridsState().tool='';gridsState().rows=['11','11'];rmbSt().edit=true;renderRmb();rmbEditor.selectAll();");assert.equal(app.run('JSON.stringify(rmbEditor.selection())'),'[[0,1],[1,0]]',mode+' select all only visible');
   app.run('rmbEditor.erase()');assert.equal(app.run("gridsState().rows.join('/')"),'10/01',mode+' erase keeps hidden bits');
  }
  app.run("Object.assign(gridsState(),{rows:['01'],colors:{},groups:{},tool:''});Object.assign(rmbSt(),{cell:'square',parity:{cellsEven:false},edit:true,axisMode:false});renderRmb();rmbEditor.setSelection([[0,1]]);");
  cv.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:'ArrowLeft'}));assert.equal(app.run('gridsState().rows[0]'),'01','keyboard cannot move into hidden cell');
  app.run("rmbSt().axes=[{id:1,a:[0,0],b:[0,1],side:'positive',preview:true}];rmbSt().axisMode=true;rmbSt().edit=false;renderRmb();rmbAxisTool.apply();");assert.equal(app.run('gridsState().rows[0]'),'01','mirror does not overwrite hidden destination');
 }finally{app.dom.window.close();}
});
