// Isolated registry/adapters. No browser or page boot.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Layers=require('./mayatnik-layers.js'),html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
function canvas(w=0,h=0,pixels=[]){
  let width=w,height=h,bytes=new Uint8ClampedArray(w*h*4);bytes.set(pixels);const stack=[];
  const c={style:{},dataset:{},hidden:false,remove(){this.removed=true;},getBoundingClientRect(){return {left:+parseFloat(this.style.left||0),top:+parseFloat(this.style.top||0),width:+parseFloat(this.style.width||width),height:+parseFloat(this.style.height||height)};}};
  Object.defineProperties(c,{width:{get:()=>width,set:v=>{width=v;bytes=new Uint8ClampedArray(width*height*4);}},height:{get:()=>height,set:v=>{height=v;bytes=new Uint8ClampedArray(width*height*4);}},bytes:{get:()=>bytes}});
  const g={globalAlpha:1,sx:1,sy:1,tx:0,ty:0,imageSmoothingEnabled:true,
    save(){stack.push([this.globalAlpha,this.sx,this.sy,this.tx,this.ty]);},restore(){[this.globalAlpha,this.sx,this.sy,this.tx,this.ty]=stack.pop();},setTransform(a,b,c,d,e=0,f=0){this.sx=a;this.sy=d;this.tx=e;this.ty=f;},
    clearRect(){bytes.fill(0);},getImageData(){return {data:new Uint8ClampedArray(bytes),width,height};},putImageData(image){bytes.set(image.data);},
    drawImage(src,x=0,y=0,w=src.width,h=src.height){const data=src.bytes||new Uint8ClampedArray(src.pixels.buffer);for(let py=0;py<height;py++)for(let px=0;px<width;px++){
      const u=((px+.5-this.tx)/this.sx-x)/w,v=((py+.5-this.ty)/this.sy-y)/h;if(u<0||u>=1||v<0||v>=1)continue;
      const a=(Math.floor(v*src.height)*src.width+Math.floor(u*src.width))*4,b=(py*width+px)*4,sa=data[a+3]/255*this.globalAlpha,da=bytes[b+3]/255,oa=sa+da*(1-sa);
      for(let k=0;k<3;k++)bytes[b+k]=oa?(data[a+k]*sa+bytes[b+k]*da*(1-sa))/oa:0;bytes[b+3]=oa*255;
    }},fillRect(){},beginPath(){},rect(){},clip(){},translate(x,y){this.tx+=x;this.ty+=y;}};c.getContext=()=>g;return c;
}
function registry(saved={}){let persisted,notifications=0;const mounted=[],M=Layers.create({canvas,load:()=>saved,save:v=>persisted=JSON.parse(JSON.stringify(v)),mount:c=>mounted.push(c),viewport:()=>({left:0,top:0,width:4,height:4})});M.subscribe(()=>notifications++);return {M,mounted,saved:()=>persisted,notifications:()=>notifications};}
function frame(M,id,rgba=[255,255,255,255],meta={}){M._add(id,{kind:'original',removable:false,...meta});const src=canvas(1,1,rgba);M._frame(id,{source:src,rect:{left:0,top:0,width:1,height:1},pivot:{x:.5,y:0,scale:1}});return src;}
test('tint maps white to chosen colour and keeps black/brightness/alpha/emptiness; native colours restore losslessly',()=>{
  const src=Uint8ClampedArray.from([255,255,255,255,0,0,0,200,128,128,128,90,9,8,7,0]),before=src.slice(),out=Layers.tintPixels(src,'#804020');
  assert.deepEqual([...out],[128,64,32,255,0,0,0,200,64,32,16,90,9,8,7,0]);assert.deepEqual(src,before);
  const {M}=registry(),raw=frame(M,'original',[255,255,255,128]);M.set('original',{tint:'#00ff00',opacity:0,x:9,y:-4});assert.deepEqual([...raw.bytes],[255,255,255,128]);assert.deepEqual([...M._entry('original').node.bytes],[0,255,0,128]);
  M.reset('original');assert.deepEqual([...M._entry('original').node.bytes],[255,255,255,128]);assert.equal(M.get().opacity,100);
});
test('copy owns unchanged raw pixels and inherited effects exactly once; position/pivot fixed and clones independent',()=>{
  const {M}=registry(),raw=frame(M,'overlay',[255,255,255,128],{kind:'overlay'});M.set('overlay',{tint:'#ff0000',opacity:50,x:2,y:3});const id=M.capture('overlay'),copy=M._entry(id);
  assert.deepEqual([...copy.source.bytes],[255,255,255,128]);assert.deepEqual([...copy.node.bytes],[255,0,0,128]);assert.equal(copy.node.style.opacity,'0.5');assert.equal(copy.rect.left,2);assert.equal(M._pivot(id).x,2.5);
  raw.bytes.fill(0);M.set('overlay',{tint:null,x:99});M._redraw();assert.deepEqual([...copy.source.bytes],[255,255,255,128]);M.set(id,{x:5});assert.equal(M._pivot(id).x,7.5);
  const second=M.capture(id);assert.notEqual(M._entry(second).source,copy.source);M.remove(id);assert.ok(M.get(second));
});
test('persistence keeps basic/template settings but never resurrects frozen pixels; new copy is above gaps in restored order',()=>{
  const r=registry({original:{order:5,opacity:30,x:2},overlay:{order:9}}),M=r.M;frame(M,'original');frame(M,'overlay',undefined,{kind:'overlay'});frame(M,'template:a',undefined,{kind:'template'});
  M.set('template:a',{visible:false,tint:'#123456',y:-6});const id=M.capture('original');assert.ok(M.get(id).order>9);assert.ok(!r.saved()[id]);
  const fresh=registry(r.saved()).M;frame(fresh,'original');frame(fresh,'overlay',undefined,{kind:'overlay'});frame(fresh,'template:a',undefined,{kind:'template'});
  assert.equal(fresh.list().length,3);assert.equal(fresh.get('original').opacity,30);assert.equal(fresh.get('template:a').visible,false);assert.equal(fresh.get('template:a').y,-6);
  M.remove(id);const another=M.capture('overlay');assert.ok(M.get(another).order>M.get('overlay').order);
});
test('actual compositor follows order/alpha/hidden states without changing sources or applying alpha twice',()=>{
  const {M}=registry();const a=frame(M,'original',[255,0,0,255]),b=frame(M,'overlay',[0,0,255,255],{kind:'overlay'});M.set('overlay',{opacity:50});const out=canvas(1,1);
  M._paint(out.getContext('2d'),0,0);assert.deepEqual([...out.bytes],[128,0,128,255]);M.move('original',1);out.getContext('2d').clearRect();M._paint(out.getContext('2d'),0,0);assert.deepEqual([...out.bytes],[255,0,0,255]);
  M.set('original',{opacity:0});out.getContext('2d').clearRect();M._paint(out.getContext('2d'),0,0);assert.deepEqual([...out.bytes],[0,0,255,128]);assert.deepEqual([...a.bytes],[255,0,0,255]);assert.deepEqual([...b.bytes],[0,0,255,255]);
});
test('render frames do not send menu notifications; readiness transition does, including opacity0 capture',()=>{
  const r=registry(),M=r.M;M._add('original',{kind:'original'});assert.equal(M.get().capturable,false);const src=frame(M,'original');const n=r.notifications();
  for(let i=0;i<30;i++)M._frame('original',{source:src});assert.equal(r.notifications(),n);M.set('original',{opacity:0,visible:false});assert.ok(M.capture('original'));M._enabled('original',false);assert.equal(M.get('original').capturable,false);
});

