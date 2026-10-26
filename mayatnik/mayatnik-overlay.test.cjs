// Isolated Node tests of actual inline functions; no browser/page execution.
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const source=html.slice(html.indexOf('  // v0.486 (МАЯ-016):'),html.indexOf('  function areaFreezeDraw()'));
assert.ok(source.includes('function ovlCapture()'));
const AXIS=0xffa8958a; // RGBA bytes #8A95A8, the giant grey block reported in v0.485
const data=(w,h,pixels)=>({width:w,height:h,data:new Uint8ClampedArray(Uint32Array.from(pixels).buffer)});
function canvas(w=0,h=0,rect){
  const c={width:w,height:h,style:{},hidden:false,calls:[],pixels:new Uint32Array(w*h),getBoundingClientRect:()=>rect||{left:11,top:21,right:15,bottom:25,width:4,height:4}};
  const g={globalAlpha:1,imageSmoothingEnabled:true,sx:1,sy:1,
    setTransform(a,b,cc,d){assert.equal(b,0);assert.equal(cc,0);this.sx=a;this.sy=d;},
    clearRect(){c.pixels=new Uint32Array(c.width*c.height);},putImageData(im){c.pixels=new Uint32Array(im.data.buffer).slice();},
    drawImage(src,x,y,w,h){c.calls.push({src,x,y,w,h,smoothing:this.imageSmoothingEnabled,alpha:this.globalAlpha});
      if(c.pixels.length!==c.width*c.height)c.pixels=new Uint32Array(c.width*c.height);
      for(let py=0;py<c.height;py++)for(let px=0;px<c.width;px++){
        const u=((px+.5)/this.sx-x)/w,v=((py+.5)/this.sy-y)/h;if(u<0||u>=1||v<0||v>=1)continue;
        const color=src.pixels[Math.floor(v*src.height)*src.width+Math.floor(u*src.width)];if(color>>>24)c.pixels[py*c.width+px]=color;
      }
    }};c.getContext=()=>g;return c;
}
function env({saved,ready=true,gpu=false,dpr=2,rect,templates=false}={}){
  const queue=new Map(),appended=[],saves=[],events=[],listeners={};let rid=20;
  const cv=canvas(8,8,rect),gpuCv=canvas(8,8),pixels=Uint32Array.from({length:64},(_,i)=>i%7===0?0:(0xff000000|i*0x010307)>>>0);
  pixels[1]=0xff000000;const pic=data(8,8,pixels);cv.pixels.fill(AXIS); // decorated CPU canvas
  const wrap={clientWidth:4,clientHeight:4,clientLeft:1,clientTop:1,getBoundingClientRect:()=>({left:10,top:20}),addEventListener(type,fn){listeners[type]=fn;}};
  const ctx=vm.createContext({st:{rows:256,ovl:saved},ovlFrozen:null,zWant:0,f:{get val(){throw Error('no new bits');}},geo:{anchor:3},VX:0,VH:256,
    img:pic,present:{clean:{pic}},cv,gpuCv,gpuBig:gpu?{}:null,gpuRaf:gpu?7:0,wrap,k:7,sessionReady:ready,
    templateCanvas:{hidden:!templates},templateItems:templates?[{view:{visible:true}}]:[],
    paintTemplate(g,x,y,s,contentOnly){assert.equal(contentOnly,true);events.push('template-content');const t=canvas(8,8);t.pixels[10]=0xff00aa33;g.drawImage(t,0,0,4,4);},
    layout(){},scale:()=>.5,DPR:()=>dpr,rombP:()=>-1,gpuRender(){events.push('render');gpuCv.pixels.set(pixels);},
    cancelAnimationFrame(id){events.push('cancel:'+id);queue.delete(id);},requestAnimationFrame(fn){const id=++rid;queue.set(id,fn);return id;},addEventListener(type,fn){listeners[type]=fn;},
    save(){saves.push(JSON.parse(JSON.stringify(ctx.st.ovl)));},document:{body:{classList:{contains:()=>false},append:c=>appended.push(c)},createElement:tag=>{assert.equal(tag,'canvas');return canvas();},querySelectorAll(){throw Error('service layer capture forbidden');}}
  });ctx.window=ctx;vm.runInContext(source,ctx);
  return {ctx,cv,wrap,pixels,events,saves,appended,queue,listeners,api:ctx.mayOvl,snapshot:()=>vm.runInContext('ovlSource',ctx),draw:()=>ctx.ovlDraw(),flush(){while(queue.size){const[id,fn]=queue.entries().next().value;queue.delete(id);fn();}}};
}
test('raw CPU preserves actual colors, zeros and emptiness; ignores decorated cv and service canvases',()=>{
  const e=env();e.api.step();const S=e.snapshot(),c=S.layers[0].c;assert.deepEqual(c.pixels,e.pixels);assert.ok(!c.pixels.includes(AXIS));assert.equal(c.pixels[0],0);assert.equal(c.pixels[1],0xff000000);
  e.ctx.k=99;e.ctx.geo.anchor=9000;e.ctx.img.data.fill(255);e.api.step();assert.equal(e.snapshot(),S);assert.deepEqual(c.pixels,e.pixels);
  for(const call of e.appended[0].calls){assert.equal(call.src,c);assert.equal(call.smoothing,false);assert.equal(call.alpha,1);}
});
test('real paint with SAME #8A95A8 survives: exclusion is by layer, never by color',()=>{
  const e=env();new Uint32Array(e.ctx.img.data.buffer)[20]=AXIS;e.api.step();const p=e.snapshot().layers[0].c.pixels;assert.equal(p[20],AXIS);assert.equal(p.filter(x=>x===AXIS).length,1);
});
test('CPU downsampled shown raster copies existing pixels without resampling or recovering detail',()=>{
  const e=env(),shown=data(2,2,[0xff776655,0xff000000,0,0xffbbddff]);e.ctx.present.clean={pic:shown};e.api.step();const c=e.snapshot().layers[0].c;
  assert.equal(c.width,2);assert.equal(c.height,2);assert.deepEqual(c.pixels,new Uint32Array(shown.data.buffer));
});
test('quick CPU copies already displayed clean canvas; later frames do not mutate source',()=>{
  const e=env();e.cv.width=2;e.cv.height=2;e.cv.pixels=Uint32Array.from([0xff110000,0xff002200,0,0xff000033]);e.ctx.present.clean={canvas:e.cv};e.api.step();const c=e.snapshot().layers[0].c;
  assert.deepEqual(c.pixels,e.cv.pixels);e.cv.pixels.fill(AXIS);e.draw();assert.ok(!c.pixels.includes(AXIS));
});
test('present records raw/shown/quick source before CPU service lines',()=>{
  const body=html.slice(html.indexOf('  function present(quick)'),html.indexOf('  function bothOn()'));
  const record=body.indexOf('present.clean = quick && sd < 1 ? { canvas:cv } : { pic:sd >= 1 ? pic : shown };');assert.ok(record>0);
  for(const line of ['stolbLine();','midColLine();','fixColLines();','if (quick) { align(); return; }'])assert.ok(record<body.indexOf(line));
});
test('X vertex stays fixed and Y grows around the middle at ×2/×3/×4 through ×32; service axis never enlarges',()=>{
  const e=env();e.api.step();const S=e.snapshot(),layer=S.layers[0],out=e.appended[0],original=layer.c.pixels.slice();
  for(let total=2;total<=32;total++){if(total>2)e.api.step();const call=out.calls.at(-1);assert.equal(call.w,layer.w*total);assert.equal(call.h,layer.h*total);
    const oy=S.ay+(S.bits?S.bits.H:S.layers[0].h/S.cell)*S.cell/2;
    assert.equal(call.x+(S.ax-layer.x)*total,S.ax);assert.equal(call.y+(oy-layer.y)*total,oy);assert.ok(!out.pixels.includes(AXIS));assert.deepEqual(layer.c.pixels,original);}
});
test('scrolled CPU retains full raster, offscreen pixels and actual vertex coordinates',()=>{
  const e=env({rect:{left:7,top:23,right:15,bottom:27,width:8,height:4}});e.api.step();const S=e.snapshot();assert.deepEqual(S.layers[0].c.pixels,e.pixels);assert.equal(S.layers[0].w,8);assert.equal(S.layers[0].x,-4);
  assert.equal(S.ax,-4+3.5*.5);assert.equal(S.ay,2);const call=e.appended[0].calls.at(-1);const oy=S.ay+(S.bits?S.bits.H:S.layers[0].h/S.cell)*S.cell/2;assert.equal(call.x+(S.ax-S.layers[0].x)*2,S.ax);assert.equal(call.y+(oy-S.layers[0].y)*2,oy);
});
test('GPU immediately copies clean viewport after render without CPU readback or service layers',()=>{
  const e=env({gpu:true});e.ctx.img=null;e.api.step();assert.deepEqual(e.events,['cancel:7','render']);assert.deepEqual(e.snapshot().layers[0].c.pixels,e.pixels);assert.equal(e.snapshot().layers[0].w,4);assert.equal(e.snapshot().layers.length,1);
});
test('template snapshot uses content-only renderer, excluding mixed axes/ruler/selection canvas',()=>{
  const e=env({templates:true,dpr:3});e.api.step();const S=e.snapshot();assert.equal(S.layers.length,2);assert.equal(S.layers[1].c.width,12);assert.equal(S.layers[1].c.height,12);assert.deepEqual(e.events,['template-content']);assert.ok(S.layers[1].c.pixels.includes(0xff00aa33));
  const body=html.slice(html.indexOf('  function paintTemplate('),html.indexOf('  function templateBitCanvas('));assert.ok(body.indexOf('if(contentOnly){ctx.restore();continue;}')<body.indexOf('const edges='));
});
test('R/G/B/RGB shift actual source without tint, alpha or recapture',()=>{
  const e=env();e.api.step();const S=e.snapshot(),out=e.appended[0],x=out.calls.at(-1).x;assert.equal(e.api.pos().pos,'B');assert.equal(out.calls.at(-1).x,x-.25);assert.equal(e.api.pos().pos,'RGB');assert.deepEqual(out.calls.slice(-3).map(c=>c.x),[x+.25,x,x-.25]);assert.equal(e.api.pos().pos,'R');assert.equal(e.snapshot(),S);
});
test('reset clears source, hides overlay, preserves h0/pos and field; next enable takes fresh data',()=>{
  const e=env({saved:{n:0,h0:16,pos:'B'}});e.api.step();const old=e.snapshot(),f=e.ctx.f,geo=e.ctx.geo,img=e.ctx.img,k=e.ctx.k;e.api.reset();
  assert.equal(e.snapshot(),null);assert.equal(e.appended[0].style.display,'none');assert.deepEqual(e.saves.at(-1),{n:0,h0:16,pos:'B',alpha:50});assert.equal(e.ctx.f,f);assert.equal(e.ctx.geo,geo);assert.equal(e.ctx.img,img);assert.equal(e.ctx.k,k);
  new Uint32Array(img.data.buffer).fill(0xffaabbcc);e.api.step();assert.notEqual(e.snapshot(),old);assert.equal(e.snapshot().layers[0].c.pixels[0],0xffaabbcc);
});
test('reset cancels pending F5 restore; normal F5 captures fresh live GPU',()=>{
  const e=env({saved:{n:2,h0:8,pos:'RGB'},ready:false});e.draw();e.flush();assert.equal(e.snapshot(),null);e.ctx.sessionReady=true;e.draw();assert.equal(e.queue.size,1);e.api.reset();assert.equal(e.queue.size,0);e.flush();assert.equal(e.snapshot(),null);
  const fresh=env({gpu:true,saved:{n:2,h0:8,pos:'G'}});fresh.ctx.img=null;fresh.draw();fresh.flush();assert.ok(fresh.snapshot());assert.equal(fresh.api.get().n,2);assert.deepEqual(fresh.saves.at(-1),{n:2,h0:8,pos:'G',alpha:50});
});
test('h0/cycle/malformed state are safe; viewport resize does not change source scale',()=>{
  const e=env({saved:{n:-7,h0:0,pos:'?'}});e.ctx.VH=e.ctx.st.rows=4;assert.equal(e.api.step().n,1);const S=e.snapshot();e.wrap.clientWidth=6;e.draw();assert.equal(e.appended[0].calls.at(-1).w,S.layers[0].w*2);assert.equal(e.api.step().n,0);assert.equal(e.snapshot(),null);assert.equal(e.api.h0().h0,16);
});
test('actual reset button is inserted, moved into Areas, and invokes reset without triggering other commands',()=>{
  const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),inserted=[],areas=[];let resets=0,layouts=0;
  const start=menu.indexOf('    const ovp ='),end=menu.indexOf('    toolSync.push(',start);
  const placement=menu.match(/gView\.querySelector\('\[data-n="fixMirror"\]'\)\.after\([^;]+;/)[0];
  const migration=menu.split('\n').find(s=>s.includes("for (const n of ['sawFull'")&&s.includes("'ovlReset'"));
  assert.ok(migration);
  const ctx=vm.createContext({document:{createElement:()=>({})},window:{mayOvl:{reset(){resets++;}}},placeTools(){layouts++;},
    ptBtn(n,kind,src,onclick){return {dataset:{n},kind,onclick,setAttribute(k,v){this[k]=v;}};},
    gView:{querySelector:()=>({after(...buttons){inserted.push(...buttons);}})},
    tools:{querySelector:s=>inserted.find(b=>s==='[data-n='+b.dataset.n+']')},gAreas:{append:b=>areas.push(b)}});
  for(const name of placement.slice(placement.indexOf('.after(')+7,-2).split(',').map(s=>s.trim()))if(!['bOv','bOp','bOh','bOr'].includes(name))ctx[name]={dataset:{n:name}};
  vm.runInContext(menu.slice(start,end)+'\n'+placement+'\n'+migration,ctx);
  const reset=areas.find(b=>b.dataset.n==='ovlReset');assert.ok(reset,'reset must actually reach the DOM group');
  assert.equal(reset.dataset.miShort,'Сброс налож.');assert.equal(reset.kind,'reset');reset.onclick();assert.equal(resets,1);assert.equal(layouts,1);
  const actions=[];ctx.window.mayOvl.freeze=()=>actions.push('freeze');ctx.window.mayOvl.opacity=()=>actions.push('opacity');ctx.window.mayOvl.original=()=>actions.push('original');
  for(const id of ['ovlFreeze','ovlAlpha','ovlOriginal']){const button=areas.find(b=>b.dataset.n===id);assert.ok(button,id+' actually reaches Areas');button.onclick();}
  assert.deepEqual(actions,['freeze','opacity','original']);assert.equal(layouts,4);
});

