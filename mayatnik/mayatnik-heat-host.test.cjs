const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const start=html.indexOf('  let heatPrev=null;');
const block=html.slice(start,html.indexOf('  // v0.147:',start));
function harness(){
  let time=0,id=0;const timers=new Map(),events={};
  const h=vm.createContext({performance:{now:()=>time},
    setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),
    st:{heat:true,mode:'pend',bg:'empty',parity:{}},f:{W:4,H:1,val:new Int8Array([0,1,-1,0])},
    geo:{},img:{width:4},VX:0,VW:4,VH:1,RK:1,k:0,paints:0,draws:0,
    pxHide:new Set(),pxBase:null,pxAnimPre:null,rgbNeighbourClasses:null,
    document:{hidden:false,addEventListener:(name,fn)=>events[name]=fn},
    window:{addEventListener:(name,fn)=>events[name]=fn},rombP:()=>-1,
    parityField(){return h.f;},lockCell(px,q,col){px[q]=col;}
  });
  vm.runInContext(fs.readFileSync(__dirname+'/mayatnik-heat.js','utf8'),h);
  const helpers=['rgbNeighbourFilters','rgbNeighbourBWMode'].map(name=>{
    const start=html.indexOf('  function '+name+'('),end=html.indexOf('\n',start);
    return html.slice(start,end);
  }).join('\n');
  const fam=html.slice(html.indexOf('  const pxFam ='),html.indexOf('  let pxImg ='));
  vm.runInContext(helpers+'\n'+fam+'\n'+block+'\nfunction draw(){draws++;shown=new Uint32Array(drawBase||[7,8,9,10]);heatApply(shown);}\nvar drawBase=null;',h);
  h.ImageData=function(width,height){this.width=width;this.height=height;this.data=new Uint8ClampedArray(width*height*4);};
  const view=html.slice(html.indexOf('  const pxView ='),html.indexOf('  window.mayPx ='));
  vm.runInContext('var pxImg=null;const EMPTY=[5,5,5];const rgba=c=>(0xff000000|c[2]<<16|c[1]<<8|c[0])>>>0;\n'+view,h);
  return {h,events,timers,draw:()=>vm.runInContext('draw()',h),set time(v){time=v;},
    visible(){h.img={width:4,height:1,data:new Uint8ClampedArray(h.shown.buffer)};return Array.from(vm.runInContext('new Uint32Array(pxView().data.buffer)',h));},
    tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}
test('native heat host cools on PAUSE from clean raster without moving frame, painting or changing source bits',()=>{
  const t=harness(),h=t.h;t.draw();assert.equal(h.shown[2],9);
  t.time=100;h.f.val[0]=1;h.f.val[1]=0;h.k=1;t.draw();
  const hot=Array.from(h.shown),source=Array.from(h.f.val);assert.equal(t.timers.size,1);
  t.time=1100;t.tick();const middle=Array.from(h.shown);assert.notDeepEqual(middle,hot);
  t.draw();assert.deepEqual(Array.from(h.shown),middle,'same time redraw has no cumulative mixing');
  t.time=2100;t.tick();assert.deepEqual(Array.from(h.shown),[h.MayatnikHeat.cold[1],h.MayatnikHeat.cold[0],9,h.MayatnikHeat.cold[0]]);
  assert.equal(t.timers.size,0);assert.equal(h.k,1);assert.equal(h.paints,0);assert.deepEqual(Array.from(h.f.val),source);
});
test('off restores ordinary pixels; hidden expiration redraws once on resume',()=>{
  const t=harness(),h=t.h;t.draw();h.k=1;h.f.val[0]=1;t.draw();
  h.document.hidden=true;t.events.visibilitychange();assert.equal(t.timers.size,0);
  t.time=3000;h.document.hidden=false;const before=h.draws;t.events.visibilitychange();
  assert.equal(h.draws,before+1);assert.equal(h.shown[0],h.MayatnikHeat.cold[1]);assert.equal(t.timers.size,0);
  h.st.heat=false;t.draw();assert.deepEqual(Array.from(h.shown),[7,8,9,10]);
});
test('plain and assembled Rombo both use native drawPost heat before presentation',()=>{
  const drawPost=html.slice(html.indexOf('  function drawPost('),html.indexOf('  // v0.130',html.indexOf('  function drawPost(')));
  assert.ok(drawPost.indexOf('heatApply(px)')<drawPost.indexOf('present()'));
  assert.match(html,/romboSourceCanvas\(\)/);assert.match(html,/if\(f&&geo\)window\.mayRombo\?\.render\(layoutOnly\)/);
});

test('RGB class exclusions remain empty through warm, cooling and cold redraws; BW stays eligible',()=>{
  const t=harness(),h=t.h;
  h.st.view='rgbNeighbours';h.st.rgbNeighbourFilters=[1];h.rgbNeighbourClasses=new Uint8Array([0,1,255,0]);
  h.drawBase=new Uint32Array([0xff050505,0xffffffff,0xff050505,0xff050505]);t.draw();
  const source=Array.from(h.f.val);assert.equal(h.shown[0],h.drawBase[0]);assert.equal(h.shown[3],h.drawBase[3]);
  h.k++;h.f.val[0]=1;h.f.val[1]=0;t.draw();assert.equal(h.shown[0],h.drawBase[0]);
  t.time=1000;t.tick();assert.equal(h.shown[0],h.drawBase[0]);
  t.time=2000;t.tick();assert.equal(h.shown[0],h.drawBase[0]);assert.equal(t.timers.size,0);
  assert.equal(h.shown[1],h.MayatnikHeat.cold[0]);
  h.st.rgbNeighbourBW=1;t.draw();assert.equal(h.shown[0],h.MayatnikHeat.cold[1]);
  assert.equal(h.f.val[2],source[2]);
});

test('hidden unpainted base colours stay untouched, genuine paint remains eligible, including animation baseline',()=>{
  const t=harness(),h=t.h,red=0xff2030ff,paint=0xff40dd40,animation=0xffe8d65c;
  h.pxHide.add('r');h.pxBase=new Uint32Array([red,red,9,red]);
  h.drawBase=new Uint32Array([red,paint,9,red]);t.draw();
  assert.equal(h.shown[0],red,'untouched base remains available for pxView hiding');
  assert.equal(t.visible()[0],0xff050505,'actual pxView keeps underlying hidden colour empty');
  assert.equal(h.shown[1],h.MayatnikHeat.cold[1],'real paint is not classified as hidden base');
  h.st.animHl=2;h.pxHide.add('b');h.pxAnimPre=new Uint32Array([red,paint,9,red]);h.drawBase=new Uint32Array([animation,animation,9,animation]);
  t.draw();assert.equal(h.shown[0],animation,'heat preserves the animation baseline hiding decision');
  assert.equal(t.visible()[0],0xff050505,'actual pxView falls back through animation to hidden original');
  assert.equal(h.shown[1],h.MayatnikHeat.cold[1]);
  h.k++;h.f.val[0]=1;t.draw();t.time=2000;t.tick();assert.equal(h.shown[0],animation);
  assert.equal(t.timers.size,0);
});
