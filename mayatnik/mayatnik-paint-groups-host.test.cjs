const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),P=require('./mayatnik-paint-groups.js');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const rgba=([r,g,b])=>(255<<24|b<<16|g<<8|r)>>>0;
function auto(masked){const W=13,H=3,n=W*H,shared=new Uint8Array(n);for(let x=5;x<11;x++)shared[W+x]=2;
 const nodes={bAutoAll:{setAttribute(){}},fillColour:{value:'#aabbcc'},fillInfo:{}},blocked=new Uint8Array(n);for(let y=0;y<H;y++)blocked[y*W+8]=1;
 const c={MayatnikPaintGroups:P,st:{autoFillColour:'#123456',autoFillPalette:false,fillArea:'sides'},PALETTE:['#ff7f27','#00ff00'],autoRun:null,chessLive:false,img:{width:W,height:H},f:{val:new Int8Array(n)},geo:{anchor:5},VX:0,RK:1,fillBits:shared,fillMask:new Uint32Array(n),$:(id)=>nodes[id],rgba,stop(){},k:1,target:0,editSnapshot:()=>c.fillMask.slice(),finishEdit(before){c.before=before;},triangleMapRasterMask:()=>masked?blocked:null,performance:{now:()=>0},requestAnimationFrame(fn){c.next=fn;return 1;},cancelAnimationFrame(){},clearTimeout(){},fillSync(){},draw(){},savePaint(){}};
 c.fillMask[0]=0xff998877;vm.createContext(c);vm.runInContext(block('  function autoStop(){','  // v0.087:'),c);vm.runInContext(block('  function autoPaintAll(){',"  $('bAutoAll').onclick"),c);return {c,nodes,shared,blocked,W};}
test('actual Auto starts with custom own colour, never changes Fill, and leaves shared bits immutable',()=>{
 const {c,nodes,shared,W}=auto(false),before=shared.slice();c.autoPaintAll();c.next();assert.equal(c.fillMask[W+5],rgba([18,52,86]));c.autoStop();assert.equal(nodes.fillColour.value,'#aabbcc');assert.deepEqual(shared,before);assert.equal(c.fillMask[0],0xff998877);assert.ok(c.before);
});
test('Auto mask blocks traversal, not just destination writes; existing paint survives',()=>{
 const a=auto(false),b=auto(true);a.c.autoPaintAll();b.c.autoPaintAll();a.c.next();b.c.next();
 const far=a.W+10;assert.ok(a.c.fillMask[far]);assert.equal(b.c.fillMask[far],0,'same first three columns must not flood through the wall');assert.ok(b.c.fillMask[b.W+5]);
 for(let q=0;q<b.blocked.length;q++)if(b.blocked[q])assert.equal(b.c.fillMask[q],0);assert.equal(b.c.fillMask[0],0xff998877);assert.deepEqual(b.shared,a.shared);
});
function axes(change){const controls={fillColour:{value:'#aabbcc'},axesFillColour:{value:'#123456'},fillMirror:{checked:false},bAxesColour:{},fillInfo:{}},f={};let first=true;
 const c={axesColourBusy:false,sessionReady:true,cacheRestoring:false,frameLibraryBusy:false,templateDragging:false,f,geo:{},gpuBig:null,st:{view:'bits',fillArea:'bit',axesFillColour:'#123456'},k:3,target:0,img:{width:2,height:1},autoAxesPending:true,symPending:false,fillMask:null,paintToolColour:id=>c.st[id],$:(id)=>controls[id],stop(){},navQuick:()=>false,axesColourSeeds:()=>{if(first){first=false;throw Error('pending');}return {indices:new Uint32Array([1]),axes:1};},paintSelection:()=>({indices:new Uint32Array([1])}),rgba,pushHistory:e=>c.history=e,fillSync(){},draw(){},savePaint(){},setTimeout(fn){change(c,controls);c.autoAxesPending=false;fn();}};
 vm.createContext(c);vm.runInContext(block('  async function axesColourApply(){','  window.mayAxesColour='),c);return {c,controls};}
test('axes paint waits on its OWN colour snapshot; changes to ordinary Fill are independent',async()=>{
 const {c}=axes((_,els)=>els.fillColour.value='#ffffff');const result=await c.axesColourApply();assert.equal(result.changed,1);assert.equal(c.fillMask[1],rgba([18,52,86]));assert.equal(c.history.indices.length,1);
 const other=axes(c=>c.st.axesFillColour='#654321');const cancelled=await other.c.axesColourApply();assert.equal(cancelled.changed,0);assert.match(cancelled.reason,/настройки изменились/);assert.equal(other.c.fillMask,null);
});
test('growth colours only new cells and can keep inherited colours',()=>{
 for(const own of [false,true]){const W=5,H=2,n=W*H,old=new Uint32Array(n).fill(12),prior=new Uint32Array(n);prior[1]=0xff112233;const c={MayatnikPaintGroups:P,st:{fillArea:'sides',growOwnColour:own,growFillColour:'#123456'},img:{width:W,height:H,data:new Uint8ClampedArray(old.slice().buffer)},f:{},k:2,VX:0,RK:1,fillBase:old,fillMask:new Uint32Array(n),rombP:()=>-1,triangleMapRasterMask:()=>null,pxView:()=>c.img,fillBit:()=>1,rgba,EMPTY:[0,0,0],hexRGB:hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),fillSync(){},GROW_MAX:100};c.fillMask[4]=0xff998877;vm.createContext(c);vm.runInContext(block('  function fillGrowRun(','  // v0.313:'),c);c.fillGrowRun(new Uint32Array(c.img.data.buffer),'1:flat:0:5:2:1',prior,old,c.f);assert.equal(c.fillMask[1],own?rgba([18,52,86]):0xff112233);assert.equal(c.fillMask[4],0xff998877);}
});
