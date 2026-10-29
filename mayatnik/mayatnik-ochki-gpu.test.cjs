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
    setTimeout:cb=>(timers.push(cb),timers.length),ochkiKey:()=>c.k+'|'+c.st.view,gpuCpuOchki:()=>!!c.gpuBig&&c.st.ochki,
    draw:()=>calls.push('draw'),gpuPicture:()=>calls.push('picture'),gpuPost:()=>calls.push('post'),cssLayout:()=>calls.push('layout'),canvasSize:()=>calls.push('size'),updWin:()=>false,
    publishOchki:(result,reason)=>calls.push(['publish',result,reason]),$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},ochki:{old:true}};
  vm.createContext(c);vm.runInContext(fn('gpuReadSoon'),c);return {c,read,timers,nodes,calls};
}
test('host reads the full fixed GPU frame before search; geometry updates precede draw',async()=>{
  const {c,read,timers,calls}=fixture();c.st.noband=true;c.updWin=()=>{calls.push('window');c.st.view='romb2';return true;};
  c.gpuReadSoon(0);c.gpuReadSoon(0);assert.equal(timers.length,1,'one read per request');timers.shift()();
  assert.deepEqual([...c.f.val],Array(8).fill(0));assert.deepEqual(calls,['read']);
  read.resolve(new Int8Array(8).fill(1));await turn();
  assert.deepEqual([...c.f.val],Array(8).fill(1));assert.equal(c.gpuBig.k,3);assert.equal(c.gpuBig.fresh,true);
  assert.deepEqual(calls,['read','window','size','layout','draw']);assert.equal(c.gpuBig.snapshotPending,null);
});
test('host discards reads across frame, field, view, GPU replacement and resumed playback',async()=>{
  for(const change of ['frame','field','view','gpu','playing']){
    const {c,read,timers,calls}=fixture(),owner=c.f;c.gpuReadSoon(0);timers.shift()();
    if(change==='frame')c.k++;if(change==='field')c.f={...owner,val:new Int8Array(8)};if(change==='view')c.st.view='romb1';if(change==='gpu')c.gpuBig={};if(change==='playing')c.playing=true;
    read.resolve(new Int8Array(8).fill(1));await turn();assert.deepEqual([...owner.val],Array(8).fill(0),change);assert.deepEqual([...c.f.val],Array(8).fill(0),change);assert.deepEqual(calls,['read'],change);
  }
});
test('host reports a failed full read explicitly and never starts or publishes a partial search',async()=>{
  const {c,read,timers,calls,nodes}=fixture();c.gpuReadSoon(0);timers.shift()();read.reject(new RangeError('memory'));await turn();
  assert.equal(c.gpuBig.fresh,false);assert.equal(c.ochki,null);assert.equal(c.gpuBig.snapshotError.message,'memory');assert.match(nodes.get('ochkiSum').textContent,/ошибка полного чтения GPU/);assert.equal(calls.some(x=>x==='draw'),false);
  assert.equal(calls[1][0],'publish');assert.equal(calls[1][1],null);
});
test('GPU OFF during read returns to GPU presentation without cancelling the valid field snapshot',async()=>{
  const {c,read,timers,calls}=fixture();c.gpuReadSoon(0);timers.shift()();c.st.ochki=false;read.resolve(new Int8Array(8).fill(1));await turn();assert.deepEqual(calls,['read','picture','post']);
});
test('GPU calculation keeps its identity while CPU geometry covers every romb and restores GPU canvas on OFF',()=>{
  for(const rp of [-1,0,1,2,3]){
    const owner={},c={st:{ochki:true},gpuBig:owner,RG:0,RK:1,VW:20,VH:8,img:null,cv:{width:4,height:4},wrap:{clientWidth:640},wrapPadX:()=>0,rombP:()=>rp,
      g:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})}};
    c.dispW=()=>rp===2?2*c.VW+c.RG:c.VW;c.dispH=()=>rp===3?2*c.VH:c.VH;
    vm.createContext(c);vm.runInContext(html.match(/  const gpuCpuOchki =[^\n]+/)[0]+html.match(/  const gpuDisplay =[^\n]+/)[0]+fn('canvasSize'),c);
    c.canvasSize();assert.equal(c.gpuBig,owner);assert.equal(c.gpuBig.cpuRaster,true);assert.equal(c.img.width,c.dispW()*c.RK);assert.equal(c.img.height,c.dispH()*c.RK);if(rp===2)assert.ok(c.RG>=2);
    c.st.ochki=false;c.canvasSize();assert.equal(c.gpuBig,owner);assert.equal(c.img,null);assert.equal(c.RK,1);assert.equal(c.RG,0);assert.equal(c.gpuBig.cpuRaster,false);assert.equal(c.cv.width,1);
  }
});
test('CPU presentation is selected consistently and async GPU post cannot overwrite it',async()=>{
  for(const name of ['present','cellSource','gifViewFrame','ovlCapture'])assert.match(fn(name),/gpuDisplay\(\)/,name);
  const read=deferred();let calls=0,c={gpuBig:{fresh:true,fld:{readPic:()=>read.promise}},gpuCpuOchki:()=>false,k:1,playing:false,VW:2,VH:2};
  c.gpuPostDone=()=>calls++;vm.createContext(c);vm.runInContext('async '+fn('gpuPost'),c);const p=c.gpuPost();c.gpuCpuOchki=()=>true;read.resolve(new Uint32Array(4));await p;assert.equal(c.img,undefined);assert.equal(calls,0);
  assert.match(fn('draw'),/stopFrameTransports\(\)/);assert.match(fn('draw'),/if\(!same\).*gpuReadSoon\(0\)/);
  assert.match(fn('ochkiSaveExactFrame'),/record&&gpuBig[\s\S]*status:'error'[\s\S]*return/);
});
test('joined GPU-field CPU image masks projected cells instead of interpreting display rows as raw field rows',()=>{
  const c={img:{width:3,height:4},f:{W:3,H:2},VX:0,parityActive:()=>true,rgba:()=>99,EMPTY:[],joinedOn:()=>true,gpuDisplay:()=>false,
    cellMapper:()=>((x,y)=>y<2?y*3+x:(3-y)*3+2-x),parityVisible:(r,col)=>r===0&&col===1};
  vm.createContext(c);vm.runInContext(fn('parityMask'),c);const px=new Uint32Array(12).fill(7);c.parityMask(px);
  assert.deepEqual([...px],[99,7,99,99,99,99,99,99,99,99,7,99]);
});
test('CPU image allocation failure is explicit and never leaves a previous raster marked ready',()=>{
  const nodes=new Map(),c={st:{ochki:true},gpuBig:{cpuRaster:true},RG:0,RK:1,VW:20,VH:8,img:{old:true},cv:{},wrap:{clientWidth:640},wrapPadX:()=>0,rombP:()=>-1,
    g:{createImageData(){throw new RangeError('allocation');}},dispW:()=>20,dispH:()=>8,gpuDisplay:()=>false,gpuCpuOchki:()=>true,ochkiKey:()=> 'frame',publishOchki:(r,reason)=>{c.published={r,reason};},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
  vm.createContext(c);vm.runInContext(fn('canvasSize'),c);c.canvasSize();assert.equal(c.img,null);assert.equal(c.gpuBig.cpuRaster,false);assert.equal(c.published.r,null);assert.match(c.published.reason,/Ошибка памяти полного изображения/);assert.equal(nodes.get('ochkiBox').hidden,false);
});
