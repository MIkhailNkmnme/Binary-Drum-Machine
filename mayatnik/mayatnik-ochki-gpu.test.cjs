const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const snapshot=require('./mayatnik-gpu-snapshot.js');
function fn(name){const at=html.indexOf('function '+name+'(');assert.ok(at>=0,name);let end=html.indexOf('{',at),depth=1;while(depth){end++;if(html[end]==='{')depth++;else if(html[end]==='}')depth--;}return html.slice(at,end+1);}
const turn=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function fixture(){
  const read=deferred(),timers=[],nodes=new Map(),calls=[];
  const c={f:{W:4,H:2,val:new Int8Array(8)},k:3,st:{ochki:true,view:'bits',noband:false},playing:false,Int8Array,gpuSnapshot:snapshot.create(),
    gpuBig:{read:0,fresh:false,fld:{read(...args){assert.equal(args.length,0,'read must never mutate live field directly');calls.push('read');return read.promise;}}},
    setTimeout:cb=>(timers.push(cb),timers.length),ochkiKey:()=>c.k+'|'+c.st.view,gpuCpuOchki:()=>!!c.gpuBig&&c.st.ochki,gpuManualCpu:()=>false,gpuPaintCpu:()=>false,gpuCpuDisplay:()=>!!c.gpuBig&&c.st.ochki,
    draw:()=>calls.push('draw'),gpuPicture:()=>calls.push('picture'),gpuPost:()=>calls.push('post'),cssLayout:()=>calls.push('layout'),canvasSize:()=>calls.push('size'),updWin:()=>false,
    publishOchki:(result,reason)=>calls.push(['publish',result,reason]),$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},ochki:{old:true}};
  Object.assign(c,{templateFollowActive:()=>false,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false});vm.createContext(c);vm.runInContext(fn('gpuReadSoon'),c);return {c,read,timers,nodes,calls};
}
test('host reads the full fixed GPU frame before search; geometry updates precede draw',async()=>{
  const {c,read,timers,calls}=fixture();c.st.noband=true;c.updWin=()=>{calls.push('window');c.st.view='romb2';return true;};
  c.gpuReadSoon(0);c.gpuReadSoon(0);assert.equal(timers.length,1,'one read per request');timers.shift()();
  assert.deepEqual([...c.f.val],Array(8).fill(0));assert.deepEqual(calls,['read']);
  read.resolve(new Int8Array(8).fill(1));await turn();
  assert.deepEqual([...c.f.val],Array(8).fill(1));assert.equal(c.gpuBig.k,3);assert.equal(c.gpuBig.fresh,true);
  assert.deepEqual(calls,['read','window','size','layout','draw']);assert.equal(c.gpuBig.snapshotPending,null);
});
test('host discards stale reads across frame, field, view and GPU replacement',async()=>{
  for(const change of ['frame','field','view','gpu']){
    const {c,read,timers,calls}=fixture(),owner=c.f;c.gpuReadSoon(0);timers.shift()();
    if(change==='frame')c.k++;if(change==='field')c.f={...owner,val:new Int8Array(8)};if(change==='view')c.st.view='romb1';if(change==='gpu')c.gpuBig={};
    read.resolve(new Int8Array(8).fill(1));await turn();assert.deepEqual([...owner.val],Array(8).fill(0),change);assert.deepEqual([...c.f.val],Array(8).fill(0),change);assert.deepEqual(calls,['read'],change);
  }
});

test('exact Ochki readback remains valid while playing and completion never changes explicit Play or Stop',async()=>{
  for(const transition of ['playing','resume','stop']){
    const {c,read,timers,calls}=fixture();c.st.speed=17;c.playing=transition!=='resume';c.gpuReadSoon(0);timers.shift()();
    c.playing=transition!=='stop';const expected=c.playing;read.resolve(new Int8Array(8).fill(1));await turn();
    assert.deepEqual([...c.f.val],Array(8).fill(1));assert.equal(c.gpuBig.fresh,true);assert.equal(c.gpuBig.snapshotPending,null);assert.equal(c.playing,expected);assert.equal(c.st.speed,17);assert.deepEqual(calls,['read','draw']);
  }
});

