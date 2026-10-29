const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
const Geometry=require('./mayatnik-auto-axis-geometry.js'),Axes=require('./mayatnik-axis-colour.js'),Style=require('./mayatnik-axis-style.js');
function section(a,b){const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end);}
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);let i=b+1,d=1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture(state={}){
 const W=17,H=10,nodes=new Map(),history=[],st={rows:H,view:'bits',fixLines:true,fixCross:true,saw:false,anchorAxis:false,fillArea:'sides',...state};
 const c={st,VW:W,VH:H,VX:0,RK:1,RG:0,f:{W,H,val:new Int8Array(W*H).fill(1)},geo:{anchor:8},g:{},k:7,bmGen:0,gpuBig:null,gpuPaintRequests:0,window:{},performance,setTimeout,
  img:{width:W,height:H,data:new Uint8ClampedArray(W*H*4).fill(117)},fillMask:null,paintBits:new Int8Array(W*H).fill(-1),sessionReady:true,cacheRestoring:false,frameLibraryBusy:false,templateDragging:false,symPending:'',autoAxesPending:'',
  MayatnikAutoAxisGeometry:Geometry,MayatnikAxisColour:Axes,MayatnikNAxes:{normaliseSets:x=>x||[],positions:s=>s.xs},MayatnikSymmetry:{point:(dir,axis,t)=>dir==='v'?[axis,t]:[t,axis]},
  $:id=>{if(!nodes.has(id))nodes.set(id,{checked:false});return nodes.get(id);},document:{body:{classList:{contains:()=>false}}},picOn:()=>true,rombP:()=>-1,joinedOn:()=>false,dispH:()=>H,
  displayCell:(x,y)=>{const col=Math.floor(x),r=Math.floor(y);return col<0||col>=W||r<0||r>=H?null:{c:col,r,p:-1,q:r*W+col};},displayPoint:(col,r)=>({x:col+.5,y:r+.5}),parityVisible:()=>true,outShow:()=>false,fillBit:(x,y)=>c.f.val[Math.floor(y)*W+Math.floor(x)],
  fixSegments:()=>[[4,0,8,4,13,9,4],[12,0,8,4,3,9,4]],fixShown:()=>st.fixLines!==false||st.fixCross!==false,fixBound:()=>st.fixLines!==false,Path2D:class{moveTo(){}lineTo(){}},axisStroke:(G,o)=>Style.stroke(G,o),fixPad(){assert.fail('read-only collector changed padding');},vtxLabels(){assert.fail('read-only collector changed labels');},
  symGet:()=>({segs:[]}),autoAxesGet:()=>({segments:[]}),triangleMapGet:()=>({axes:[]}),navQuick:()=>false,stopFrameTransports(){c.stops++;},stops:0,paintToolColour:()=>'#123456',rgba:()=>0xff563412,
  paintSelection:(x,y,mirror,manual,indices)=>({indices}),pushHistory:e=>history.push(e),fillSync(){},draw(){c.draws++;},draws:0,savePaint(){c.saves++;},saves:0,history};
 c.gpuPaintCpu=()=>!!c.gpuBig&&(c.gpuPaintRequests>0||!!c.fillMask);
 vm.createContext(c);vm.runInContext(section('  function fixPts(','  // v0.205:')+section('  function fixLinesDraw(','  // v0.245 →')+section('  function guideBottom(','  function guideHeight(')+section('  let axesColourBusy=','  // v0.480:'),c);return c;
}
const sorted=xs=>Array.from(xs).sort((a,b)=>a-b);
test('only meeting axes enable the existing button and seed every displayed branch, cross and continuation',()=>{
 const c=fixture(),before=c.f.val.slice(),pixels=c.img.data.slice(),expected=new Set();
 for(let r=0;r<10;r++){for(const col of [4+r,12-r,8])expected.add(r*17+col);}for(let col=0;col<17;col++)expected.add(4*17+col);
 assert.equal(c.axesColourStatus().ready,true);const result=c.axesColourSeeds();assert.equal(result.axes,6);assert.deepEqual(sorted(result.indices),sorted(expected));assert.deepEqual(c.f.val,before);assert.deepEqual(c.img.data,pixels);
 c.st.fixCross=false;const upper=new Set();for(let r=0;r<=4;r++)for(const col of [4+r,12-r])upper.add(r*17+col);assert.deepEqual(sorted(c.axesColourSeeds().indices),sorted(upper));
 c.st.fixLines=false;assert.equal(c.axesColourStatus().ready,false);assert.match(c.axesColourStatus().reason,/Нет показанных осей/);
});
test('anchor contributes only when its actual through-field overlay is visible; picture and romb guards exclude phantom meeting axes',()=>{
 const c=fixture({fixLines:false,fixCross:false,anchorAxis:true,lineMeasures:true});assert.deepEqual(sorted(c.axesColourSeeds().indices),Array.from({length:10},(_,r)=>r*17+8));
 for(const hide of [()=>c.st.lineMeasures=false,()=>c.st.anchorAxis=false,()=>c.picOn=()=>false,()=>c.rombP=()=>0,()=>c.document.body.classList.contains=()=>true]){
  c.st.lineMeasures=true;c.st.anchorAxis=true;c.picOn=()=>true;c.rombP=()=>-1;c.document.body.classList.contains=()=>false;hide();assert.equal(c.axesColourGuides().length,0);
 }
});
test('existing symmetry, N axes, triangle-map and automatic families still seed the union together with meeting lines',()=>{
 const c=fixture({sym:true,autoAxes:true,triangleMapAxes:true,nAxisSets:[{id:'n',row:0,xs:[-7]}]});
 c.symGet=()=>({segs:[{dir:'v',axis:2,t0:0,t1:9,p:-1}]});c.autoAxesGet=()=>({segments:[{x:14.5,y0:0,y1:10}]});c.triangleMapGet=()=>({axes:[{p:-1,a:[15.5,0],b:[15.5,10]}]});
 const q=new Set(c.axesColourSeeds().indices);for(const col of [1,2,8,14,15])for(let r=0;r<10;r++)assert.ok(q.has(r*17+col),`${col},${r}`);
});
test('automatic axes touch exact displayed centres in both romb lattices, side-by-side and joined projections',()=>{
 const Joined=require('./mayatnik-joined-romb.js');
 for(const mode of ['romb0','romb1','romb2','rombJoin','rombJoin180']){
  const c=fixture({view:mode,fixLines:false,fixCross:false,autoAxes:true}),rp=mode==='romb0'?0:mode==='romb1'?1:mode==='romb2'?2:3,joined=rp===3;
  c.RK=4;c.RG=3;c.rombP=()=>rp;c.joinedOn=()=>joined;c.joinedGeometry=()=>Joined.create({width:17,height:10,anchor:8,rotate:mode==='rombJoin180'});c.dispH=()=>joined?20:10;
  c.img={width:(rp===2?37:17)*4,height:(joined?20:10)*4};c.f.val=Int8Array.from({length:170},(_,q)=>q%2);c.autoAxesGet=()=>({segments:[{x:8.5,y0:0,y1:10}]});
  vm.runInContext(html.match(/  const halfOf =[^\n]+/)[0]+fn('rombCell')+fn('displayCell')+fn('displayPoint'),c);
  c.fillBit=(x,y)=>{const cell=c.displayCell((x+.5)/4,(y+.5)/4);return cell?c.f.val[cell.q]:-1;};
  const expected=[];for(const p of rp===2||joined?[0,1]:[rp])for(let r=p;r<10;r+=2){const x=8.5+(rp===2&&p===1?20:0),y=joined&&p===1?20-r-.5:r+.5;expected.push(Math.floor(y*4)*c.img.width+Math.floor(x*4));}
  const before=c.f.val.slice();assert.deepEqual(sorted(c.axesColourSeeds().indices),expected.sort((a,b)=>a-b),mode);assert.deepEqual(c.f.val,before);
 }
});
test('meeting apply preserves source bits and pixels, commits all seeds in one undo entry, and repeated colour is a no-op',async()=>{
 const c=fixture({saw:true,sawFull:true}),bits=c.f.val.slice(),pixels=c.img.data.slice(),expected=sorted(c.axesColourSeeds().indices),r=await c.window.mayAxesColour.apply();
 assert.equal(r.changed,expected.length);assert.equal(c.history.length,1);assert.deepEqual(sorted(c.history[0].indices),expected);assert.deepEqual(c.f.val,bits);assert.deepEqual(c.img.data,pixels);assert.equal(c.stops,1);
 assert.equal((await c.window.mayAxesColour.apply()).changed,0);assert.equal(c.history.length,1);for(let i=0;i<c.history[0].indices.length;i++)c.fillMask[c.history[0].indices[i]]=c.history[0].previous[i];assert.ok(c.fillMask.every(x=>!x));
});
test('GPU exact-frame request finishes before painting and retains CPU display for its paint layer',async()=>{
 const c=fixture({sym:true}),bits=c.f.val.slice();c.gpuBig={fresh:false,k:6,snapshotPending:{}};c.img=null;let requested=false;
 c.draw=()=>{if(!requested){requested=true;assert.equal(c.gpuPaintRequests,1);setTimeout(()=>{c.gpuBig.fresh=true;c.gpuBig.k=7;c.gpuBig.snapshotPending=null;c.img={width:17,height:10,data:new Uint8ClampedArray(680)};},1);}};
 const r=await c.window.mayAxesColour.apply();assert.ok(r.changed>0);assert.deepEqual(c.f.val,bits);assert.equal(c.history.length,1);assert.equal(c.gpuPaintRequests,0);assert.equal(c.gpuPaintCpu(),true);c.fillMask=null;assert.equal(c.gpuPaintCpu(),false);
});
test('GPU failure, cancelled snapshot and timeout terminate explicitly without a paint transaction',async()=>{
 for(const kind of ['error','cancelled','timeout']){
  const c=fixture();c.gpuBig={fresh:false,k:6,snapshotPending:{}};c.img=null;let now=0;c.performance={now:()=>now};
  c.draw=()=>{if(kind==='error')c.gpuBig.snapshotError={message:'device lost'};if(kind==='cancelled')c.gpuBig.snapshotPending=null;if(kind==='timeout')now=120001;};
  const r=await c.window.mayAxesColour.apply();assert.equal(r.changed,0);assert.match(r.reason,kind==='error'?/device lost/:kind==='cancelled'?/отменено/:/120 секунд/);assert.equal(c.history.length,0);assert.equal(c.fillMask,null);assert.equal(c.gpuPaintRequests,0);
 }
});
test('all axis settings, source generation and display geometry cancel a pending search before any commit',async()=>{
 for(const change of [c=>c.st.fixDx=1,c=>c.st.fixCross=false,c=>c.st.anchorAxis=true,c=>c.st.nAxisSets=[{row:0,xs:[1]}],c=>c.st.view='romb0',c=>c.k++,c=>c.bmGen++,c=>c.RK=4]){
  const c=fixture({sym:true});c.symPending='pending';let once=false;c.symGet=()=>{if(!once){once=true;setTimeout(()=>change(c),1);}return null;};
  const r=await c.window.mayAxesColour.apply();assert.equal(r.changed,0);assert.match(r.reason,/изменил/);assert.equal(c.history.length,0);assert.equal(c.fillMask,null);
 }
});
test('readback API returns one settled promise for repeated requests and always clears its own pending marker',async()=>{
 const Snapshot=require('./mayatnik-gpu-snapshot.js');
 for(const mode of ['ready','playing','error','cancelled']){
  let read;const c={f:{val:new Int8Array(4)},k:1,st:{ochki:false},playing:false,gpuSnapshot:Snapshot.create(),setTimeout,ochkiKey:()=>'frame',gpuManualCpu:()=>false,gpuPaintCpu:()=>true,gpuCpuDisplay:()=>true,draw(){},
   gpuBig:{read:0,fresh:false,fld:{read:()=>new Promise((resolve,reject)=>{read=mode==='error'?()=>reject(Error('read failure')):()=>resolve(new Int8Array(4).fill(1));})}},$:()=>({})};
  vm.createContext(c);vm.runInContext(section('  function gpuReadSoon(','  // v0.474:'),c);const a=c.gpuReadSoon(0),b=c.gpuReadSoon(0);assert.equal(a,b);assert.equal(a,c.gpuBig.snapshotPending.promise);
  await new Promise(resolve=>setTimeout(resolve,1));if(mode==='cancelled')c.k=2;if(mode==='playing')c.playing=true;read();const result=await a;const ready=mode==='ready'||mode==='playing';assert.equal(result.status,ready?'ready':mode);assert.equal(c.gpuBig.snapshotPending,null);assert.deepEqual(Array.from(c.f.val),Array(4).fill(ready?1:0));
 }
});
test('resumed playback keeps the painted CPU frame until its next exact snapshot is ready',()=>{
 const c={playing:true,k:7,gpuBig:{snapshotPending:{}},gpuManualCpu:()=>false,gpuPaintCpu:()=>true,next(){c.scheduled++;},scheduled:0};vm.createContext(c);
 vm.runInContext(section('  function tick() {','  function play() {'),c);c.tick();assert.equal(c.k,7);assert.equal(c.playing,true);assert.equal(c.scheduled,1);
});
