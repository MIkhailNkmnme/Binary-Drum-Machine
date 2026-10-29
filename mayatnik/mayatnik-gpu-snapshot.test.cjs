const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('./mayatnik-gpu-snapshot.js');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
test('full readback commits atomically only after completion',async()=>{
  const job=create(),read=deferred(),field=new Int8Array([0,0,0]),states=[];
  const p=job.start({read:()=>read.promise,current:()=>true,length:3,commit:data=>field.set(data),onState:s=>states.push(s)});
  assert.equal(job.pending,true);assert.deepEqual([...field],[0,0,0]);
  read.resolve(new Int8Array([1,-1,1]));assert.equal((await p).status,'ready');
  assert.deepEqual([...field],[1,-1,1]);assert.deepEqual(states,['reading','ready']);assert.equal(job.pending,false);
});
test('frame, source, view and clear invalidation discard old snapshots without touching live data',async()=>{
  for(const reason of ['frame','source','view','clear']){
    const job=create(),read=deferred(),states=[];let current=true,commits=0;
    const p=job.start({read:()=>read.promise,current:()=>current,length:1,commit:()=>commits++,onState:s=>states.push(s)});
    if(reason==='clear')job.cancel();else current=false;
    read.resolve(new Int8Array([1]));assert.equal((await p).status,'cancelled',reason);assert.equal(commits,0);assert.deepEqual(states,['reading']);
  }
});
test('overlapping requests cannot commit or clear a newer pending request',async()=>{
  const job=create(),a=deferred(),b=deferred(),commits=[];
  const request=(read)=>job.start({read:()=>read.promise,current:()=>true,length:1,commit:data=>commits.push(data[0])});
  const pa=request(a),pb=request(b);a.resolve(new Int8Array([0]));assert.equal((await pa).status,'cancelled');assert.equal(job.pending,true);
  b.resolve(new Int8Array([1]));assert.equal((await pb).status,'ready');assert.deepEqual(commits,[1]);assert.equal(job.pending,false);
});
test('allocation, device and truncated-read failures never become completed or partial results',async()=>{
  for(const data of [new Int8Array(1),new Uint8Array(2),new RangeError('allocation failed'),new Error('device lost')]){
    const job=create(),states=[];let commits=0;
    const r=await job.start({read:async()=>{if(data instanceof Error)throw data;return data;},current:()=>true,length:2,commit:()=>commits++,onState:s=>states.push(s)});
    assert.equal(r.status,'error');assert.equal(commits,0);assert.deepEqual(states,['reading','error']);assert.equal(job.pending,false);
  }
});
test('cancelled failed readback does not overwrite current status',async()=>{
  const job=create(),read=deferred(),states=[];
  const p=job.start({read:()=>read.promise,current:()=>true,length:1,commit:()=>assert.fail(),onState:s=>states.push(s)});
  job.cancel();read.reject(Error('old device'));assert.equal((await p).status,'cancelled');assert.deepEqual(states,['reading']);
});