test('playback readback with Ochki and all CPU consumers disabled is discarded rather than applied to a moving field',async()=>{
  const {c,read,timers,calls}=fixture();c.gpuReadSoon(0);timers.shift()();c.st.ochki=false;c.playing=true;read.resolve(new Int8Array(8).fill(1));await turn();assert.deepEqual([...c.f.val],Array(8).fill(0));assert.deepEqual(calls,['read']);
});
test('host reports a failed full read explicitly and never starts or publishes a partial search',async()=>{
  const {c,read,timers,calls,nodes}=fixture(),pending=c.gpuReadSoon(0);timers.shift()();read.reject(new RangeError('memory'));const result=await pending;assert.equal(result.status,'error');assert.equal(result.error.message,'memory');assert.equal(c.gpuBig.snapshotPending,null);assert.deepEqual([...c.f.val],Array(8).fill(0));
  assert.equal(c.gpuBig.fresh,false);assert.equal(c.ochki,null);assert.equal(c.gpuBig.snapshotError.message,'memory');assert.match(nodes.get('ochkiSum').textContent,/ошибка полного чтения GPU/);assert.equal(calls.some(x=>x==='draw'),false);
  assert.equal(calls[1][0],'publish');assert.equal(calls[1][1],null);
});
test('GPU OFF during read returns to GPU presentation without cancelling the valid field snapshot',async()=>{
  const {c,read,timers,calls}=fixture();c.gpuReadSoon(0);timers.shift()();c.st.ochki=false;read.resolve(new Int8Array(8).fill(1));await turn();assert.deepEqual(calls,['read','picture','post']);
});

test('manual projected playback waits for exact snapshot without accepting a stale frame or pausing transport',async()=>{
  for(const stale of [false,true]){
    const {c,read,timers,calls}=fixture();c.st.ochki=false;c.playing=true;c.gpuManualCpu=()=>true;c.gpuCpuDisplay=()=>true;
    c.gpuReadSoon(0);timers.shift()();let scheduled=0;c.next=()=>scheduled++;
    vm.runInContext(fn('tick'),c);c.tick();assert.equal(scheduled,1);assert.equal(c.k,3);assert.equal(c.playing,true);
    if(stale)c.k=4;read.resolve(new Int8Array(8).fill(1));await turn();
    assert.equal(c.gpuBig.snapshotPending,null);assert.equal(c.playing,true);
    assert.deepEqual([...c.f.val],Array(8).fill(stale?0:1));assert.deepEqual(calls,stale?['read']:['read','draw']);
  }
});