// Reuse the existing coordinate model, not the page runtime; inject the production layer initializer afterwards.
const support=fs.readFileSync(path.join(__dirname,'mayatnik-overlay.test.cjs'),'utf8'),box=vm.createContext({require,__dirname,console});
vm.runInContext(support.slice(0,support.indexOf("test('raw CPU"))+support.slice(support.indexOf('function originalLayout('),support.indexOf("test('freeze pins"))+'\nglobalThis.helpers={env,originalLayout};',box);
function adapter(options={}){
  const e=box.helpers.env(),C=e.ctx;box.helpers.originalLayout(e,{initialScale:.3,dpr:1.25,quantized:true,...options});
  C.document.createElement=tag=>tag==='canvas'?canvas():{style:{},append(){}};C.MayatnikLayers=Layers;C.CHISTO=false;C.URL_ON=false;C.localStorage={getItem:()=>null,setItem(){}};C.queueDigits=()=>{};
  vm.runInContext(html.slice(html.indexOf('  if(window.MayatnikLayers){'),html.indexOf('  function areaFreezeDraw()')),C);
  e.cv.pixels.set(e.pixels);C.layerOriginalBase(e.cv);return e;
}
test('production adapters freeze independent snapshots; move changes magnetic pivot and exact grid, source/field stay intact',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers;e.api.step();e.api.step();const data=e.snapshot().layers[0].c.bytes.slice(),field=C.f,k=C.k;e.api.freeze();const id=C.ovlFrozen.layerId;
  assert.ok(id);M.set(id,{x:2.3,y:1.7,opacity:25});assert.equal(e.api.get().alpha,25);assert.equal(e.api.original().ok,true);assert.equal(e.api.get().matched,true);
  const F=C.ovlFrozen,r=e.cv.getBoundingClientRect(),s=C.scale();for(const dx of [-2,0,3])for(const y of [0,1,7]){assert.ok(Math.abs(r.left+(3.5+dx)*s-(F.x+dx*F.scale))<1e-9);assert.ok(Math.abs(r.top+y*s-(F.y+y*F.scale))<1e-9);}
  e.api.freeze();assert.equal(M.get(id).visible,false,'unfreeze avoids doubled live+copy opacity');assert.ok(M.get(id));e.api.freeze();assert.notEqual(C.ovlFrozen.layerId,id);assert.ok(M.get(id));assert.equal(C.f,field);assert.equal(C.k,k);assert.deepEqual(e.snapshot().layers[0].c.bytes,data);
});
test('exact alignment refusal rolls back display offsets along with zoom/scroll; explicit lock never clears them',()=>{
  const e=adapter({blockedScroll:true}),C=e.ctx,M=C.mayLayers;e.api.step();e.api.freeze();M.set('original',{x:1.1,y:2.2});const before=M.get('original'),s=C.scale();
  assert.equal(e.api.original().ok,false);assert.equal(M.get('original').x,before.x);assert.equal(M.get('original').y,before.y);assert.equal(C.scale(),s);
  C.st.zLock=true;assert.equal(e.api.original().ok,false);assert.equal(M.get('original').x,1.1);
});
test('scene source excludes services and snapshots; hidden/opacity0 original does not invent pixels',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers;const src=C.layerSceneSource();assert.equal(src.layers.length,1);const old=src.layers[0].c.bytes.slice();M.capture('original');assert.equal(C.layerSceneSource().layers.length,1);
  M.set('original',{opacity:0});assert.equal(C.layerSceneSource(),null);assert.deepEqual(src.layers[0].c.bytes,old);
  frame(M,'template:a',[255,255,255,255],{kind:'template'});M.set('template:a',{x:2.5,y:-1.25});const shifted=C.layerSceneSource().layers[0];assert.equal(shifted.x,-11+2.5);assert.equal(shifted.y,-21-1.25);
});
test('service adapters preserve clean content, clip to viewport, and remove stale digit/CPU contributions on quick GPU transition',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers,original=M._entry('original').source.bytes.slice();C.g=e.cv.getContext('2d');C.devicePixelRatio=1.25;
  const ink=canvas(1,1,[138,149,168,255]);C.layerService(()=>C.g.drawImage(ink,0,0));
  const service=vm.runInContext('layerCpuService',C);assert.ok(service.style.clipPath.startsWith('inset('));assert.deepEqual(M._entry('original').source.bytes,original);
  C.digitCanvas=canvas(5,5,new Array(100).fill(255));Object.assign(C.digitCanvas.style,{left:'11px',top:'21px',width:'4px',height:'4px'});C.digitG=C.digitCanvas.getContext('2d');C.layerOriginalDigits(true,true);C.layerService(()=>{},true);
  assert.equal(vm.runInContext('layerOnly',C),true);C.gpuBig={};for(const name of ['gpuQueue','align','anchorDash','flashDraw','areaFreezeDraw','sectorDraw','rowLabDraw','fixOvDraw','queueLineMeasures'])C[name]=()=>{};
  vm.runInContext(html.slice(html.indexOf('  function present(quick)'),html.indexOf('  function bothDraw()')),C);C.present(true);
  assert.equal(vm.runInContext('layerDigits',C),null);assert.equal(vm.runInContext('layerOnly',C),false);assert.equal(service.style.display,'none');assert.equal(vm.runInContext('layerDigitService.style.display',C),'none');
  const gpu=canvas(5,5,new Array(100).fill(75));Object.assign(gpu.style,{left:'11px',top:'21px',width:'4px',height:'4px'});C.layerOriginalBase(gpu);assert.equal(M.get('original').capturable,true);
  assert.match(html,/body\.may-fold-active \.may-layer-scene,body\.may-fold-active \.may-layer-service\{visibility:hidden!important\}/);
});
test('actual GIF adapter draws registered content once before services, and retains the source-PNG path',()=>{
  const e=adapter(),C=e.ctx;let paints=0,serviceDraws=0;C.mayLayers._paint=()=>paints++;C.gpuBig=null;C.GIF_LAYERS='legacy';C.getComputedStyle=e=>({display:e.style.display||'',visibility:e.style.visibility||'',opacity:e.style.opacity||'1'});
  const svc=canvas(1,1);Object.assign(svc,{tagName:'CANVAS'});Object.assign(svc.style,{left:'11px',top:'21px',width:'1px',height:'1px'});const r=svc.getBoundingClientRect();svc.getBoundingClientRect=()=>({...r,right:12,bottom:22});
  const legacy=canvas(1,1);legacy.tagName='CANVAS';legacy.style.visibility='hidden';C.document.querySelectorAll=q=>q==='.may-layer-service'?[svc]:[legacy];const out=canvas(4,4),G=out.getContext('2d');G.drawImage=()=>serviceDraws++;
  vm.runInContext(html.slice(html.indexOf('  function gifViewFrame('),html.indexOf("  $('bGif').onclick")),C);C.gifViewFrame(out,4,4);assert.equal(paints,1);assert.equal(serviceDraws,1);
  const png=html.slice(html.indexOf("  $('bPng').onclick"),html.indexOf('  function frameSnapshot'));assert.ok(png.includes('cg.putImageData(img,0,0)'));assert.ok(!png.includes('mayLayers'));
});
test('individual template adapter and hit testing use display offsets/order while preserving paint/view data',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers;C.RK=1;C.VW=8;C.playing=false;C.rememberTemplate=()=>{};C.colourTemplate=null;
  const item={id:'t',name:'Моя фигура',view:{visible:true,alpha:50,x:0,down:0},parts:[{ox:0,mask:{width:2,height:2},canvas:canvas(2,2,new Array(16).fill(255))}]};C.templateItems=[item];C.templateRect=()=>({x:0,y:0,width:2,height:2});C.MayatnikTemplate={contains:(_,r,x,y)=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height};
  vm.runInContext(html.slice(html.indexOf('  function paintTemplate('),html.indexOf('  function templateBitCanvas(')),C);
  vm.runInContext(html.slice(html.indexOf('  function hitTemplate('),html.indexOf('  // v0.037: курсор')),C);
  C.layerTemplates();const before=JSON.stringify(item.view),source=item.parts[0].canvas.bytes.slice();M.set('template:t',{x:1.2,y:.6,opacity:25,tint:'#ff0000'});C.layerTemplates();
  assert.equal(C.hitTemplate(.5,.5),null);assert.equal(C.hitTemplate(4.5,2.5).item,item);assert.equal(JSON.stringify(item.view),before);assert.deepEqual(item.parts[0].canvas.bytes,source);
  M.set('template:t',{visible:false});assert.equal(C.hitTemplate(4.5,2.5),null);assert.equal(M.get('template:t').capturable,true);
});
test('center live R/B/RGB uses the current field axis, keeps vertical position/scale/pixels/opacity and is idempotent',()=>{
  for(const pos of ['R','B','RGB'])for(const dpr of [1.25,1.5]){
    const e=adapter({dpr}),C=e.ctx,M=C.mayLayers;C.st.ovl={n:0,h0:8,pos};e.api.step();M.set('overlay',{x:1.35,y:-.7,opacity:25,tint:'#5522ff'});
    const E=M._entry('overlay'),pixels=E.source.bytes.slice(),size=[E.source.width,E.source.height],before=M.get('overlay'),source=e.snapshot(),field=C.f,scale=C.scale(),r=e.cv.getBoundingClientRect(),axis=r.left+(C.geo.anchor-C.VX+.5)*scale;
    assert.equal(e.api.get().centerable,true);assert.equal(e.api.center(),true);assert.ok(Math.abs(M._pivot('overlay').x-axis)<1e-12);assert.notEqual(axis,13,'axis is not viewport centre');
    const after=M.get('overlay');for(const k of ['y','opacity','tint','visible','order'])assert.equal(after[k],before[k]);assert.equal(e.api.get().pos,pos);assert.equal(C.scale(),scale);assert.equal(C.f,field);assert.equal(e.snapshot(),source);assert.deepEqual(E.source.bytes,pixels);assert.deepEqual([E.source.width,E.source.height],size);
    let changes=0;const stop=M.subscribe(()=>changes++);assert.equal(e.api.center(),true);assert.equal(changes,0);stop();
  }
});
test('center active fixed layer compensates original X: actual original position, both Y coordinates and scale stay fixed',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers;e.api.step();e.api.step();e.api.freeze();const id=C.ovlFrozen.layerId;
  M.set(id,{x:1.23,y:2.17,opacity:0});M.set('original',{x:2.45,y:1.13});
  const r=e.cv.getBoundingClientRect(),before={x:r.left,y:r.top,scale:C.scale(),oy:M.get('original').y,sy:M.get(id).y,fy:C.ovlFrozen.y},pixels=M._entry(id).source.bytes.slice(),axis=r.left+3.5*C.scale();
  assert.equal(M.get(id).centerable,true);assert.equal(M.center(id),true);assert.ok(Math.abs(M._pivot(id).x-axis)<1e-12);const after=e.cv.getBoundingClientRect();
  assert.ok(Math.abs(after.left-before.x)<1e-10);assert.ok(Math.abs(after.top-before.y)<1e-10);assert.ok(Math.abs(M.get('original').x)<1e-10);assert.equal(M.get('original').y,before.oy);assert.equal(M.get(id).y,before.sy);assert.equal(C.ovlFrozen.y,before.fy);assert.equal(C.scale(),before.scale);assert.equal(M.get(id).opacity,0);assert.deepEqual(M._entry(id).source.bytes,pixels);
  assert.equal(M.center(id),true);assert.equal(C.ovlFrozen.layerId,id);assert.equal(e.api.get().linked,true);
});
test('center inactive copy neither selects it nor changes the active magnet or original offsets',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers;e.api.step();e.api.freeze();const older=C.ovlFrozen.layerId;e.api.freeze();e.api.step();e.api.freeze();const active=C.ovlFrozen.layerId;
  M.set('original',{x:1.4,y:.9});M.set(older,{x:-2.2,y:-1.6});M.select('original');const original=M.get('original'),r=e.cv.getBoundingClientRect(),activeBefore={...C.ovlFrozen};
  assert.equal(M.center(older),true);assert.ok(Math.abs(M._pivot(older).x-(r.left+3.5*C.scale()))<1e-10);assert.equal(M.selected(),'original');assert.equal(C.ovlFrozen.layerId,active);assert.deepEqual({...C.ovlFrozen},activeBefore);assert.deepEqual(M.get('original'),original);assert.equal(M.get(older).y,-1.6);assert.deepEqual(e.cv.getBoundingClientRect(),r);
});
test('center capability excludes original, absent source/geometry and templates without pivot',()=>{
  const e=adapter(),C=e.ctx,M=C.mayLayers;assert.equal(M.get('original').centerable,false);assert.equal(M.get('overlay').centerable,false);assert.equal(M.center('original'),false);assert.equal(e.api.center(),false);
  frame(M,'template:no-pivot',undefined,{kind:'template'});M._frame('template:no-pivot',{pivot:null});const copy=M.capture('template:no-pivot');assert.equal(M.get(copy).centerable,false);assert.equal(M.center(copy),false);
  e.api.step();assert.equal(M.get('overlay').centerable,true);C.geo=null;const before=M.get('overlay');assert.equal(before.centerable,false);assert.equal(M.center('overlay'),false);assert.deepEqual(M.get('overlay'),before);
});