// Scroll/layout model uses the production margin and alignment functions. No bit computation or rebuild.
function originalLayout(e,{blockedScroll=false,initialScale=.5,dpr=2,quantized=false,base=2}={}){
  const C=e.ctx;let left=0,top=0,m={left:0,right:0,top:0,bottom:0},calls=0;
  C.st.zoom=initialScale;C.scale=()=>C.st.zoom;C.DPR=()=>dpr;C.minScale=()=>.001;C.dispW=()=>8;C.VH=8;
  C.getComputedStyle=()=>({paddingLeft:'0',paddingRight:'0',paddingTop:'0',paddingBottom:'0'});
  const info={textContent:''};C.$=id=>{assert.equal(id,'paintCacheInfo');return info;};
  const maxX=()=>Math.max(0,m.left+8*C.scale()+m.right-e.wrap.clientWidth),maxY=()=>Math.max(0,m.top+C.VH*C.scale()+m.bottom-e.wrap.clientHeight);
  const quantize=v=>quantized?Math.round(v*dpr)/dpr:v;
  Object.defineProperties(e.wrap,{scrollLeft:{get:()=>left,set:v=>{left=blockedScroll?0:quantize(Math.min(maxX(),Math.max(0,v)));}},scrollTop:{get:()=>top,set:v=>{top=blockedScroll?0:quantize(Math.min(maxY(),Math.max(0,v)));}}});
  e.cv.getBoundingClientRect=()=>{const tr=e.cv.style.transform?.match(/translate3d\(([^p]+)px, ([^p]+)px, 0\)/),dx=tr?+tr[1]:0,dy=tr?+tr[2]:0;
    return {left:11+m.left-left+dx,top:21+m.top-top+dy,width:8*C.scale(),height:C.VH*C.scale(),right:11+m.left-left+8*C.scale()+dx,bottom:21+m.top-top+C.VH*C.scale()+dy};};
  C.st.zbase=base;vm.runInContext(html.match(/  const zB = [^\n]+/)[0]+'\n'+html.match(/  const snap2 = [^\n]+/)[0],C);
  C.layout=()=>{calls++;assert.ok(calls<10000,'no layout recursion');m=C.ovlLinked()?C.ovlOriginalMargins(C.scale()):{left:0,right:0,top:0,bottom:0};C.ovlAlignOriginal();e.draw();};
  C.st.rows=256;C.VH=256; // support many overlay steps; field dimensions are independent of source raster
  return {info,margins:()=>m,calls:()=>calls};
}
test('freeze pins the already enlarged bitmap and CSS rectangle; opacity/resize/frame never resample it',()=>{
  const e=env();e.api.step();e.api.step();e.api.freeze();const c=e.appended[0],pixels=c.pixels.slice(),rect=[c.style.left,c.style.top,c.style.width,c.style.height],count=c.calls.length;
  assert.equal(e.api.get().fixed,true);assert.equal(c.style.opacity,'0.5');
  assert.equal(c.style.visibility,'visible');assert.equal(c.style.zIndex,'5'); // survives may-nav and stays above original templates
  e.ctx.k=99;e.ctx.geo.anchor=10000;e.ctx.img.data.fill(255);e.wrap.clientWidth=2;e.wrap.clientHeight=2;e.wrap.getBoundingClientRect=()=>({left:12,top:22});e.draw();
  e.api.step();e.api.pos();e.api.h0();assert.equal(e.api.get().n,2);assert.equal(e.api.get().pos,'G');
  e.api.opacity();assert.equal(c.style.opacity,'0.75');assert.deepEqual(c.pixels,pixels);assert.equal(c.calls.length,count);
  assert.deepEqual([c.style.left,c.style.top,c.style.width,c.style.height],rect);assert.ok(c.style.clipPath.startsWith('inset('));
  assert.equal(e.saves.at(-1).alpha,75);assert.ok(!('fixed' in e.saves.at(-1)));assert.ok(!('linked' in e.saves.at(-1)));
});
test('exact original command matches scale ×3 despite snap, anchors vertex, preserves field and all flags',()=>{
  const e=env(),ui=originalLayout(e);e.ctx.st.zsnap=true;e.ctx.st.ztop=true;e.ctx.st.zBot=true;e.ctx.st.zMid=true;
  e.api.step();e.api.step();e.api.freeze();const frozen=e.ctx.ovlFrozen,c=e.appended[0],pixels=c.pixels.slice(),frame=e.ctx.k,field=e.ctx.f;
  e.ctx.zWant=123;assert.equal(e.api.original().ok,true);assert.equal(e.ctx.st.zoom,1.5);assert.equal(e.ctx.zWant,0);assert.equal(e.api.get().linked,true);
  const r=e.cv.getBoundingClientRect();assert.equal(r.left+3.5*1.5,frozen.x);assert.equal(r.top,frozen.y);
  assert.equal(e.ctx.k,frame);assert.equal(e.ctx.f,field);assert.equal(e.ctx.st.rows,256);for(const flag of ['zsnap','ztop','zBot','zMid'])assert.equal(e.ctx.st[flag],true);
  assert.deepEqual(c.pixels,pixels);assert.ok(ui.calls()<4);
});
test('bit-for-bit grid phase: centres and boundaries on both sides, multiple rows, ×3/.3 CSS/DPR1.25/RGB shifts',()=>{
  for(const pos of ['G','R','B','RGB']){
    const e=env({saved:{n:0,h0:8,pos}});originalLayout(e,{initialScale:.3,dpr:1.25,quantized:true});
    e.api.step();e.api.step();e.api.freeze();const F=e.ctx.ovlFrozen,S=e.snapshot();assert.equal(e.api.original().ok,true);
    const r=e.cv.getBoundingClientRect(),s=e.ctx.scale();assert.ok(Math.abs(s-.9)<1e-12);
    for(const dx of [-3,-1,0,1,3])for(const row of [0,1,7])for(const phase of [0,.5,1]){
      const frozenX=F.x+(dx+phase-.5)*S.cell*F.total,frozenY=F.y+(row+phase)*S.cell*F.total;
      const originalX=r.left+(e.ctx.geo.anchor-e.ctx.VX+dx+phase)*s,originalY=r.top+(row+phase)*s;
      assert.ok(Math.abs(originalX-frozenX)<1e-10,pos+' cell x phase');assert.ok(Math.abs(originalY-frozenY)<1e-10,pos+' cell y phase');
    }
    const before={...e.cv.style};for(let i=0;i<10;i++)assert.equal(e.ctx.ovlAlignOriginal(),true);assert.deepEqual(e.cv.style,before,'alignment converges without drift');
  }
});
test('manual zoom uses frozen pivot both directions, including below source scale with positive margins',()=>{
  const e=env(),ui=originalLayout(e);e.api.step();e.api.freeze();assert.equal(e.api.original().ok,true);const F=e.ctx.ovlFrozen;
  // Execute actual zoomTo entry; the frozen branch must ignore cursor coordinates.
  const code=html.slice(html.indexOf('  function zoomTo('),html.indexOf('  function fit()'));
  vm.runInContext(code,e.ctx);
  for(const [s,want] of [[2,2],[.125,1],[.125,.125],[4,1],[4,4],[.0625,1],[.0625,.0625]]){e.ctx.zoomTo(s,-999,999);assert.equal(e.ctx.st.zoom,want);const r=e.cv.getBoundingClientRect();assert.ok(Math.abs(r.left+3.5*want-F.x)<=.5);assert.ok(Math.abs(r.top-F.y)<=.5);}
  assert.ok(ui.margins().left>0);assert.ok(ui.margins().right>0);assert.equal(e.ctx.st.rows,256);
});
test('max40 and explicit zLock reject without changing zoom, scroll, snap, flags or linkage',()=>{
  const e=env();originalLayout(e);e.api.step();e.api.freeze();const old=e.ctx.st.zoom;e.ctx.st.zLock=true;e.ctx.st.zsnap=true;
  assert.equal(e.api.original().ok,false);assert.equal(e.ctx.st.zoom,old);assert.equal(e.api.get().linked,true);assert.equal(e.wrap.scrollLeft,0);
  e.ctx.st.zLock=false;e.ctx.ovlFrozen.scale=41;assert.equal(e.api.original().ok,false);assert.equal(e.ctx.st.zoom,old);assert.equal(e.ctx.st.zsnap,true);assert.equal(e.api.get().linked,true);
});
test('unreachable scroll clamp rolls back zoom/scroll and linkage, without changing frozen bitmap',()=>{
  const e=env();originalLayout(e,{blockedScroll:true});e.api.step();e.api.freeze();const c=e.appended[0],pixels=c.pixels.slice();
  const result=e.api.original();assert.equal(result.ok,false);assert.match(result.message,/прокрутки/);assert.equal(e.ctx.st.zoom,.5);assert.equal(e.wrap.scrollLeft,0);assert.equal(e.api.get().linked,true);assert.deepEqual(c.pixels,pixels);
});
test('unfreeze/reset release linkage and immediately remove temporary margins; F5 retains opacity only',()=>{
  const e=env(),ui=originalLayout(e);e.api.step();e.api.freeze();e.api.original();e.ctx.ovlOriginalZoom(.125);assert.ok(ui.margins().left>0);
  e.api.freeze();assert.equal(e.api.get().fixed,false);assert.equal(e.api.get().linked,false);assert.equal(ui.margins().left,0);
  e.api.freeze();e.api.original();e.api.opacity();e.api.reset();assert.equal(e.api.get().fixed,false);assert.equal(e.api.get().linked,false);assert.equal(e.snapshot(),null);assert.equal(ui.margins().left,0);
  const fresh=env({saved:{n:2,h0:8,pos:'G',alpha:75,fixed:true,linked:true}});fresh.draw();fresh.flush();assert.equal(fresh.api.get().alpha,75);assert.equal(fresh.api.get().fixed,false);assert.equal(fresh.api.get().linked,false);
});
test('early align/layout calls can inspect linkage without TDZ; legacy autoanchors yield only while linked',()=>{
  const early=html.indexOf('var ovlFrozen = null;');assert.ok(early>0&&early<html.indexOf('function cssLayout()'));
  const t=vm.createContext({});vm.runInContext('var ovlFrozen;'+html.match(/function ovlLinked\(\) \{[^}]+\}/)[0],t);assert.equal(t.ovlLinked(),false);
  for(const name of ['midScroll','fitHold','zTopScroll','zBotScroll']){
    assert.ok(html.includes('function '+name+'() { if (ovlLinked()'));
  }
});

