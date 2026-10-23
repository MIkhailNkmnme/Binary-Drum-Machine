// Node-only regression tests of the actual inline overlay; never launch the page/browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, 'Zerkalius-mayatnik.html'), 'utf8');
const source = html.slice(html.indexOf('  // v0.485 (МАЯ-016):'), html.indexOf('  function areaFreezeDraw()'));
assert.ok(source.includes('function ovlCapture()'));

// Tiny nearest-neighbour software canvas: opaque and transparent source pixels,
// CSS placement/cropping, DPR transform. Canvas call assertions cover alpha/smoothing.
function canvas(w = 0, h = 0, rect) {
  const c = { width:w, height:h, style:{}, tagName:'CANVAS', hidden:false, calls:[], pixels:new Uint32Array(w*h),
    getBoundingClientRect() { return rect || {left:11, top:21, right:15, bottom:25, width:4, height:4}; } };
  const g = { globalAlpha:1, imageSmoothingEnabled:true, sx:1, sy:1,
    setTransform(a, b, cc, d) { assert.equal(b, 0); assert.equal(cc, 0); this.sx=a; this.sy=d; },
    clearRect() { c.pixels = new Uint32Array(c.width*c.height); },
    drawImage(src, x, y, w, h) {
      c.calls.push({src, x, y, w, h, smoothing:this.imageSmoothingEnabled, alpha:this.globalAlpha});
      if (c.pixels.length !== c.width*c.height) c.pixels = new Uint32Array(c.width*c.height);
      for (let py=0; py<c.height; py++) for (let px=0; px<c.width; px++) {
        const u=((px+.5)/this.sx-x)/w, v=((py+.5)/this.sy-y)/h;
        if (u<0 || u>=1 || v<0 || v>=1) continue;
        const color=src.pixels[Math.floor(v*src.height)*src.width+Math.floor(u*src.width)];
        if (color>>>24) c.pixels[py*c.width+px]=color;
      }
    }
  };
  c.getContext = () => g;
  return c;
}
function env({saved, ready=true, gpu=false, layers=[], dpr=2, base}={}) {
  const queue=[], appended=[], saves=[], events=[];
  const cv=base || canvas(8, 8);
  // Distinct colors, a real black zero and transparent cells; no f.val rendering allowed.
  if (!base) for (let i=0; i<cv.pixels.length; i++) cv.pixels[i]=i%7===0 ? 0 : (0xff000000 | i*0x010307)>>>0;
  const gpuCv=canvas(8, 8), wrap={clientWidth:4, clientHeight:4, clientLeft:1, clientTop:1,
    getBoundingClientRect:()=>({left:10, top:20}), addEventListener() {}};
  const ctx=vm.createContext({
    st:{rows:32, ovl:saved}, f:{get val(){throw Error('must not read/rebuild bits');}}, geo:{anchor:-10000}, VH:32,
    img:{}, cv, gpuCv, gpuBig:gpu?{}:null, gpuRaf:gpu?7:0, wrap, k:7, sessionReady:ready, pictureReady:true,
    scale:()=>.5, DPR:()=>dpr, rombP:()=>-1,
    picOn(){return ctx.pictureReady;},
    gpuRender(){events.push('render'); gpuCv.pixels.set(cv.pixels);},
    cancelAnimationFrame(id){events.push('cancel:'+id);},
    requestAnimationFrame(fn){queue.push(fn); return queue.length;}, addEventListener(){},
    save(){saves.push(JSON.parse(JSON.stringify(ctx.st.ovl)));},
    getComputedStyle:e=>({display:e.style.display||'block', visibility:'visible', opacity:e.style.opacity??'1'}),
    document:{body:{classList:{contains:()=>false}, append:c=>appended.push(c)},
      createElement:tag=>{assert.equal(tag,'canvas'); return canvas();},
      querySelectorAll(selector){assert.ok(!selector.includes('.may-ovl')); assert.ok(!selector.includes('button')); return layers;}}
  });
  ctx.window=ctx; vm.runInContext(source, ctx);
  return {ctx, cv, wrap, events, saves, appended, api:ctx.mayOvl,
    snapshot:()=>vm.runInContext('ovlSource',ctx), draw:()=>ctx.ovlDraw(),
    flush(){while(queue.length)queue.shift()();}};
}
test('capture keeps DPR pixels, real colors, zeros and transparency; ×2/×3/×4 use the same source',()=>{
  const e=env(), original=e.cv.pixels.slice(); e.api.step(); const s=e.snapshot(), out=e.appended[0];
  assert.equal(s.c.width,8); assert.equal(s.c.height,8); assert.deepEqual(s.c.pixels,original);
  assert.equal(out.calls.at(-1).x,-2); assert.equal(out.calls.at(-1).w,8);
  e.cv.pixels.fill(0xffabcdef); e.ctx.k=99; e.ctx.geo.anchor=50000; e.wrap.scrollLeft=1000;
  e.api.step(); assert.equal(out.calls.at(-1).w,12);
  e.api.step(); assert.equal(out.calls.at(-1).w,16);
  assert.equal(e.snapshot(),s); assert.deepEqual(s.c.pixels,original);
  for(const call of out.calls){assert.equal(call.src,s.c); assert.equal(call.smoothing,false); assert.equal(call.alpha,1);}
  const palette=new Set(original); for(const pixel of out.pixels)assert.ok(palette.has(pixel),'no invented pixel colors');
  assert.deepEqual(e.saves.at(-1),{n:3,h0:8,pos:'G'});
});
test('capture respects pan/scale and canvas-window clipping instead of anchoring at offscreen field axis',()=>{
  const base=canvas(12,8,{left:10,top:21,right:16,bottom:25,width:6,height:4});
  for(let i=0;i<base.pixels.length;i++)base.pixels[i]=(0xff000000|i)>>>0;
  const e=env({base}); e.api.step(); const s=e.snapshot();
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)assert.equal(s.c.pixels[y*8+x],base.pixels[y*12+x+2]);
  assert.equal(e.appended[0].calls.at(-1).x,-2); // visible-window center, not geo.anchor
});
test('position modes shift original pixels; RGB draws R/G/B in order without tint or added alpha',()=>{
  const e=env(); e.api.step(); const s=e.snapshot(), out=e.appended[0];
  assert.equal(e.api.pos().pos,'B'); assert.equal(out.calls.at(-1).x,-2.25);
  assert.equal(e.api.pos().pos,'RGB'); assert.deepEqual(out.calls.slice(-3).map(c=>c.x),[-1.75,-2,-2.25]);
  assert.equal(e.api.pos().pos,'R'); assert.equal(out.calls.at(-1).x,-1.75);
  assert.equal(e.snapshot(),s);
});
test('changing frame/size does not change source or cycle; disable/re-enable and h0 take a new source',()=>{
  const e=env(); e.api.step(); const old=e.snapshot(); e.ctx.VH=e.ctx.st.rows=256;
  e.wrap.clientWidth=6; e.draw(); assert.equal(e.appended[0].calls.at(-1).w,8); assert.equal(e.snapshot(),old);
  e.api.step(); e.api.step(); assert.equal(e.api.step().n,0); assert.equal(e.snapshot(),null);
  e.cv.pixels.fill(0xffabcdef); e.api.step(); assert.notEqual(e.snapshot(),old); assert.equal(e.snapshot().c.pixels[0],0xffabcdef);
  assert.equal(e.api.h0().n,0); assert.equal(e.snapshot(),null); assert.equal(e.api.get().h0,16);
});
test('F5 takes a new snapshot after session restore and picture readiness, saving only small state',()=>{
  const e=env({saved:{n:2,h0:8,pos:'RGB',pixels:'obsolete'},ready:false}); e.draw(); e.flush(); assert.equal(e.snapshot(),null);
  e.ctx.sessionReady=true; e.ctx.img=null; e.draw(); e.flush(); assert.equal(e.snapshot(),null);
  e.ctx.img={}; e.draw(); e.cv.pixels.fill(0xff123456); e.flush();
  assert.equal(e.snapshot().c.pixels[0],0xff123456); assert.equal(e.api.get().n,2);
  assert.deepEqual(e.saves.at(-1),{n:2,h0:8,pos:'RGB'});
});
test('live GPU is rendered and immediately copied even before the delayed CPU readback',()=>{
  const e=env({gpu:true}); e.ctx.pictureReady=false; e.ctx.img=null;
  e.api.step(); assert.deepEqual(e.events,['cancel:7','render']);
  assert.deepEqual(e.snapshot().c.pixels,e.cv.pixels);
});
test('missing CPU image cannot capture; F5 can capture live GPU without CPU bits',()=>{
  const cpu=env(); cpu.ctx.img=null; assert.equal(cpu.api.step().n,0); assert.equal(cpu.snapshot(),null);
  const gpu=env({gpu:true,saved:{n:2,h0:8,pos:'G'}}); gpu.ctx.img=null; gpu.ctx.pictureReady=false;
  gpu.draw(); gpu.flush(); assert.ok(gpu.snapshot()); assert.equal(gpu.api.get().n,2);
});
test('visible graphic layers are captured, hidden/zero-opacity layers skipped, without artificial background',()=>{
  const ink=canvas(8,8); ink.pixels[0]=0xffbb6611;
  const hidden=canvas(8,8); hidden.pixels.fill(0xffffffff); hidden.style.opacity='0';
  const e=env({layers:[ink,hidden]}); e.api.step(); const s=e.snapshot();
  assert.equal(s.c.pixels[0],0xffbb6611); assert.equal(s.c.pixels[7],0);
  assert.equal(s.c.calls.length,2); assert.equal(s.c.calls[1].src,ink);
  for(const call of s.c.calls)assert.equal(call.smoothing,false);
});
test('invalid saved state is normalized and a small field still permits the initial ×2',()=>{
  const e=env({saved:{n:-7,h0:0,pos:'unknown'}}); assert.deepEqual(JSON.parse(JSON.stringify(e.api.get())),{n:0,h0:8,pos:'G'});
  e.ctx.VH=e.ctx.st.rows=4; assert.equal(e.api.step().n,1); assert.equal(e.api.step().n,0);
});
