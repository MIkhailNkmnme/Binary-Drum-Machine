const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const C=require('./mayatnik-snake-catalog.js'),Scan=require('./mayatnik-snake-scan.js'),Log=require('./mayatnik-ochki-log.js');
const lattice=(w,h,bits)=>Array.from({length:w*h},(_,q)=>({x:q%w,y:Math.floor(q/w),row:Math.floor(q/w),col:q%w,bit:bits[q],edges:Math.floor(q/w)+1<h?[...(q%w?[q+w-1]:[]),...(q%w+1<w?[q+w+1]:[])]:[]}));
function oracle(nodes,word){const paths=[];function visit(q,at,cells){if(nodes[q].bit!==+word[at])return;const path=[...cells,q];if(at+1===word.length)paths.push(path);else for(const next of nodes[q].edges)visit(next,at+1,path);}for(let q=0;q<nodes.length;q++)visit(q,0,[]);return paths;}
test('exhaustive 512 tiny fields, all binary words through length three: counts, ranks, union overlaps',()=>{
 for(let bits=0;bits<512;bits++){const nodes=lattice(3,3,Array.from({length:9},(_,q)=>(bits>>>q)&1));for(let len=1;len<=3;len++)for(let value=0;value<2**len;value++){
  const word=value.toString(2).padStart(len,'0'),expected=oracle(nodes,word),before=JSON.stringify(nodes),c=C.compile({nodes,sequence:[word]});assert.equal(c.rows[0].count,String(expected.length));assert.equal(JSON.stringify(nodes),before);
  const page=C.page(c,{row:0,limit:100});assert.deepEqual(page.items.map(p=>p.cells),expected);const counts=new Map();for(const path of expected)for(const q of path)counts.set(q,(counts.get(q)||0)+1);assert.deepEqual(C.union(c,{row:0}).cells,[...counts].sort((a,b)=>a[0]-b[0]).map(([node,count])=>({node,count:String(count)})));
 }}
});
test('reconvergent 60 bits retain exactly 2^59 routes without enumeration and unrank last route',()=>{
 const nodes=[{x:0,y:0,bit:1,edges:[1,2]}];for(let y=1;y<60;y++)for(let p=0;p<2;p++)nodes.push({x:p?1:-1,y,bit:1,edges:y<59?[2*y+1,2*y+2]:[]});
 // Give adjacent layers alternate x coordinates so every edge has a diagonal direction.
 for(let q=1;q<nodes.length;q++)nodes[q].x=(nodes[q].y%2?1:2)*(q%2?-1:1);
 const c=C.compile({nodes,sequence:['1'.repeat(60)]}),count=2n**59n;assert.equal(c.rows[0].count,String(count));assert.equal(c.words[0].starts.length,1);assert.ok(JSON.stringify(c).length<20000);const last=C.page(c,{row:0,offset:String(count-1n)});assert.equal(last.items.length,1);assert.equal(last.items[0].cells.length,60);assert.equal(last.next,null);
});
test('variant dedup is per row, repeated sequence rows each retain all routes, empty is distinct from 0',()=>{
 const nodes=lattice(2,2,[0,-1,1,1]),c=C.compile({nodes,sequence:['01','01'],variants:[[['01',''],['01','duplicate'],['10','rev']],[{word:'01',label:'base'}]]});assert.equal(c.words.length,2);assert.equal(c.rows[0].count,'1');assert.equal(c.rows[1].count,'1');assert.equal(C.page(c,{row:0}).items[0].end.row,1);
});
test('251 structured half/inverse/reverse provenance survives catalog storage and rank reconstruction',()=>{
 const variants=[[{word:'01',vn:'полу:право',label:'полуинверсия',index:4,flags:{half:true,halfMode:'right',inverse:false,reverse:false}}]],c=C.compile({nodes:lattice(2,2,[0,-1,-1,1]),sequence:['00'],variants}),path=C.page(JSON.parse(JSON.stringify(c)),{row:0}).items[0];assert.equal(path.vn,'полу:право');assert.equal(path.variantIndex,4);assert.equal(path.variantLabel,'полуинверсия');assert.deepEqual(path.variantFlags,variants[0][0].flags);
});
test('fragments preserve unknown source addresses; disconnected components cannot jump',()=>{
 const nodes=[{x:.25,y:.25,bit:1,edges:[],fragment:'a'},{x:1.25,y:1.25,bit:1,edges:[]}],c=C.compile({nodes,sequence:['1','11']});assert.equal(c.rows[1].count,'0');assert.equal(C.page(c,{row:0}).items[0].start.row,null);
});
test('limits and cancellation never return complete catalogs',()=>{const nodes=lattice(3,3,Array(9).fill(1));assert.throws(()=>C.compile({nodes,sequence:['111'],maxOperations:1}),/полнота/);assert.throws(()=>C.compile({nodes,sequence:['111'],cancelled:()=>true}),/отменён/);});
test('actual serialized worker source works independently and returns decimal IO',async()=>{
 const messages=[],pending=[];const scope={structuredClone,postMessage:m=>messages.push(m),setTimeout:fn=>pending.push(fn)};vm.runInNewContext(C.workerSource(),scope);scope.onmessage({data:{id:'test',options:{nodes:lattice(3,3,Array(9).fill(1)),sequence:['111'],chunkOperations:2}}});while(pending.length)pending.shift()();assert.equal(messages.at(-1).result.rows[0].count,'6');assert.ok(messages.some(m=>m.progress));JSON.stringify(messages);
});
test('actual worker thread compiles and reconstructs catalog pages from the Blob source',async()=>{
 const {Worker}=require('node:worker_threads'),worker=new Worker('const {parentPort}=require("node:worker_threads");global.postMessage=x=>parentPort.postMessage(x);'+C.workerSource()+';parentPort.on("message",data=>onmessage({data}));',{eval:true});
 const request=data=>new Promise((resolve,reject)=>{const message=m=>{if(m.id!==data.id||m.progress)return;worker.off('message',message);m.error?reject(Error(m.error)):resolve(m.result);};worker.on('message',message);worker.once('error',reject);worker.postMessage(data);});
 try{const c=await request({id:1,options:{nodes:lattice(3,3,Array(9).fill(1)),sequence:['111'],chunkOperations:3}});assert.equal(c.rows[0].count,'6');const page=await request({id:2,method:'page',catalog:c,options:{row:0,offset:'5',limit:1}});assert.equal(page.items[0].rank,'5');assert.equal(page.items[0].cells.length,3);}finally{await worker.terminate();}
});
function fixture(){const data=new Map();let fail=false;const storage={read:async key=>structuredClone(data.get(key)),write:async(value,key)=>{if(fail)throw Error('quota');data.set(key,structuredClone(value));}};let opened;const log=Log.create({storage:async()=>storage,library:()=>{throw Error('Library must not be used');},openScan:async(entry,stored)=>{opened={entry,stored};}});return {data,storage,log,get opened(){return opened;},fail:v=>fail=v};}
test('journal stores exact blobs/catalogs outside Frame Library and supports opening and reload',async()=>{
 const f=fixture(),catalog=C.compile({nodes:lattice(2,2,[1,1,1,1]),sequence:['11'],frame:0}),job={id:'job',total:1,sequence:['11'],settings:{}};await f.log.commitScanFrame(job,catalog,{blob:new Blob(['exact']),rows:2});await f.log.open(f.log.list()[0].id);assert.equal(await f.opened.stored.snapshot.blob.text(),'exact');assert.equal(f.log.list()[0].count,'2');assert.equal((await f.log.readScanFrame('job',0)).catalog.rows[0].count,'2');
});
test('finite sequential coverage, immutable config, pause/resume, earliest proof and zero frames',async()=>{
 const f=fixture(),visits=[],input={total:3,sequence:['11'],settings:{mode:'frozen'}},host={worker:false,captureRun:async()=>input,acquire:async(frame,job)=>{visits.push(frame);assert.equal(job.settings.mode,'frozen');return {nodes:lattice(2,2,Array(4).fill(frame===2?1:0)),frameSnapshot:{blob:new Blob([String(frame)])},current:()=>true};}};
 const scan=Scan.create(host,f.log);scan.subscribe(({job})=>{if(job?.next===1&&job.status==='running')scan.pause();});const first=await scan.start();input.total=50;input.settings.mode='changed';assert.equal(first.status,'paused');assert.equal(first.next,1);assert.deepEqual(await scan.earliest(first.id,0),{proven:false,frame:null,reason:'Есть непроверенные кадры'});
 const resumed=Scan.create(host,f.log),done=await resumed.resume(first.id);assert.equal(done.status,'complete');assert.equal(done.next,3);assert.deepEqual(visits,[0,1,2]);assert.deepEqual(await resumed.earliest(first.id,0),{proven:true,frame:2,count:'2'});
});
test('stale snapshot and quota never advance coverage or assert exhaustion',async()=>{
 for(const mode of ['stale','quota']){const f=fixture(),scan=Scan.create({worker:false,captureRun:async()=>({total:1,sequence:['1']}),acquire:async()=>{if(mode==='quota')f.fail(true);return {nodes:lattice(1,1,[1]),frameSnapshot:{blob:new Blob(['x'])},current:()=>mode!=='stale'};}},f.log);const state=await scan.start();assert.equal(state.status,'error');assert.equal(state.next,0);assert.equal(state.complete,false);}
});
test('resume detects missing coverage and retries the first missing frame',async()=>{
 const f=fixture();await f.log.putScanJob({version:1,id:'crash',total:2,next:2,sequence:['1'],settings:{},status:'running'});const visits=[],scan=Scan.create({worker:false,acquire:async frame=>{visits.push(frame);return {nodes:lattice(1,1,[0]),frameSnapshot:{blob:new Blob(['x'])}};}},f.log);const done=await scan.resume('crash');assert.deepEqual(visits,[0,1]);assert.equal(done.complete,true);assert.deepEqual(await scan.earliest('crash',0),{proven:true,frame:null,count:'0'});
});
test('pause during immutable capture prevents creating an iframe and double start is refused',async()=>{
 const f=fixture();let release,begun=0;const scan=Scan.create({captureRun:()=>new Promise(r=>release=r),begin:()=>begun++},f.log),pending=scan.start();await assert.rejects(scan.start(),/уже/);scan.pause();release({total:1,sequence:['1']});const job=await pending;assert.equal(job.status,'paused');assert.equal(job.next,0);assert.equal(begun,0);
});
test('journal saves realtime witnesses as a standalone exact frame, without an all-route claim',async()=>{
 const f=fixture();await f.log.commitSnakeFrame({id:'realtime',complete:true,frame:7,finds:[{i:0,cells:[1,2],start:{row:0,bit:1},end:{row:1,bit:0}}]},{blob:new Blob(['witness'])});await f.log.open('realtime');assert.equal(await f.opened.stored.snapshot.blob.text(),'witness');assert.equal(f.opened.stored.catalog,undefined);assert.deepEqual(f.opened.stored.finds[0].cells,[1,2]);
});