function zoomHandlers(e){
  const C=e.ctx,handlers={},buttons={zIn:{},zOut:{}};
  vm.runInContext(html.slice(html.indexOf('  function zoomTo('),html.indexOf('  function fit()')),C);
  const old=C.$;C.$=id=>buttons[id]||old(id);
  const begin=html.indexOf('  const zoomStep =');vm.runInContext(html.slice(begin,html.indexOf("  $('zFit').onclick",begin)),C);
  e.wrap.addEventListener=(name,fn)=>handlers[name]=fn;
  const wheel=html.indexOf("  wrap.addEventListener('wheel', e => {");
  vm.runInContext(html.slice(wheel,html.indexOf('  // Тянуть',wheel)),C);
  C.pts=new Map([[1,{x:0,y:0}],[2,{x:100,y:0}]]);C.pinch={d:100,s:C.scale()};C.pan=null;
  const move=html.indexOf('    if (!pts.has(e.pointerId)) return;');
  vm.runInContext('globalThis.pinchMove=e=>{'+html.slice(move,html.indexOf('  });',move))+'};',C);
  return {step:dir=>buttons[dir>0?'zIn':'zOut'].onclick(),
    wheel:dir=>handlers.wheel({deltaY:-dir*2,deltaMode:0,clientX:999,clientY:-999,preventDefault(){}}),
    pinch:dir=>{const d=C.pts.get(2).x*Math.exp(dir*.005);C.pinchMove({pointerId:2,clientX:d,clientY:0});}};
}
function magneticEnv({base=2,total=3,initialScale=1,dpr=1.25,snap=true,pos='G'}={}){
  const e=env({saved:{n:0,h0:8,pos}});originalLayout(e,{base,initialScale,dpr,quantized:true});e.ctx.st.zsnap=snap;
  for(let n=1;n<total;n++)e.api.step();e.ctx.zWant=123;e.api.freeze();return e;
}
function assertGrid(e){
  assert.equal(e.api.get().matched,true);const C=e.ctx,F=C.ovlFrozen,r=e.cv.getBoundingClientRect();
  for(const dx of [-3,0,3])for(const row of [0,1,7])for(const phase of [0,.5,1]){
    assert.ok(Math.abs(r.left+(C.geo.anchor-C.VX+dx+phase)*C.scale()-(F.x+(dx+phase-.5)*F.scale))<1e-9);
    assert.ok(Math.abs(r.top+(row+phase)*C.scale()-(F.y+(row+phase)*F.scale))<1e-9);
  }
}
test('freeze enables magnet immediately without Original or scale/data changes; button crossing catches non-power targets',()=>{
  for(const base of [2,3,5])for(const total of [3,5])for(const pos of ['G','R','B']){
    const e=magneticEnv({base,total,initialScale:.3,pos}),C=e.ctx,h=zoomHandlers(e),field=C.f,pixels=e.snapshot().layers[0].c.pixels.slice();
    assert.equal(C.scale(),.3);assert.equal(C.zWant,0);assert.equal(e.api.get().linked,true);assert.equal(e.api.get().matched,false);
    for(let n=0;!e.api.get().matched&&n<10;n++)h.step(1);assertGrid(e);
    h.step(1);assert.ok(C.scale()>C.ovlFrozen.scale);assert.equal(e.api.get().matched,false);
    for(let n=0;!e.api.get().matched&&n<10;n++)h.step(-1);assertGrid(e);
    h.step(-1);assert.ok(C.scale()<C.ovlFrozen.scale);assert.equal(C.f,field);assert.equal(C.k,7);assert.equal(C.st.rows,256);assert.deepEqual(e.snapshot().layers[0].c.pixels,pixels);
  }
});
test('directional release uses the actual B^k/DPR grid; target3 cannot jump up when zooming down',()=>{
  for(const [dir,expected] of [[-1,1.6],[1,3.2]]){
    const e=magneticEnv();e.api.original();assertGrid(e);e.ctx.ovlOriginalZoom(3*Math.exp(dir*.03));assert.equal(e.ctx.scale(),expected);
  }
});
test('actual wheel and pinch handlers accumulate tiny motions, snap, release, reverse and recapture without stale requests',()=>{
  for(const mode of ['wheel','pinch'])for(const base of [2,3,5])for(const total of [3,5])for(const snap of [true,false]){
    const e=magneticEnv({base,total,initialScale:.3,snap,pos:'B'}),h=zoomHandlers(e),C=e.ctx;
    const reach=dir=>{for(let i=0;i<800&&!e.api.get().matched;i++)h[mode](dir);assertGrid(e);assert.equal(C.zWant,0);};
    reach(1);const target=C.scale();
    h[mode](1);assert.equal(C.scale(),target,'tiny motion remains in detent');
    for(let i=0;i<20&&e.api.get().matched;i++)h[mode](1);assert.ok(C.scale()>target,'next meaningful gesture releases upward');
    reach(-1);
    for(let i=0;i<20&&e.api.get().matched;i++)h[mode](-1);assert.ok(C.scale()<target,'release never reverses downward intent');
    reach(1);assert.equal(e.api.original().ok,true);assert.equal(C.zWant,0);assert.equal(C.k,7);assert.equal(C.st.rows,256);
    C.zWant=987;e.api.freeze();assert.equal(C.zWant,0);e.api.freeze();C.zWant=765;e.api.reset();assert.equal(C.zWant,0);
  }
});
test('lock rejects magnetic capture without view mutations; out-of-range magnet never bypasses40',()=>{
  const e=magneticEnv(),h=zoomHandlers(e),C=e.ctx;C.st.zLock=true;C.st.ztop=C.st.zBot=C.st.zMid=true;
  const before=JSON.stringify(C.st),scroll=[e.wrap.scrollLeft,e.wrap.scrollTop];h.step(1);assert.equal(JSON.stringify(C.st),before);assert.deepEqual([e.wrap.scrollLeft,e.wrap.scrollTop],scroll);assert.equal(e.api.get().matched,false);
  C.st.zLock=false;C.ovlFrozen.scale=41;assert.equal(e.api.original().ok,false);assert.equal(C.scale(),1);
  C.zoomTo(100);assert.ok(C.scale()<=40);assert.equal(e.api.get().matched,false);assert.equal(C.st.ztop,true);assert.equal(C.st.zBot,true);assert.equal(C.st.zMid,true);
});
test('menu distinguishes magnetic linkage from exact matching; real sync highlights only aligned grid',()=>{
  const menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),buttons={},sync=[];
  const e=magneticEnv(),ctx=vm.createContext({document:{createElement:()=>({})},window:{mayOvl:e.api},placeTools(){},toolSync:sync,
    ptBtn(n,kind,src,onclick){const classes={};return buttons[n]={dataset:{},onclick,classList:{toggle:(k,v)=>classes[k]=v},classes,querySelector:()=>null,setAttribute(k,v){this[k]=v;}};}});
  vm.runInContext(menu.slice(menu.indexOf('    const ovp ='),menu.indexOf('    // v0.270:')),ctx);
  sync[0]();const button=buttons.ovlOriginal;assert.equal(button.classes.on,false);assert.equal(button['aria-pressed'],'false');
  e.api.original();sync[0]();assert.equal(button.classes.on,true);assert.equal(button['aria-pressed'],'true');assert.match(button.title,/Сетка совмещена/);
  e.ctx.ovlOriginalZoom(4);sync[0]();assert.equal(button.classes.on,false);assert.equal(e.api.get().linked,true);
  e.api.reset();sync[0]();assert.equal(button.disabled,true);assert.equal(button.classes.on,false);
});

