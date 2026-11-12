/* МАЯ-657: exact straight-line search in the live packed WebGPU planes.
 * Only coordinates/counts leave the GPU. One bounded top-k list per line
 * prevents output overflow even when every cell matches. CPU merges lists
 * with the same first-present-line and variant ordering as large-search.js.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikGPUSearch=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MODES={row:[0],col:[2],diag:[1],antidiag:[-1],all:[1,-1,0,2]};
  const SOURCE=`
struct Params { W:i32,H:i32,stride:i32,lines:i32,x0:i32,y0:i32,x1:i32,y1:i32,invert:i32,length:i32,need:i32,bands:i32,visible:i32,a:i32,b:i32,c:i32 }
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read> bits:array<u32>;
@group(0) @binding(2) var<storage,read> present:array<u32>;
@group(0) @binding(3) var<storage,read> lines:array<i32>;
@group(0) @binding(4) var<storage,read> word:array<i32>;
@group(0) @binding(5) var<storage,read_write> clip:array<i32>;
@group(0) @binding(6) var<storage,read_write> out:array<atomic<u32>>;
fn value(r:i32,c:i32)->i32 {
  if(r<p.y0||r>=p.y1||c<p.x0||c>=p.x1){return -1;}
  if(c<clip[2*p.H+2*r]||c>clip[2*p.H+2*r+1]){return -1;}
  let q=r*p.stride+(c>>5);let mask=1u<<u32(c&31);
  if((present[q]&mask)==0u){return -1;}
  return i32((bits[q]>>u32(c&31))&1u)^p.invert;
}
@compute @workgroup_size(64)
fn bands(@builtin(global_invocation_id) id:vec3<u32>){
  let r=i32(id.x);if(r>=p.H){return;}
  var lo = -1;var hi=p.W-1;
  if(r<p.visible){
    for(var j=0;j<(p.W+31)/32;j++){
      var z=present[r*p.stride+j]&~bits[r*p.stride+j];
      if(j==(p.W-1)/32&&(p.W&31)!=0){z=z&((1u<<u32(p.W&31))-1u);}
      if(z!=0u){if(lo<0){lo=j*32+i32(firstTrailingBit(z));}hi=j*32+i32(firstLeadingBit(z));}
    }
  }
  clip[2*r]=lo;clip[2*r+1]=hi;
  if(lo>=0){atomicMin(&out[0],u32(r));}
}
@compute @workgroup_size(64)
fn fillBands(@builtin(global_invocation_id) id:vec3<u32>){
  let r=i32(id.x);if(r>=p.H){return;}
  let first=i32(atomicLoad(&out[0]));if(first>=p.H){return;}
  var lo = -1;var hi=p.W-1;
  if(r<p.visible){
    var sourceRow=max(first,r);
    loop{if(clip[2*sourceRow]>=0||sourceRow<=first){break;}sourceRow--;}
    lo=clip[2*sourceRow];hi=clip[2*sourceRow+1];
  }
  clip[2*p.H+2*r]=lo;clip[2*p.H+2*r+1]=hi;
}
@compute @workgroup_size(64)
fn search(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_id) local:vec3<u32>){
  let li=i32(group.x);let lane=i32(local.x);let base=li*(p.need+2);
  for(var k=lane;k<p.need+2;k+=64){atomicStore(&out[base+k],select(0xffffffffu,0u,k==1));}
  storageBarrier();
  let r0=lines[li*5];let c0=lines[li*5+1];let dr=lines[li*5+2];let dc=lines[li*5+3];let n=lines[li*5+4];
  var firstAt=0xffffffffu;var matches=0u;var end=n;
  if(r0>p.a){end=0;}else if(dr>0){end=min(n,(p.a-r0)/dr+1);}
  for(var at=lane;at<end;at+=64){
    let r=r0+at*dr;let c=c0+at*dc;let first=value(r,c);
    if(first<0){continue;}
    firstAt=min(firstAt,u32(at));
    if(at+p.length>n){continue;}
    if(word[0]>=0&&word[0]!=first){continue;}
    var matched=true;
    for(var j=1;j<p.length;j++){
      let v=value(r+j*dr,c+j*dc);
      if(v<0||(word[j]>=0&&word[j]!=v)){matched=false;break;}
    }
    if(!matched){continue;}
    matches++;
    // Later hits in this lane cannot enter the global first need positions.
    if(matches>u32(p.need)){continue;}
    var position=u32(at);
    for(var k=0;k<p.need;k++){
      let previous=atomicMin(&out[base+2+k],position);
      if(previous==0xffffffffu){break;}
      position=max(position,previous);
    }
    if((p.b&4)==0&&matches>=u32(p.need)){break;}
  }
  atomicMin(&out[base],firstAt);if((p.b&4)!=0){atomicAdd(&out[base+1],matches);}
}`;
  // МАЯ-660: literal words share one trie traversal per start. Each line
  // keeps bounded top-k; a second pass reduces line summaries on the GPU.
  const MULTI_SOURCE=SOURCE+`
@group(0) @binding(7) var<storage,read_write> reduced:array<u32>;
var<workgroup> localHits:array<atomic<u32>,4096>;
@compute @workgroup_size(64)
fn searchMany(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_id) local:vec3<u32>){
  let li=i32(group.x);let lane=i32(local.x);let slots=word[2];
  for(var k=lane;k<slots;k+=64){atomicStore(&localHits[k],0xffffffffu);}
  workgroupBarrier();
  for(var k=lane;k<word[1];k+=64){atomicStore(&localHits[word[4+k*4]],0u);}
  workgroupBarrier();
  let r0=lines[li*5];let c0=lines[li*5+1];let dr=lines[li*5+2];let dc=lines[li*5+3];let n=lines[li*5+4];
  var firstAt=0xffffffffu;var end=n;
  if(r0>p.a){end=0;}else if(dr>0){end=min(n,(p.a-r0)/dr+1);}
  for(var at=lane;at<end;at+=64){
    let r=r0+at*dr;let c=c0+at*dc;
    if(value(r,c)<0){continue;}firstAt=min(firstAt,u32(at));
    var node=0;
    for(var j=0;at+j<n;j++){
      let v=value(r+j*dr,c+j*dc);if(v<0){break;}
      node=word[word[0]+node*4+v];if(node<0){break;}
      if(r>word[word[0]+node*4+3]){break;}
      let record=word[word[0]+node*4+2];if(record<0||r>word[7+record*4]){continue;}
      let base=word[4+record*4];let need=word[5+record*4];
      if((p.b&4)!=0){atomicAdd(&localHits[base],1u);}
      // Starts in a lane increase; no late position can replace an earlier
      // retained one. This also avoids atomics for dense repetitive matches.
      if(u32(at)>=atomicLoad(&localHits[base+need])){continue;}
      var position=u32(at);
      for(var k=1;k<=need;k++){
        let previous=atomicMin(&localHits[base+k],position);
        if(previous==0xffffffffu){break;}position=max(position,previous);
      }
    }
  }
  atomicMin(&localHits[0],firstAt);workgroupBarrier();
  for(var k=lane;k<slots;k+=64){atomicStore(&out[li*slots+k],atomicLoad(&localHits[k]));}
}
fn earlier(li:u32,at:u32,first:u32,other:u32,oa:u32,otherFirst:u32)->bool{
  if(other==0xffffffffu){return true;}
  let row=lines[li*5]+i32(at)*lines[li*5+2];let otherRow=lines[other*5]+i32(oa)*lines[other*5+2];
  if(row!=otherRow){return row<otherRow;}
  let cell=u32(lines[li*5]+i32(first)*lines[li*5+2])*u32(p.W)+u32(lines[li*5+1]+i32(first)*lines[li*5+3]);
  let otherCell=u32(lines[other*5]+i32(otherFirst)*lines[other*5+2])*u32(p.W)+u32(lines[other*5+1]+i32(otherFirst)*lines[other*5+3]);
  if(cell!=otherCell){return cell<otherCell;}
  let parity=select(0,(lines[li*5+1]-p.c-lines[li*5])&1,(p.b&3)==2);
  let otherParity=select(0,(lines[other*5+1]-p.c-lines[other*5])&1,(p.b&3)==2);
  if(parity!=otherParity){return parity<otherParity;}
  if(li!=other){return li<other;}return at<oa;
}
@compute @workgroup_size(64)
fn reduceMany(@builtin(global_invocation_id) id:vec3<u32>){
  let record=i32(id.x);if(record>=word[1]){return;}
  let lineOffset=word[4+record*4];let need=word[5+record*4];let resultBase=word[6+record*4];let slots=word[2];
  for(var k=0;k<1+need*3;k++){reduced[resultBase+k]=0xffffffffu;}
  var count=0u;
  for(var li=0;li<p.lines;li++){
    let base=li*slots;count+=atomicLoad(&out[base+lineOffset]);
    let first=atomicLoad(&out[base]);
    for(var k=0;k<need;k++){
      var at=atomicLoad(&out[base+lineOffset+1+k]);if(at==0xffffffffu){break;}
      var index=u32(li);var firstAt=first;
      for(var slot=0;slot<need;slot++){
        let dest=resultBase+1+slot*3;let prior=reduced[dest];let pa=reduced[dest+1];let pf=reduced[dest+2];
        if(earlier(index,at,firstAt,prior,pa,pf)){
          reduced[dest]=index;reduced[dest+1]=at;reduced[dest+2]=firstAt;
          if(prior==0xffffffffu){break;}index=prior;at=pa;firstAt=pf;
        }
      }
    }
  }
  reduced[resultBase]=count;
}`;
  function trieGroups(records){
    const groups=[];let group=null;
    for(const record of records.values()){
      if(record.word.includes(' ')||record.need+2>4096||record.word.length>4096){groups.push({records:[record],single:true});continue;}
      if(!group||group.slots+record.need+1>4096||group.characters+record.word.length>262144){
        group={records:[],slots:1,characters:0};groups.push(group);
      }
      group.records.push(record);group.slots+=record.need+1;group.characters+=record.word.length;
    }
    for(const group of groups){
      if(group.records.length===1){group.single=true;continue;}
      const nodes=[[-1,-1,-1,-1]],meta=[];let lineOffset=1,resultOffset=0;
      for(let index=0;index<group.records.length;index++){
        const record=group.records[index];let node=0;
        for(const bit of record.word){const child=bit==='1'?1:0;if(nodes[node][child]<0){nodes[node][child]=nodes.length;nodes.push([-1,-1,-1,-1]);}node=nodes[node][child];}
        nodes[node][2]=index;meta.push(lineOffset,record.need,resultOffset,record.word.length);
        record.resultOffset=resultOffset;lineOffset+=record.need+1;resultOffset+=1+record.need*3;
      }
      group.resultSlots=resultOffset;
      group.encoded=new Int32Array(4+meta.length+nodes.length*4);
      group.encoded.set([4+meta.length,group.records.length,lineOffset,resultOffset]);group.encoded.set(meta,4);
      for(let j=0;j<nodes.length;j++)group.encoded.set(nodes[j],4+meta.length+j*4);
    }
    return groups;
  }
  function cutoff(record,H,countOccurrences){return countOccurrences||record.hits.length<record.need?H:record.hits[0].row;}
  function updateTrie(group,H,countOccurrences){
    const data=group.encoded,base=data[0];
    for(let index=0;index<group.records.length;index++)data[7+index*4]=cutoff(group.records[index],H,countOccurrences);
    for(let node=(data.length-base)/4-1;node>=0;node--){
      const at=base+node*4,left=data[at],right=data[at+1],record=data[at+2];let max=-1;
      if(record>=0)max=data[7+record*4];
      if(left>=0)max=Math.max(max,data[base+left*4+3]);if(right>=0)max=Math.max(max,data[base+right*4+3]);
      data[at+3]=max;
    }
    return data[base+3];
  }
  const pipelines=new WeakMap();
  function supports(options={}){
    return !!MODES[options.mode||'diag']&&!options.through&&!options.skipSpaces&&!options.overlayGrid&&
      !['ones','zeros','alternating'].includes(options.pattern)&&[-1,0,1,2].includes(options.parity??-1)&&
      [1,2].includes(options.latticeStride??2);
  }
  function plan(W,H,options){
    if(!Number.isSafeInteger(W)||W<1||!Number.isSafeInteger(H)||H<1||W*H>0xffffffff)throw RangeError('Размер поля вне точного диапазона GPU-поиска.');
    const dirs=MODES[options.mode||'diag'],stride=options.latticeStride??2,parity=options.parity??-1;
    const anchor=Number.isFinite(options.anchor)?Math.trunc(options.anchor):0;
    const parities=stride===1?[0]:parity===0?[0]:parity===1?[1]:[0,1],lines=[];
    function add(p,dir,r,c,dr,dc,n){lines.push({p,dir,r,c,dr,dc,n,order:lines.length});}
    for(const p of parities)for(const dir of dirs){
      if(dir===0)for(let r=0;r<H;r++){const c=stride===1?0:(-anchor-r-p)&1;add(p,dir,r,c,0,stride,Math.max(0,Math.ceil((W-c)/stride)));}
      else if(dir===2)for(let c=0;c<W;c++){const r=stride===1?0:(c-anchor-p)&1;add(p,dir,r,c,stride,0,Math.max(0,Math.ceil((H-r)/stride)));}
      else if(dir===1)for(let k=1-H;k<W;k++){
        if(stride===2&&((k-anchor)&1)!==p)continue;
        const r=Math.max(0,-k),c=r+k;add(p,dir,r,c,1,1,Math.min(H-r,W-c));
      }
      else for(let k=0;k<W+H-1;k++){
        if(stride===2&&((k-anchor)&1)!==p)continue;
        const r=Math.max(0,k-W+1),c=k-r;add(p,dir,r,c,1,-1,Math.min(H-r,c+1));
      }
    }
    const halves=parity===2?2:1,vsets=options.vsets||[],sets=(halves===2?[0,1]:[null]).map(p=>{
      const skip=new Set(p===null?options.skip||[]:options.skipByHalf?.[p]||options.skip||[]),records=new Map();
      for(let i=0;i<vsets.length;i++){
        if(skip.has(i))continue;
        const seen=new Set();
        for(const entry of vsets[i]||[]){
          const word=Array.isArray(entry)?entry[0]:entry?.word;
          if(typeof word!=='string'||!/^[01 ]+$/.test(word))throw RangeError('Вариант поиска должен содержать биты или пробелы-маски.');
          if(seen.has(word))continue;seen.add(word);
          let record=records.get(word);if(record)record.need++;else records.set(word,{word,need:1,hits:[],next:0,count:0});
        }
      }
      if(options.independentWords)for(const record of records.values())record.need=1;
      const selected=p===null?lines:lines.filter(L=>L.p===p);
      return {p,skip,records,lines:selected,maxLength:selected.reduce((n,L)=>Math.max(n,L.n),0)};
    });
    return {W,H,dirs,halves,vsets,sets};
  }
  function compare(a,b){return a.row-b.row||a.firstCell-b.firstCell||a.L.p-b.L.p||a.L.order-b.L.order||a.at-b.at;}
  function retain(record,hit){
    const heap=record.hits;
    if(heap.length<record.need){let i=heap.length;heap.push(hit);while(i){const p=(i-1)>>>1;if(compare(heap[p],hit)>=0)break;heap[i]=heap[p];i=p;}heap[i]=hit;return;}
    if(compare(hit,heap[0])>=0)return;
    let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&compare(heap[child+1],heap[child])>0)child++;if(compare(heap[child],hit)<=0)break;heap[i]=heap[child];i=child;}heap[i]=hit;
  }
  function finish(prepared,options){
    const {W,H,dirs,halves,vsets,sets}=prepared,found=[];
    for(const set of sets){
      for(const record of set.records.values())record.hits.sort(compare);
      for(let i=0;i<vsets.length;i++){
        if(set.skip.has(i))continue;let best=null;
        for(const entry of vsets[i]||[]){
          const tuple=Array.isArray(entry),word=tuple?entry[0]:entry.word,variant=tuple?entry[2]||{}:entry;
          const record=set.records.get(word),hit=record?.hits[record.next];
          if(hit&&(!best||hit.row<best.hit.row))best={record,hit,word,variant,vn:tuple?entry[1]:entry.vn};
        }
        if(!best)continue;
        const {record,hit,word,variant,vn}=best,{L,at}=hit;if(!options.independentWords)record.next++;
        const r=L.r+at*L.dr,c=L.c+at*L.dc,n=word.length,start=r*W+c,step=L.dr*W+L.dc;
        const result={r,c,n,p:L.p,dir:L.dir,start,step};
        if(!options.compact)result.cells=Array.from({length:n},(_,j)=>start+j*step);
        found.push({...result,i,vn:vn||'',text:word,variantFlags:variant.flags,variantIndex:variant.index,variantLabel:variant.label});
      }
    }
    const foundIndices=Array.from(new Set(found.map(hit=>hit.i)));
    return {found,foundIndices,foundByHalf:halves===2?[0,1].map(p=>found.filter(hit=>hit.p===p).map(hit=>hit.i)):null,
      foundEver:foundIndices.length,foundCount:found.length,newCount:found.length,total:vsets.length*halves,halves,
      directions:dirs.length,complete:true,packed:true,width:W,height:H,reason:''};
  }
  async function getPipelines(device){
    let pending=pipelines.get(device);if(pending)return pending;
    pending=(async()=>{
      const module=device.createShaderModule({code:SOURCE});
      const layout=device.createBindGroupLayout({entries:Array.from({length:7},(_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,
        buffer:{type:binding===0?'uniform':binding>=5?'storage':'read-only-storage'}}))});
      const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
      const make=entryPoint=>device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint}});
      const multiModule=device.createShaderModule({code:MULTI_SOURCE});
      const multiLayout=device.createBindGroupLayout({entries:Array.from({length:8},(_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,
        buffer:{type:binding===0?'uniform':binding>=5?'storage':'read-only-storage'}}))});
      const multiPipelineLayout=device.createPipelineLayout({bindGroupLayouts:[multiLayout]});
      const makeMulti=entryPoint=>device.createComputePipelineAsync({layout:multiPipelineLayout,compute:{module:multiModule,entryPoint}});
      const [search,bands,fillBands,many,reduce]=await Promise.all([...['search','bands','fillBands'].map(make),...['searchMany','reduceMany'].map(makeMulti)]);
      return {layout,multiLayout,search,bands,fillBands,many,reduce};
    })();
    pipelines.set(device,pending);try{return await pending;}catch(error){pipelines.delete(device);throw error;}
  }
  async function search({device,bits,present,width:W,height:H,stride},options={},current=()=>true,onProgress=()=>{}){
    if(!supports(options)||W*H>0xffffffff)return null;
    onProgress({phase:'gpu-search'});
    const started=performance.now(),prepared=plan(W,H,options),allocated=[];
    const check=()=>{if(!current())throw new DOMException('Поиск отменён','AbortError');};
    const countOccurrences=options.countOccurrences===true;
    let readbackBytes=0,dispatches=0,occurrenceCount=0;
    const buffer=(size,usage)=>{const b=device.createBuffer({size:Math.max(4,size),usage});allocated.push(b);return b;};
    const S=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST;
    const bounds=options.bounds||{},x0=Math.max(0,Math.floor(bounds.x||0)),y0=Math.max(0,Math.floor(bounds.y||0));
    const x1=Math.min(W,bounds.width==null?W:x0+Math.max(0,Math.floor(bounds.width))),y1=Math.min(H,bounds.height==null?H:y0+Math.max(0,Math.floor(bounds.height)));
    const values=new Int32Array([W,H,stride,0,x0,y0,x1,y1,options.invertBits?1:0,1,1,options.withoutBands?1:0,Math.min(H,Math.max(0,Math.floor(bounds.height??H))),0,0,0]);
    let maxNeed=1,maxWord=1;
    for(const set of prepared.sets)for(const record of set.records.values()){maxNeed=Math.max(maxNeed,record.need);maxWord=Math.max(maxWord,record.word.length);}
    // Exceptional query size uses the established bounded CPU fallback.
    const memoryLimit=Math.min(16*1048576,device.limits.maxStorageBufferBindingSize,device.limits.maxBufferSize);
    if((maxNeed+2)*4>memoryLimit||maxWord*4>memoryLimit)return null;
    let maxSlots=maxNeed+2,maxEncodedBytes=maxWord*4,maxResultSlots=1;
    for(const set of prepared.sets){
      set.groups=trieGroups(set.records);
      for(const group of set.groups)if(!group.single){
        maxSlots=Math.max(maxSlots,group.slots);maxEncodedBytes=Math.max(maxEncodedBytes,group.encoded.byteLength);maxResultSlots=Math.max(maxResultSlots,group.resultSlots);
      }
    }
    if(maxEncodedBytes>memoryLimit||maxResultSlots*4>memoryLimit)return null;
    const batch=Math.max(1,Math.min(2048,Math.floor(memoryLimit/(maxSlots*4))));
    try{
      check();const pipes=await getPipelines(device);check();
      const params=buffer(64,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),lineBuffer=buffer(batch*20,S),wordBuffer=buffer(maxEncodedBytes,S);
      const clips=new Int32Array(H*4),lo=options.rowLo?.length?options.rowLo:null,hi=options.rowHi?.length?options.rowHi:null;
      if(lo&&lo.length<H||hi&&hi.length<H)throw RangeError('Неполные границы строк снимка.');
      for(let r=0;r<H;r++){clips[2*H+2*r]=lo?lo[r]:-1;clips[2*H+2*r+1]=hi?hi[r]:W-1;}
      const clipBuffer=buffer(clips.byteLength,S),outBytes=batch*maxSlots*4;
      const output=buffer(outBytes,S|GPUBufferUsage.COPY_SRC),summary=buffer(maxResultSlots*4,S|GPUBufferUsage.COPY_SRC),staging=buffer(Math.max(outBytes,maxResultSlots*4),GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);
      device.queue.writeBuffer(clipBuffer,0,clips);device.queue.writeBuffer(params,0,values);
      const bind=device.createBindGroup({layout:pipes.layout,entries:[params,bits,present,lineBuffer,wordBuffer,clipBuffer,output].map((b,binding)=>({binding,resource:{buffer:b}}))});
      const multiBind=device.createBindGroup({layout:pipes.multiLayout,entries:[params,bits,present,lineBuffer,wordBuffer,clipBuffer,output,summary].map((b,binding)=>({binding,resource:{buffer:b}}))});
      values[14]=(options.latticeStride??2)|(countOccurrences?4:0);values[15]=Number.isFinite(options.anchor)?Math.trunc(options.anchor):0;
      if(options.withoutBands){
        device.queue.writeBuffer(output,0,new Uint32Array([H]));
        const encoder=device.createCommandEncoder();
        for(const pipeline of [pipes.bands,pipes.fillBands]){const pass=encoder.beginComputePass();pass.setPipeline(pipeline);pass.setBindGroup(0,bind);pass.dispatchWorkgroups(Math.ceil(H/64));pass.end();}
        device.queue.submit([encoder.finish()]);dispatches+=2;
      }
      let total=0,done=0;
      for(const set of prepared.sets)for(const group of set.groups){
        const length=group.records.reduce((n,record)=>Math.max(n,record.word.length),0);
        const work=set.maxLength+Math.max(0,set.maxLength-length+1)*length;
        // Each reduced count is <= batch * maxLength, safely below u32.
        group.batch=Math.max(1,Math.min(batch,Math.floor(1073741824/Math.max(1,work)),Math.floor(0xffffffff/Math.max(1,set.maxLength))));
        total+=Math.ceil(set.lines.length/group.batch);
      }
      for(const set of prepared.sets)for(const group of set.groups){
        check();const record=group.records[0];
        const encoded=group.single?Int32Array.from(record.word,ch=>ch===' '?-1:ch==='1'?1:0):group.encoded;
        device.queue.writeBuffer(wordBuffer,0,encoded);
        for(let start=0;start<set.lines.length;start+=group.batch){
          check();values[13]=group.single?cutoff(record,H,countOccurrences):updateTrie(group,H,countOccurrences);
          if(!group.single)device.queue.writeBuffer(wordBuffer,0,encoded);
          const selected=set.lines.slice(start,start+group.batch).filter(L=>L.r<=values[13]),count=selected.length;
          if(!count){onProgress({phase:'gpu-search',done:++done,total});continue;}
          const descriptors=new Int32Array(count*5);
          for(let j=0;j<count;j++){const L=selected[j];descriptors.set([L.r,L.c,L.dr,L.dc,L.n],j*5);}
          values[3]=count;values[9]=record.word.length;values[10]=record.need;
          device.queue.writeBuffer(params,0,values);device.queue.writeBuffer(lineBuffer,0,descriptors);
          const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
          pass.setPipeline(group.single?pipes.search:pipes.many);pass.setBindGroup(0,group.single?bind:multiBind);pass.dispatchWorkgroups(count);pass.end();dispatches++;
          let bytes;
          if(group.single){bytes=count*(record.need+2)*4;encoder.copyBufferToBuffer(output,0,staging,0,bytes);}
          else{
            const reduction=encoder.beginComputePass();reduction.setPipeline(pipes.reduce);reduction.setBindGroup(0,multiBind);reduction.dispatchWorkgroups(Math.ceil(group.records.length/64));reduction.end();dispatches++;
            bytes=group.resultSlots*4;encoder.copyBufferToBuffer(summary,0,staging,0,bytes);
          }
          device.queue.submit([encoder.finish()]);await staging.mapAsync(GPUMapMode.READ,0,bytes);
          try{
            check();const data=new Uint32Array(staging.getMappedRange(0,bytes));readbackBytes+=bytes;
            if(group.single)for(let j=0;j<count;j++){
              const offset=j*(record.need+2),L=selected[j],first=data[offset];record.count+=data[offset+1];
              if(first===0xffffffff)continue;
              const firstCell=(L.r+first*L.dr)*W+L.c+first*L.dc;
              for(let k=0;k<record.need;k++){const at=data[offset+2+k];if(at===0xffffffff)break;retain(record,{L,at,row:L.r+at*L.dr,firstCell});}
            }
            else for(const item of group.records){
              const offset=item.resultOffset;item.count+=data[offset];
              for(let k=0;k<item.need;k++){
                const j=data[offset+1+k*3];if(j===0xffffffff)break;
                const at=data[offset+2+k*3],first=data[offset+3+k*3],L=selected[j];
                const firstCell=(L.r+first*L.dr)*W+L.c+first*L.dc;
                retain(item,{L,at,row:L.r+at*L.dr,firstCell});
              }
            }
          }finally{staging.unmap();}
          onProgress({phase:'gpu-search',done:++done,total});
        }
        for(const item of group.records)occurrenceCount+=item.count;
      }
      check();const result=finish(prepared,options),searchMs=performance.now()-started;
      return {...result,...(countOccurrences?{occurrenceCount}:{}),gpu:{readbackBytes,searchMs,dispatches,countOccurrences,workingBytes:allocated.reduce((n,b)=>n+b.size,0)}};
    }finally{for(const b of allocated)b.destroy();}
  }
  return {supports,search};
});
