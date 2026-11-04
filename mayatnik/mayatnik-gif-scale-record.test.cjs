const test=require('node:test'),assert=require('node:assert/strict');
const Record=require('./mayatnik-gif-scale-record.js'),Scale=require('./mayatnik-gif-scale.js'),Gif=require('./mayatnik-gif.js');
class ThreadWorker{
 constructor(url){this.queue=[];this.closed=false;this.ready=fetch(url).then(r=>r.text()).then(code=>{if(this.closed)return;const {Worker}=require('node:worker_threads');this.worker=new Worker("const {parentPort}=require('node:worker_threads');globalThis.postMessage=(value,transfer)=>parentPort.postMessage(value,transfer);parentPort.on('message',data=>globalThis.onmessage({data}));\n"+code,{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.(error));for(const args of this.queue)this.worker.postMessage(...args);}).catch(error=>this.onerror?.(error));}
 postMessage(...args){if(this.worker)this.worker.postMessage(...args);else this.queue.push(args);}
 terminate(){this.closed=true;this.worker?.terminate();}
}
function source(width=4,height=16,phase=0){const bits=Int8Array.from({length:width*height},(_,i)=>(i+phase)%3-1),pixels=Uint8ClampedArray.from(Array.from(bits,b=>b===1?[239,57,81,255]:b===0?[21,151,203,255]:[17,23,31,255]).flat());return {width,height,pixels,bits};}
async function sameBlob(actual,expected){assert.deepEqual(Buffer.from(await actual.arrayBuffer()),Buffer.from(await expected.arrayBuffer()));}
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));

test('records presented/manual frame order at one selected level, owns snapshots and uses no capture timer',async()=>{
 globalThis.Worker=ThreadWorker;
 for(const method of ['canvas','nearest','majority','average']){
  const a=source(),b=source(4,16,1),before=a.pixels.slice(),bits=a.bits.slice(),progress=[];
  const job=Record.start({width:4,height:16,rows:8,method,delay:130,onProgress:p=>progress.push(p.frames)});
  assert.equal(job.push(a,{key:10,frame:10}),true);assert.equal(job.push(a,{key:10,frame:10}),false);
  assert.equal(job.push(b,{key:11,frame:11}),true);assert.equal(job.push(a,{key:10,frame:10}),true);
  assert.equal(a.pixels.byteLength,4*16*4);a.pixels.fill(0);a.bits.fill(-2);
  const result=await job.stop();assert.equal(result.presentation,'pixels');assert.equal(result.recording,true);assert.equal(result.delay,130);
  assert.deepEqual(result.frames.map(f=>f.sourceFrame),[10,11,10]);assert.deepEqual(result.frames.map(f=>f.rows),[8,8,8]);assert.deepEqual(progress,[1,2,3]);
  const expected=Gif.encoder(4,16);
  for(const [i,s]of [{width:4,height:16,pixels:before,bits},b,{width:4,height:16,pixels:before,bits}].entries()){
   const small=Scale.reduce(s.pixels,4,16,8,method,s.bits);expected.add(Scale.enlarge(small,4,16),13);
   await sameBlob(result.frames[i].blob,expected.frame());assert.deepEqual(result.frames[i].semantic.bits,small.bits);
   assert.deepEqual(result.frames[i].semantic.bounds,{left:0,top:0,width:4,height:16});
  }
  await sameBlob(result.blob,expected.finish());assert.equal(job.pending,0);assert.equal(job.pendingBytes,0);assert.equal(job.canPush,false);
  assert.equal(await job.stop(),result);
 }
});

test('source size and aspect may change while output canvas and chosen rows remain locked, with whole-frame bars',async()=>{
 globalThis.Worker=ThreadWorker;const initial=source(8,16),wide=source(16,8,1),tall=source(4,24,2),background=[7,19,29];
 const job=Record.start({width:8,height:16,rows:8,method:'nearest',background});for(const s of [initial,wide,tall])job.push(s);
 const result=await job.stop();assert.deepEqual(result.frames.map(f=>f.semantic.bounds),[{left:0,top:0,width:8,height:16},{left:0,top:6,width:8,height:4},{left:2,top:0,width:3,height:16}]);
 assert.deepEqual(result.frames.map(f=>[f.semantic.width,f.semantic.height]),[[4,8],[16,8],[1,8]]);
 const expected=Gif.encoder(8,16);
 for(const [s,bounds]of [[initial,{width:8,height:16}],[wide,{width:8,height:4}],[tall,{width:3,height:16}]]){
  const small=Scale.reduce(s.pixels,s.width,s.height,8,'nearest',s.bits),pixels=Scale.enlarge(small,bounds.width,bounds.height);
  expected.add(Scale.center({...bounds,pixels},8,16,background),20);
 }
 await sameBlob(result.blob,expected.finish());assert.deepEqual(result.plan.levels,[8]);assert.equal(result.plan.width,8);assert.equal(result.plan.height,16);
});

test('no frames appear until a presentation is pushed; stop drains already accepted frames',async()=>{
 globalThis.Worker=ThreadWorker;const progress=[],job=Record.start({width:4,height:16,rows:8,onProgress:p=>progress.push(p.frames)});
 await settle();assert.deepEqual(progress,[]);job.push(source(),{frame:1});job.push(source(4,16,1),{frame:2});
 const promise=job.stop();assert.equal(job.canPush,false);assert.throws(()=>job.push(source()),e=>e.code==='GIF_RECORD_CLOSED');
 assert.equal((await promise).frames.length,2);
 const empty=Record.start({width:4,height:16,rows:8});await assert.rejects(empty.stop(),e=>e.code==='GIF_RECORD_EMPTY');
});