test('unfrozen overlay starts at 50%; real menu cycles whole-layer visibility including zero without changing source',()=>{
  const e=env(),menu=fs.readFileSync(path.join(__dirname,'mayatnik-menu.js'),'utf8'),buttons={},sync=[];
  const context=vm.createContext({document:{createElement:()=>({})},window:{mayOvl:e.api},placeTools(){},toolSync:sync,
    ptBtn(n,kind,src,onclick){const label={textContent:''};return buttons[n]={dataset:{},onclick,classList:{toggle(){}},querySelector:()=>label,label,setAttribute(k,v){this[k]=v;}};}});
  vm.runInContext(menu.slice(menu.indexOf('    const ovp ='),menu.indexOf('    // v0.270:')),context);
  e.api.step();const c=e.appended[0],S=e.snapshot(),pixels=S.layers[0].c.pixels.slice(),field=e.ctx.f,frame=e.ctx.k;
  assert.equal(c.style.opacity,'0.5');assert.equal(e.api.get().fixed,false);
  for(const alpha of [75,100,0,25,50]){
    buttons.ovlAlpha.onclick();sync[0]();assert.equal(e.api.get().alpha,alpha);assert.equal(c.style.opacity,String(alpha/100));
    assert.equal(buttons.ovlAlpha.label.textContent,'Видимость '+alpha+'%');assert.equal(buttons.ovlAlpha['aria-label'],buttons.ovlAlpha.title);
    assert.match(buttons.ovlAlpha.title,/до и после фиксации/);assert.match(buttons.ovlAlpha.title,/0 → 25 → 50 → 75 → 100/);
    assert.equal(e.snapshot(),S);assert.deepEqual(S.layers[0].c.pixels,pixels);assert.equal(e.ctx.f,field);assert.equal(e.ctx.k,frame);
  }
  assert.equal(e.appended.length,1);assert.ok(c.calls.every(call=>call.alpha===1),'RGB/source pixels are combined at full alpha before the CSS layer');
});