test('manual CPU display is limited to visible romb operations while Ochki readback permits active playback',()=>{
  const c={gpuBig:{},templatePaintLayer:null,fillMask:null,fillHistory:[],fillRedo:[],gpuPaintRequests:0,st:{ochki:false},rombP:()=>0,manualPaintOn:()=>false,manualMirrorPlan:()=>[]};Object.assign(c,{templateFollowActive:()=>false,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false});vm.createContext(c);
  vm.runInContext(['gpuCpuOchki','gpuManualCpu','gpuPaintCpu','gpuCpuDisplay','gpuDisplay'].map(name=>html.match(new RegExp('  const '+name+' =[^\\n]+'))[0]).join('\n')+'\nthis.display=()=>gpuCpuDisplay();this.manual=()=>gpuManualCpu();',c);
  assert.equal(c.display(),false);c.manualMirrorPlan=()=>[{k:'h',m:2}];assert.equal(c.display(),true);
  c.rombP=()=>-1;assert.equal(c.display(),false);c.manualMirrorPlan=()=>[];c.manualPaintOn=()=>true;c.rombP=()=>2;assert.equal(c.display(),true);
  c.manualPaintOn=()=>false;c.st.ochki=true;assert.equal(c.display(),true);assert.equal(c.manual(),false);
  assert.doesNotMatch(fn('draw'),/if\(gpuCpuOchki\(\)[^\n]*stopFrameTransports/);assert.match(fn('draw'),/cv.width=1;cv.height=1;gpuBig.cpuRaster=false;img=null/);
});
test('GPU calculation keeps its identity while CPU geometry covers every romb and restores GPU canvas on OFF',()=>{
  for(const rp of [-1,0,1,2,3]){
    const owner={},c={templatePaintLayer:null,fillMask:null,fillHistory:[],fillRedo:[],gpuPaintRequests:0,st:{ochki:true},gpuBig:owner,RG:0,RK:1,VW:20,VH:8,img:null,cv:{width:4,height:4},wrap:{clientWidth:640},wrapPadX:()=>0,rombP:()=>rp,
      g:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})}};
    c.manualPaintOn=()=>false;c.manualMirrorPlan=()=>[];c.dispW=()=>rp===2?2*c.VW+c.RG:c.VW;c.dispH=()=>rp===3?2*c.VH:c.VH;
    Object.assign(c,{templateFollowActive:()=>false,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false});vm.createContext(c);vm.runInContext(['gpuCpuOchki','gpuManualCpu','gpuPaintCpu','gpuCpuDisplay','gpuDisplay'].map(name=>html.match(new RegExp('  const '+name+' =[^\n]+'))[0]).join('\n')+fn('canvasSize'),c);
    c.canvasSize();assert.equal(c.gpuBig,owner);assert.equal(c.gpuBig.cpuRaster,true);assert.equal(c.img.width,c.dispW()*c.RK);assert.equal(c.img.height,c.dispH()*c.RK);if(rp===2)assert.ok(c.RG>=2);
    c.st.ochki=false;c.canvasSize();assert.equal(c.gpuBig,owner);assert.equal(c.img,null);assert.equal(c.RK,1);assert.equal(c.RG,0);assert.equal(c.gpuBig.cpuRaster,false);assert.equal(c.cv.width,1);
  }
});
test('CPU presentation is selected consistently and async GPU post cannot overwrite it',async()=>{
  for(const name of ['present','cellSource','gifViewFrame','ovlCapture'])assert.match(fn(name),/gpuDisplay\(\)/,name);
  const read=deferred();let calls=0,c={gpuBig:{fresh:true,fld:{readPic:()=>read.promise}},gpuCpuDisplay:()=>false,k:1,playing:false,VW:2,VH:2};
  c.gpuPostDone=()=>calls++;Object.assign(c,{templateFollowActive:()=>false,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false});vm.createContext(c);vm.runInContext('async '+fn('gpuPost'),c);const p=c.gpuPost();c.gpuCpuDisplay=()=>true;read.resolve(new Uint32Array(4));await p;assert.equal(c.img,undefined);assert.equal(calls,0);
  const draw=fn('draw'),catchAt=draw.lastIndexOf('}catch(error){');assert.ok(catchAt>0);assert.doesNotMatch(draw.slice(0,catchAt),/stopFrameTransports\(\)/);assert.match(draw.slice(catchAt),/if\(playing\)stopFrameTransports\(\)/,'real display errors still stop safely');assert.match(draw,/if\(!same\)[\s\S]*gpuReadSoon\(0\)/);
  assert.match(fn('ochkiRecordFrame'),/status:'found'/);assert.doesNotMatch(fn('ochkiRecordFrame'),/captureOchkiFrame|mayFrameLibrary|\.save\(|stop\(|stopFrameTransports/);
});

test('exact-search gate waits for GPU and snake completion without changing Play, but errors stop transport',()=>{
  let draws=0,searches=0,stops=0,result={complete:false};const c={st:{ochki:true,ochkiSnake:true},f:{},k:3,playing:true,
    gpuBig:{fresh:false,k:3,pend:[],snapshotPending:null},draw:()=>draws++,ochkiKey:()=> 'key',ochkiFindingsSuppressed:()=>false,
    ochkiFor:()=>{searches++;return result;},ochkiSnakeJob:null,ochkiSnakeFailed:'',stopFrameTransports(){stops++;c.playing=false;}};
  vm.createContext(c);vm.runInContext(fn('ochkiFrameWait'),c);
  assert.equal(c.ochkiFrameWait(),true);assert.equal(draws,1);assert.equal(searches,0);assert.equal(c.playing,true);
  c.gpuBig.snapshotPending={};assert.equal(c.ochkiFrameWait(),true);assert.equal(draws,1);assert.equal(c.playing,true);
  c.gpuBig.snapshotPending=null;c.gpuBig.fresh=true;c.ochkiSnakeJob={};assert.equal(c.ochkiFrameWait(),true);assert.equal(searches,1);assert.equal(c.playing,true);
  result={complete:true};c.ochkiSnakeJob={};assert.equal(c.ochkiFrameWait(),true);c.ochkiSnakeJob=null;assert.equal(c.ochkiFrameWait(),false);assert.equal(stops,0);
  c.ochkiSnakeFailed='key';assert.equal(c.ochkiFrameWait(),true);assert.equal(c.playing,false);assert.equal(stops,1);
  c.ochkiSnakeFailed='';c.playing=true;c.gpuBig.fresh=false;c.gpuBig.snapshotError={key:'key'};assert.equal(c.ochkiFrameWait(),true);assert.equal(c.playing,false);assert.equal(stops,2);
  c.gpuBig.fresh=true;c.gpuBig.snapshotError=null;c.playing=true;result={complete:false};assert.equal(c.ochkiFrameWait(),true);assert.equal(c.playing,false);assert.equal(stops,3,'an incomplete final result cannot masquerade as finished work');
});

test('failed or truncated playback snapshots stop explicitly and never commit partial bits or resume',async()=>{
  for(const truncated of [false,true]){const {c,read,timers,calls}=fixture();let stopped=0;c.playing=true;c.st.speed=13;c.stopFrameTransports=()=>{stopped++;c.playing=false;};
    const pending=c.gpuReadSoon(0);timers.shift()();if(truncated)read.resolve(new Int8Array(7).fill(1));else read.reject(Error('read failed'));
    const result=await pending;assert.equal(result.status,'error');assert.equal(stopped,1);assert.equal(c.playing,false);assert.equal(c.st.speed,13);assert.equal(c.gpuBig.fresh,false);assert.equal(c.gpuBig.snapshotPending,null);assert.deepEqual([...c.f.val],Array(8).fill(0));assert.equal(calls.includes('draw'),false);await turn();assert.equal(c.playing,false);
  }
});
test('joined GPU-field CPU image masks projected cells instead of interpreting display rows as raw field rows',()=>{
  const c={img:{width:3,height:4},f:{W:3,H:2},VX:0,parityActive:()=>true,rgba:()=>99,EMPTY:[],joinedOn:()=>true,gpuDisplay:()=>false,
    cellMapper:()=>((x,y)=>y<2?y*3+x:(3-y)*3+2-x),parityVisible:(r,col)=>r===0&&col===1};
  Object.assign(c,{templateFollowActive:()=>false,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false});vm.createContext(c);vm.runInContext(fn('parityMask'),c);const px=new Uint32Array(12).fill(7);c.parityMask(px);
  assert.deepEqual([...px],[99,7,99,99,99,99,99,99,99,99,7,99]);
});
test('CPU image allocation failure is explicit and never leaves a previous raster marked ready',()=>{
  const nodes=new Map(),c={st:{ochki:true},gpuBig:{cpuRaster:true},RG:0,RK:1,VW:20,VH:8,img:{old:true},cv:{},wrap:{clientWidth:640},wrapPadX:()=>0,rombP:()=>-1,
    g:{createImageData(){throw new RangeError('allocation');}},dispW:()=>20,dispH:()=>8,gpuDisplay:()=>false,gpuCpuDisplay:()=>true,ochkiKey:()=> 'frame',publishOchki:(r,reason)=>{c.published={r,reason};},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
  Object.assign(c,{templateFollowActive:()=>false,manualPaintCurrent:()=>null,manualPaintEntryCurrent:()=>false});vm.createContext(c);vm.runInContext(fn('canvasSize'),c);c.canvasSize();assert.equal(c.img,null);assert.equal(c.gpuBig.cpuRaster,false);assert.equal(c.published.r,null);assert.match(c.published.reason,/Ошибка памяти полного изображения/);assert.equal(nodes.get('ochkiBox').hidden,false);
});