test('bounded in-flight queue reports backpressure instead of dropping frames and releases memory',async()=>{
 class WaitingWorker{postMessage(){}terminate(){this.closed=true;}}globalThis.Worker=WaitingWorker;
 const s=source(),job=Record.start({width:4,height:16,rows:8,maxQueue:2}),rejection=assert.rejects(job.promise,e=>e.code==='GIF_RECORD_BACKPRESSURE');
 assert.equal(job.capacity(s),true);job.push(s);job.push(s);assert.equal(job.pending,2);assert.equal(job.canPush,false);assert.equal(job.capacity(s),false);
 assert.throws(()=>job.push(s),e=>e.code==='GIF_RECORD_BACKPRESSURE');await rejection;assert.equal(job.pendingBytes,0);assert.equal(job.pending,0);
 const capped=Record.start({width:4,height:16,rows:8,maxPendingBytes:319}),failed=assert.rejects(capped.promise,e=>e.code==='GIF_RECORD_BACKPRESSURE');
 assert.equal(capped.capacity(s),false);assert.throws(()=>capped.push(s),e=>e.code==='GIF_RECORD_BACKPRESSURE');await failed;
});

test('cancellation terminates queued work, rejects once and never returns a partial animation',async()=>{
 globalThis.Worker=ThreadWorker;const job=Record.start({width:4,height:16,rows:8});job.push(source());const rejected=assert.rejects(job.promise,{name:'AbortError'});job.cancel();job.cancel();await rejected;assert.equal(job.pending,0);assert.equal(job.canPush,false);assert.equal(job.pendingBytes,0);
});

test('frame-count and encoded-memory limits fail explicitly, including asynchronous worker errors',async()=>{
 globalThis.Worker=ThreadWorker;
 const frameLimited=Record.start({width:4,height:16,rows:8,maxFrames:1}),rejected=assert.rejects(frameLimited.promise,e=>e.code==='GIF_RECORD_LIMIT');frameLimited.push(source());assert.equal(frameLimited.canPush,false);assert.throws(()=>frameLimited.push(source()),e=>e.code==='GIF_RECORD_LIMIT');await rejected;
 const bytesLimited=Record.start({width:4,height:16,rows:8,maxBytes:1});bytesLimited.push(source());await assert.rejects(bytesLimited.stop(),e=>e.code==='GIF_RECORD_LIMIT');assert.equal(bytesLimited.pending,0);
});

test('invalid preset/source and incompatible oversized detail reject before copying or allocating raster work',async()=>{
 globalThis.Worker=ThreadWorker;
 for(const options of [{width:0,height:8,rows:8},{width:4,height:16,rows:17},{width:4,height:16,rows:8,method:'bad'},{width:65535,height:65535,rows:8}])assert.throws(()=>Record.start(options));
 const job=Record.start({width:4,height:16,rows:8}),rejected=assert.rejects(job.promise,e=>e.code==='GIF_RECORD_SOURCE');assert.throws(()=>job.push({...source(),bits:new Int8Array(1)}),e=>e.code==='GIF_RECORD_SOURCE');await rejected;
 const huge=Record.start({width:256,height:65528,rows:65528}),tooBig=assert.rejects(huge.promise,e=>e.code==='GIF_RECORD_SIZE');assert.throws(()=>huge.push(source(256,8)),e=>e.code==='GIF_RECORD_SIZE');await tooBig;
});

test('padding and alpha compositing match selected scale level, retaining semantic unknowns',async()=>{
 globalThis.Worker=ThreadWorker;const s=source(5,9);s.pixels[3]=128;s.bits[1]=-2;const job=Record.start({width:5,height:16,rows:8,method:'canvas',background:[51,71,91]});job.push(s);
 const result=await job.stop(),prepared=Scale.prepare(s,{width:5,height:16},[51,71,91]),bits=new Int8Array(80).fill(-1);bits.set(s.bits);
 const small=Scale.reduce(prepared,5,16,8,'canvas',bits),expected=Gif.encoder(5,16);expected.add(Scale.enlarge(small,5,16),20);
 await sameBlob(result.blob,expected.finish());assert.deepEqual(result.frames[0].semantic.bits,small.bits);
});

test('explicit respeed preserves all repeated logical recorded frames merged into one GIF image',async()=>{
 globalThis.Worker=ThreadWorker;const s=source(),job=Record.start({width:4,height:16,rows:8,delay:170});
 for(let frame=0;frame<3;frame++)job.push(s,{key:frame,frame});
 const result=await job.stop(),updated=await Scale.retime(result.blob,490),small=Scale.reduce(s.pixels,4,16,8,'canvas',s.bits),expected=Gif.encoder(4,16);
 for(let i=0;i<3;i++)expected.add(Scale.enlarge(small,4,16),49);
 assert.equal(result.frames.length,3);await sameBlob(updated,expected.finish());
});

test('typed encoder errors cross the worker boundary unchanged',async()=>{
 class BrokenWorker{postMessage(message){if(message.type==='start')queueMicrotask(()=>this.onmessage?.({data:{error:'More than 256 colours',code:'GIF_PALETTE_OVERFLOW'}}));}terminate(){}}
 globalThis.Worker=BrokenWorker;const job=Record.start({width:4,height:16,rows:8});job.push(source());
 await assert.rejects(job.stop(),e=>e.code==='GIF_PALETTE_OVERFLOW');assert.equal(job.pending,0);
});