test('every alpha survives step/position, freeze, redraw, scroll/resize, unfreeze and fresh F5 restore',()=>{
  for(const alpha of [0,25,50,75,100]){
    const e=env({saved:{alpha}});e.api.step();const c=e.appended[0],S=e.snapshot(),pixels=S.layers[0].c.pixels.slice(),field=e.ctx.f;
    e.api.step();e.api.pos();assert.equal(c.style.opacity,String(alpha/100));
    e.api.freeze();assert.equal(e.api.get().fixed,true);assert.equal(e.api.get().linked,true);
    e.draw();e.listeners.scroll();e.listeners.resize();e.flush();assert.equal(c.style.opacity,String(alpha/100));assert.equal(e.api.get().linked,true);
    assert.deepEqual(S.layers[0].c.pixels,pixels);e.api.freeze();assert.equal(e.api.get().fixed,false);assert.equal(c.style.opacity,String(alpha/100));
    e.listeners.resize();e.flush();assert.equal(c.style.opacity,String(alpha/100));assert.equal(e.ctx.f,field);
    const fresh=env({saved:JSON.parse(JSON.stringify(e.ctx.st.ovl))});fresh.draw();fresh.flush();
    assert.equal(fresh.api.get().alpha,alpha);assert.equal(fresh.appended[0].style.opacity,String(alpha/100));assert.equal(fresh.api.get().fixed,false);
    e.api.reset();assert.equal(c.style.display,'none');assert.equal(e.api.get().alpha,alpha);assert.equal(e.ctx.f,field);e.api.step();assert.equal(c.style.opacity,String(alpha/100));
  }
});

