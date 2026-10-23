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
  const queue=new Map(),appended=[],saves=[],events=[];let rid=20;
  const cv=canvas(8,8,rect),gpuCv=canvas(8,8),pixels=Uint32Array.from({length:64},(_,i)=>i%7===0?0:(0xff000000|i*0x010307)>>>0);
  pixels[1]=0xff000000;const pic=data(8,8,pixels);cv.pixels.fill(AXIS); // decorated CPU canvas
  const wrap={clientWidth:4,clientHeight:4,clientLeft:1,clientTop:1,getBoundingClientRect:()=>({left:10,top:20}),addEventListener(){}};
  const ctx=vm.createContext({st:{rows:256,ovl:saved},f:{get val(){throw Error('no new bits');}},geo:{anchor:3},VX:0,VH:256,
    img:pic,present:{clean:{pic}},cv,gpuCv,gpuBig:gpu?{}:null,gpuRaf:gpu?7:0,wrap,k:7,sessionReady:ready,
    templateCanvas:{hidden:!templates},templateItems:templates?[{view:{visible:true}}]:[],
    paintTemplate(g,x,y,s,contentOnly){assert.equal(contentOnly,true);events.push('template-content');const t=canvas(8,8);t.pixels[10]=0xff00aa33;g.drawImage(t,0,0,4,4);},
    scale:()=>.5,DPR:()=>dpr,rombP:()=>-1,gpuRender(){events.push('render');gpuCv.pixels.set(pixels);},
    cancelAnimationFrame(id){events.push('cancel:'+id);queue.delete(id);},requestAnimationFrame(fn){const id=++rid;queue.set(id,fn);return id;},addEventListener(){},
    save(){saves.push(JSON.parse(JSON.stringify(ctx.st.ovl)));},document:{body:{classList:{contains:()=>false},append:c=>appended.push(c)},createElement:tag=>{assert.equal(tag,'canvas');return canvas();},querySelectorAll(){throw Error('service layer capture forbidden');}}
  });ctx.window=ctx;vm.runInContext(source,ctx);
  return {ctx,cv,wrap,pixels,events,saves,appended,queue,api:ctx.mayOvl,snapshot:()=>vm.runInContext('ovlSource',ctx),draw:()=>ctx.ovlDraw(),flush(){while(queue.size){const[id,fn]=queue.entries().next().value;queue.delete(id);fn();}}};
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
test('vertex remains fixed at ×2/×3/×4 through ×32; service axis never enlarges',()=>{
  const e=env();e.api.step();const S=e.snapshot(),layer=S.layers[0],out=e.appended[0],original=layer.c.pixels.slice();
  for(let total=2;total<=32;total++){if(total>2)e.api.step();const call=out.calls.at(-1);assert.equal(call.w,layer.w*total);assert.equal(call.h,layer.h*total);
    assert.equal(call.x+(S.ax-layer.x)*total,S.ax);assert.equal(call.y+(S.ay-layer.y)*total,S.ay);assert.ok(!out.pixels.includes(AXIS));assert.deepEqual(layer.c.pixels,original);}
});
test('scrolled CPU retains full raster, offscreen pixels and actual vertex coordinates',()=>{
  const e=env({rect:{left:7,top:23,right:15,bottom:27,width:8,height:4}});e.api.step();const S=e.snapshot();assert.deepEqual(S.layers[0].c.pixels,e.pixels);assert.equal(S.layers[0].w,8);assert.equal(S.layers[0].x,-4);
  assert.equal(S.ax,-4+3.5*.5);assert.equal(S.ay,2);const call=e.appended[0].calls.at(-1);assert.equal(call.x+(S.ax-S.layers[0].x)*2,S.ax);assert.equal(call.y,S.ay);
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
  assert.equal(e.snapshot(),null);assert.equal(e.appended[0].style.display,'none');assert.deepEqual(e.saves.at(-1),{n:0,h0:16,pos:'B'});assert.equal(e.ctx.f,f);assert.equal(e.ctx.geo,geo);assert.equal(e.ctx.img,img);assert.equal(e.ctx.k,k);
  new Uint32Array(img.data.buffer).fill(0xffaabbcc);e.api.step();assert.notEqual(e.snapshot(),old);assert.equal(e.snapshot().layers[0].c.pixels[0],0xffaabbcc);
});
test('reset cancels pending F5 restore; normal F5 captures fresh live GPU',()=>{
  const e=env({saved:{n:2,h0:8,pos:'RGB'},ready:false});e.draw();e.flush();assert.equal(e.snapshot(),null);e.ctx.sessionReady=true;e.draw();assert.equal(e.queue.size,1);e.api.reset();assert.equal(e.queue.size,0);e.flush();assert.equal(e.snapshot(),null);
  const fresh=env({gpu:true,saved:{n:2,h0:8,pos:'G'}});fresh.ctx.img=null;fresh.draw();fresh.flush();assert.ok(fresh.snapshot());assert.equal(fresh.api.get().n,2);assert.deepEqual(fresh.saves.at(-1),{n:2,h0:8,pos:'G'});
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
});