test('visibility clamps invalid endpoints while preserving valid zero; changing opacity at 0 keeps magnet and fixed bitmap',()=>{
  for(const [value,want]of [[-12,0],[0,0],[132,100],[undefined,50],[NaN,50]])assert.equal(env({saved:{alpha:value}}).api.get().alpha,want);
  const e=magneticEnv(),c=e.appended[0],bitmap=c.pixels.slice(),F=e.ctx.ovlFrozen;
  for(const alpha of [75,100,0,25,50]){e.api.opacity();assert.equal(c.style.opacity,String(alpha/100));assert.equal(e.ctx.ovlFrozen,F);assert.equal(e.api.get().linked,true);assert.deepEqual(c.pixels,bitmap);}
});

test('GIF compositor applies whole-layer alpha once: two different colors mix at 0/25/50/75/100%, zero never becomes opaque',()=>{
  const gif=html.slice(html.indexOf('  function gifViewFrame('),html.indexOf("  $('bGif').onclick=")),over=[200,40,80],under=[20,100,220];
  const e=env({saved:{pos:'RGB'}});e.api.step(); // RGB: multiple copies still produce one composited canvas
  assert.equal(e.api.get().pos,'RGB');const overlay=e.appended[0];
  const result={width:4,height:4};let current,pixel,draws;
  const g={globalAlpha:1,setTransform(){},fillRect(){pixel=[0,0,0];},drawImage(c){const color=c===overlay?over:under;pixel=pixel.map((p,i)=>color[i]*this.globalAlpha+p*(1-this.globalAlpha));draws.push({c,alpha:this.globalAlpha});}};
  result.getContext=()=>g;const base=canvas(4,4);const context=vm.createContext({wrap:e.wrap,cv:base,gpuBig:null,GIF_LAYERS:'.may-ovl',getComputedStyle:c=>({display:'',visibility:'visible',opacity:c===overlay?overlay.style.opacity:'1'}),document:{querySelectorAll:()=>[overlay]}});
  base.tagName=overlay.tagName='CANVAS';vm.runInContext(gif,context);
  for(const alpha of [75,100,0,25,50]){
    e.api.opacity();draws=[];context.gifViewFrame(result,4,4);current=alpha/100;
    assert.deepEqual(pixel,under.map((p,i)=>over[i]*current+p*(1-current)));assert.equal(draws.filter(d=>d.c===overlay).length,alpha===0?0:1);
    assert.equal(g.globalAlpha,1);assert.ok(overlay.calls.every(call=>call.alpha===1));
  }
  // GPU's direct put() call also honors zero independently of shown() filtering.
  context.gpuBig={};context.gpuCv=overlay;context.gpuRaf=0;context.gpuRender=()=>{};
  overlay.style.opacity='0';draws=[];context.gifViewFrame(result,4,4);assert.equal(draws[0].alpha,0);assert.deepEqual(pixel,[0,0,0]);
});
