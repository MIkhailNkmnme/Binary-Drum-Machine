/* МАЯ-653: exact search directly in the two packed WebGPU planes.
 * Main thread: MayatnikLargeSearch.search(snapshot, options).
 * Worker: postMessage({id, snapshot, options}, [bits.buffer, present.buffer]);
 * messages: {id, progress:{phase,done,total}}, {id,result}, {id,error}.
 * Terminate the worker to cancel. A snapshot belongs to one immutable frame.
 * stride is Uint32 words per row, including the GPU padding word.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikLargeSearch=api;
  if(typeof WorkerGlobalScope!=='undefined'&&root instanceof WorkerGlobalScope){
    root.onmessage=function(event){
      const {id,snapshot,options}=event.data||{};
      try{root.postMessage({id,result:api.search(snapshot,options,progress=>root.postMessage({id,progress}))});}
      catch(error){root.postMessage({id,error:String(error?.message||error)});}
    };
  }
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const MODES={row:[0],col:[2],diag:[1],antidiag:[-1],all:[1,-1,0,2]};
  const ANCHOR_BITS=16,MASK=65535;

  function context(snapshot,options){
    const {width:W,height:H,stride,bits,present}=snapshot||{};
    if(!Number.isSafeInteger(W)||W<1||!Number.isSafeInteger(H)||H<1||!Number.isSafeInteger(W*H)||
       !Number.isSafeInteger(stride)||stride<Math.ceil(W/32)||
       !(bits instanceof Uint32Array)||!(present instanceof Uint32Array)||bits.length<stride*H||present.length<stride*H)
      throw new RangeError('Неполный упакованный снимок поля.');
    const loop=!!options.through||options.mode==='loop';
    const vRoute=!loop&&options.mode==='v';
    if(!loop&&!vRoute&&!MODES[options.mode||'diag'])throw new RangeError('Неизвестное направление большого поиска.');
    const anchor=Number.isFinite(options.anchor)?Math.trunc(options.anchor):0;
    const parity=options.parity??-1;
    if(![-1,0,1,2].includes(parity))throw new RangeError('Неизвестный режим половин поля.');
    // Optional clipping avoids copying or editing the immutable presence plane.
    const bounds=options.bounds||{},x0=Math.max(0,Math.floor(bounds.x||0)),y0=Math.max(0,Math.floor(bounds.y||0));
    const x1=Math.min(W,bounds.width==null?W:x0+Math.max(0,Math.floor(bounds.width)));
    const y1=Math.min(H,bounds.height==null?H:y0+Math.max(0,Math.floor(bounds.height)));
    const lo=options.rowLo,hi=options.rowHi,invert=options.invertBits?1:0;
    if(lo&&lo.length<H||hi&&hi.length<H)throw new RangeError('Неполные границы строк снимка.');
    function value(r,c){
      if(r<y0||r>=y1||c<x0||c>=x1||lo&&c<lo[r]||hi&&c>hi[r])return -1;
      const q=r*stride+Math.floor(c/32),shift=c&31;
      return ((present[q]>>>shift)&1)?((bits[q]>>>shift)&1)^invert:-1;
    }
    return {W,H,anchor,parity,value,loop,vRoute,skipSpaces:!!options.skipSpaces,
      dirs:loop?(options.through?[0,2,1,-1]:[0]):vRoute?['v']:options.skipSpaces&&options.mode==='all'?[0,2,1,-1]:MODES[options.mode||'diag']};
  }

  // A descriptor represents an entire geometric line, including its holes.
  // ochkiLines sorts these by FIRST PRESENT cell before splitting into runs.
  // Keeping that order is essential for equal-row ties after a hole.
  function descriptors(ctx,progress){
    const {W,H,anchor,parity,value,dirs}=ctx,out=[];
    let order=0;
    const parities=parity===0?[0]:parity===1?[1]:[0,1];
    function add(p,dir,r,c,dr,dc,n){
      const serial=order++;
      let first=0;
      while(first<n&&value(r+first*dr,c+first*dc)<0)first++;
      if(first===n)return;
      out.push({p,dir,r,c,dr,dc,n,first,cell:(r+first*dr)*W+c+first*dc,order:serial});
    }
    for(const p of parities)for(const dir of dirs){
      if(dir===0){
        for(let r=0;r<H;r++){
          const c=(-anchor-r-p)&1;
          add(p,dir,r,c,0,2,Math.max(0,Math.ceil((W-c)/2)));
          if((r&255)===0)progress('lines',r,H);
        }
      }else if(dir===2){
        for(let c=0;c<W;c++){
          const r=(c-anchor-p)&1;
          add(p,dir,r,c,2,0,Math.max(0,Math.ceil((H-r)/2)));
          if((c&255)===0)progress('lines',c,W);
        }
      }else if(dir===1){
        for(let k=1-H;k<W;k++){
          if(((k-anchor)&1)!==p)continue;
          const r=Math.max(0,-k),c=r+k;
          add(p,dir,r,c,1,1,Math.min(H-r,W-c));
          if((k&255)===0)progress('lines',k+H-1,W+H-1);
        }
      }else{
        for(let k=0;k<W+H-1;k++){
          if(((k-anchor)&1)!==p)continue;
          const r=Math.max(0,k-W+1),c=k-r;
          add(p,dir,r,c,1,-1,Math.min(H-r,c+1));
          if((k&255)===0)progress('lines',k,W+H-1);
        }
      }
    }
    out.sort((a,b)=>a.cell-b.cell||a.p-b.p||a.order-b.order);
    return out;
  }

  // Bounded maximum heap: memory depends on requested sequence rows, never
  // on the number of occurrences in a highly repetitive field.
  function compare(a,b){return a.row-b.row||a.li-b.li||a.at-b.at;}
  function keep(record,hit){
    const heap=record.heap;
    if(heap.length<record.need){
      let i=heap.length;heap.push(hit);
      while(i){const p=(i-1)>>>1;if(compare(heap[p],hit)>=0)break;heap[i]=heap[p];i=p;}
      heap[i]=hit;return;
    }
    if(compare(hit,heap[0])>=0)return;
    let i=0;
    while(i*2+1<heap.length){
      let child=i*2+1;
      if(child+1<heap.length&&compare(heap[child+1],heap[child])>0)child++;
      if(compare(heap[child],hit)<=0)break;
      heap[i]=heap[child];i=child;
    }
    heap[i]=hit;
  }

  function variants(vsets,skip){
    const records=new Map();
    for(let i=0;i<vsets.length;i++){
      if(skip.has(i))continue;
      const seen=new Set();
      for(const variant of vsets[i]||[]){
        const word=Array.isArray(variant)?variant[0]:variant?.word;
        if(typeof word!=='string'||!/^[01 ]+$/.test(word))throw new RangeError('Вариант поиска должен содержать биты или пробелы-маски.');
        if(seen.has(word))continue;seen.add(word);
        const old=records.get(word);
        if(old)old.need++;
        else records.set(word,{word,need:1,heap:[],next:0,offset:0,length:0,hash:0});
      }
    }
    return records;
  }

  // Empty-cell compression uses just one reusable geometric-line buffer.
  // positions are offsets along that line, not field-sized cell addresses.
  function lineScratch(ctx,lines){
    if(!ctx.skipSpaces)return null;
    const n=lines.reduce((max,L)=>Math.max(max,L.n),0);
    return {positions:new Uint32Array(n),values:new Uint8Array(n),n:0};
  }
  function compactLine(ctx,L,scratch){
    if(!scratch)return null;
    let n=0;
    for(let j=L.first,r=L.r+j*L.dr,c=L.c+j*L.dc;j<L.n;j++,r+=L.dr,c+=L.dc){
      const v=ctx.value(r,c);if(v<0)continue;
      scratch.positions[n]=j;scratch.values[n]=v;n++;
    }
    scratch.n=n;return scratch;
  }

  function frequency(ctx,lines,progress){
    const counts=new Uint32Array(MASK+1),scratch=lineScratch(ctx,lines);
    for(let li=0;li<lines.length;li++){
      const L=lines[li],packed=compactLine(ctx,L,scratch),n=packed?packed.n:L.n;let hash=0,run=0;
      for(let j=packed?0:L.first;j<n;j++){
        const v=packed?packed.values[j]:ctx.value(L.r+j*L.dr,L.c+j*L.dc);
        if(v<0){run=0;hash=0;continue;}
        hash=((hash<<1)|v)&MASK;
        if(++run>=ANCHOR_BITS&&counts[hash]<0xffffffff)counts[hash]++;
      }
      if((li&31)===0)progress('frequency',li,lines.length);
    }
    return counts;
  }

  function anchors(records,counts){
    const groups=new Map(),unanchored=[];
    for(const record of records.values()){
      const word=record.word;let run=0,hash=0,best=Infinity;
      for(let j=0;j<word.length;j++){
        if(word[j]===' '){run=0;hash=0;continue;}
        hash=((hash<<1)|(word.charCodeAt(j)&1))&MASK;run++;
        const length=Math.min(run,ANCHOR_BITS),score=length===ANCHOR_BITS?counts[hash]:Infinity;
        if(length>record.length||length===ANCHOR_BITS&&score<best){
          record.length=length;record.hash=hash;record.offset=j-length+1;best=score;
        }
      }
      if(record.length===ANCHOR_BITS&&!best)continue;
      if(!record.length){unanchored.push(record);continue;}
      let group=groups.get(record.length);
      if(!group){group={length:record.length,mask:(1<<record.length)-1,buckets:new Map()};groups.set(record.length,group);}
      const list=group.buckets.get(record.hash);
      if(list)list.push(record);else group.buckets.set(record.hash,[record]);
    }
    return {groups:Array.from(groups.values()),unanchored};
  }

  function collect(ctx,lines,records,index,progress){
    const {value}=ctx,scratch=lineScratch(ctx,lines);
    function candidate(record,L,li,at,packed){
      const word=record.word;
      if(at<(packed?0:L.first)||at+word.length>(packed?packed.n:L.n))return;
      const sourceAt=packed?packed.positions[at]:at,row=L.r+sourceAt*L.dr;
      // Lines are visited in tie order and cells in their forward order.
      if(record.heap.length===record.need&&record.heap[0].row<=row)return;
      for(let j=0,r=row,c=L.c+sourceAt*L.dc;j<word.length;j++,r+=L.dr,c+=L.dc){
        const v=packed?packed.values[at+j]:value(r,c);
        if(v<0||word[j]!==' '&&v!==(word.charCodeAt(j)&1))return;
      }
      keep(record,{li,at:sourceAt,row});
    }
    for(let li=0;li<lines.length;li++){
      const L=lines[li],firstRow=Math.floor(L.cell/ctx.W),packed=compactLine(ctx,L,scratch),n=packed?packed.n:L.n;let hash=0,run=0;
      for(let j=packed?0:L.first;j<n;j++){
        const v=packed?packed.values[j]:value(L.r+j*L.dr,L.c+j*L.dc);
        if(v<0){run=0;hash=0;continue;}
        hash=((hash<<1)|v)&MASK;run++;
        for(const group of index.groups){
          if(run<group.length)continue;
          const key=hash&group.mask,bucket=group.buckets.get(key);
          if(bucket)for(let b=0;b<bucket.length;){
            const record=bucket[b];
            candidate(record,L,li,j-group.length+1-record.offset,packed);
            // Every remaining line starts at this row or lower. Once all
            // requested occurrences are above it, this word is finished.
            // Retiring it avoids field-size x sequence-size work on repeats.
            if(record.heap.length===record.need&&record.heap[0].row<=firstRow){
              bucket[b]=bucket[bucket.length-1];bucket.pop();
            }else b++;
          }
          if(bucket&&!bucket.length)group.buckets.delete(key);
        }
        for(let b=0;b<index.unanchored.length;){
          const record=index.unanchored[b];candidate(record,L,li,j,packed);
          if(record.heap.length===record.need&&record.heap[0].row<=firstRow){
            index.unanchored[b]=index.unanchored[index.unanchored.length-1];index.unanchored.pop();
          }else b++;
        }
      }
      if((li&31)===0)progress('search',li,lines.length);
      if(!index.unanchored.length&&index.groups.every(group=>!group.buckets.size))break;
    }
    for(const record of records.values())record.heap.sort(compare);
  }

  function geometry(ctx,L,at,n,compact,skipSpaces=false){
    const r=L.r+at*L.dr,c=L.c+at*L.dc,start=r*ctx.W+c,step=L.dr*ctx.W+L.dc;
    const hit={r,c,n,p:L.p,dir:L.dir,start,step};
    if(skipSpaces){
      const cells=new Array(n);let size=0,hasGaps=false;
      for(let j=at;j<L.n&&size<n;j++){
        const row=L.r+j*L.dr,col=L.c+j*L.dc;if(ctx.value(row,col)<0)continue;
        const cell=row*ctx.W+col;if(cell!==start+size*step)hasGaps=true;
        cells[size++]=cell;
      }
      if(size!==n)throw new Error('Изменился упакованный снимок во время поиска.');
      if(!compact||hasGaps)hit.cells=cells;
      if(hasGaps){hit.step=null;hit.skipSpaces=true;}
    }else if(!compact){hit.cells=new Array(n);for(let j=0;j<n;j++)hit.cells[j]=start+j*step;}
    return hit;
  }

  function sequenceSearch(ctx,lines,options,progress){
    const vsets=options.vsets||[],halves=ctx.parity===2?2:1,found=[];
    const lineSets=halves===2?[0,1].map(p=>({p,lines:lines.filter(L=>L.p===p)})):[{p:null,lines}];
    const skips=lineSets.map(({p})=>new Set(p===null?options.skip||[]:options.skipByHalf?.[p]||options.skip||[]));
    // Histogram is shared by halves; rarity only chooses an exact filter and
    // cannot change the selected matches or suppress a present pattern.
    const prepared=lineSets.map((set,i)=>({...set,skip:skips[i],records:variants(vsets,skips[i])}));
    if(options.independentWords)for(const set of prepared)for(const record of set.records.values())record.need=1;
    const needsFrequency=prepared.some(set=>Array.from(set.records.keys()).some(word=>/[01]{16}/.test(word)));
    const counts=needsFrequency?frequency(ctx,lines,progress):new Uint32Array(MASK+1);
    for(const set of prepared){
      const {records,skip}=set;
      if(records.size)collect(ctx,set.lines,records,anchors(records,counts),progress);
      for(let i=0;i<vsets.length;i++){
        if(skip.has(i))continue;
        let best=null;
        for(const entry of vsets[i]||[]){
          const tuple=Array.isArray(entry),word=tuple?entry[0]:entry.word,variant=tuple?entry[2]||{}:entry;
          const record=records.get(word),occurrence=record?.heap[record.next];
          // Variant order wins equal-row ties, as in ochkiGet.
          if(occurrence&&(!best||occurrence.row<best.occurrence.row))best={record,occurrence,word,variant,vn:tuple?entry[1]:entry.vn};
        }
        if(!best)continue;
        const {record,occurrence,word,variant,vn}=best;if(!options.independentWords)record.next++;
        found.push({...geometry(ctx,set.lines[occurrence.li],occurrence.at,word.length,!!options.compact,ctx.skipSpaces),i,vn:vn||'',text:word,
          variantFlags:variant.flags,variantIndex:variant.index,variantLabel:variant.label});
      }
    }
    const foundIndices=Array.from(new Set(found.map(hit=>hit.i)));
    return {found,foundIndices,foundByHalf:halves===2?[0,1].map(p=>found.filter(hit=>hit.p===p).map(hit=>hit.i)):null,
      foundEver:foundIndices.length,foundCount:found.length,newCount:found.length,total:vsets.length*halves,halves};
  }

  // Legacy circuits concatenate ALL eligible cells of one family, including
  // transitions between geometric lines. Neither a row boundary nor a hole
  // breaks a circuit. The last cell connects back to its first cell.
  function circuit(ctx,dir,visit){
    const {W,H,parity,anchor,value}=ctx;
    function add(r,c){
      if((parity===0||parity===1)&&((c-anchor-r)&1)!==parity)return true;
      const v=value(r,c);return v<0||visit(r*W+c,v)!==false;
    }
    if(dir===0){for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(!add(r,c))return false;}
    else if(dir===2){for(let c=0;c<W;c++)for(let r=0;r<H;r++)if(!add(r,c))return false;}
    else if(dir===1){
      for(let k=1-H;k<W;k++)for(let r=Math.max(0,-k),end=Math.min(H-1,W-1-k);r<=end;r++)if(!add(r,r+k))return false;
    }else{
      for(let k=0;k<W+H-1;k++)for(let r=Math.max(0,k-W+1),end=Math.min(H-1,k);r<=end;r++)if(!add(r,k-r))return false;
    }
    return true;
  }

  // Only the prefix needed for wraparound is retained. If a word takes more
  // than one lap, this prefix contains the (shorter) complete circuit.
  function circuitStream(ctx,dir,cycleSize,extra,visit){
    const size=Math.min(extra,cycleSize),cells=new Float64Array(size),bits=new Uint8Array(size);
    let ordinal=0;
    const completed=circuit(ctx,dir,(q,v)=>{
      if(ordinal<size){cells[ordinal]=q;bits[ordinal]=v;}
      return visit(ordinal++,q,v);
    });
    if(!completed)return;
    for(let j=0;j<extra;j++)if(visit(ordinal++,cells[j%cycleSize],bits[j%cycleSize])===false)return;
  }

  // A suffix filter is used for circuits instead of the rare interior seed.
  // It permits exact backwards verification in one bounded rolling window,
  // without random access into a field-sized circuit-address array. Wildcard
  // suffixes are indexed by their literal-bit mask, then fully verified.
  function circuitAnchors(records){
    const groups=new Map();
    for(const record of records.values()){
      const word=record.word,length=Math.min(ANCHOR_BITS,word.length);let mask=0,hash=0;
      for(let j=word.length-length;j<word.length;j++){
        mask=(mask<<1)|(word[j]===' '?0:1);hash=(hash<<1)|(word[j]===' '?0:word.charCodeAt(j)&1);
      }
      const key=length+'|'+mask;let group=groups.get(key);
      if(!group){group={length,mask,buckets:new Map()};groups.set(key,group);}
      const bucket=group.buckets.get(hash);
      if(bucket)bucket.push(record);else group.buckets.set(hash,[record]);
    }
    return Array.from(groups.values());
  }

  function loopSearch(ctx,options,progress){
    if(['ones','zeros','alternating'].includes(options.pattern))throw new RangeError('Циклический поиск серий большого поля ещё не поддерживается.');
    const vsets=options.vsets||[],records=variants(vsets,new Set(options.skip||[]));
    if(options.independentWords)for(const record of records.values())record.need=1;
    const empty={found:[],foundIndices:[],foundByHalf:null,foundEver:0,foundCount:0,newCount:0,total:vsets.length,halves:1,loop:true};
    if(!records.size)return empty;
    let cycleSize=0;
    circuit(ctx,0,()=>{cycleSize++;if(cycleSize%262144===0)progress('circuit',cycleSize,ctx.W*ctx.H);});
    if(!cycleSize)return empty;
    const maxLength=Array.from(records.values()).reduce((max,record)=>Math.max(max,record.word.length),1);
    const values=new Uint8Array(maxLength),cells=new Float64Array(maxLength),groups=circuitAnchors(records);
    for(let li=0;li<ctx.dirs.length;li++){
      let hash=0;
      circuitStream(ctx,ctx.dirs[li],cycleSize,maxLength-1,(end,q,v)=>{
        const slot=end%maxLength;values[slot]=v;cells[slot]=q;hash=((hash<<1)|v)&MASK;
        for(const group of groups){
          if(end+1<group.length)continue;
          const key=hash&group.mask,bucket=group.buckets.get(key);if(!bucket)continue;
          for(let b=0;b<bucket.length;){
            const record=bucket[b],word=record.word,at=end-word.length+1;
            if(at>=0&&at<cycleSize){
              const cell=cells[at%maxLength],row=Math.floor(cell/ctx.W);
              if(record.heap.length<record.need||record.heap[0].row>row){
                let j=0;
                while(j<word.length&&(word[j]===' '||values[(at+j)%maxLength]===(word.charCodeAt(j)&1)))j++;
                if(j===word.length)keep(record,{li,at,row,cell});
              }
            }
            // Row zero is the only global lower bound for nonmonotonic
            // circuits. Equal-row starts later in this stream lose the tie.
            if(record.heap.length===record.need&&record.heap[0].row===0){bucket[b]=bucket[bucket.length-1];bucket.pop();}
            else b++;
          }
          if(!bucket.length)group.buckets.delete(key);
        }
        if(end%262144===0){
          progress('search',li*(cycleSize+maxLength-1)+end,ctx.dirs.length*(cycleSize+maxLength-1));
          if(groups.every(group=>!group.buckets.size))return false;
        }
      });
      if(groups.every(group=>!group.buckets.size))break;
    }
    for(const record of records.values())record.heap.sort(compare);
    const found=[],requests=ctx.dirs.map(()=>[]),skip=new Set(options.skip||[]),names={0:'row',2:'col',1:'diag','-1':'antidiag'};
    for(let i=0;i<vsets.length;i++){
      if(skip.has(i))continue;
      let best=null;
      for(const entry of vsets[i]||[]){
        const tuple=Array.isArray(entry),word=tuple?entry[0]:entry.word,variant=tuple?entry[2]||{}:entry;
        const record=records.get(word),occurrence=record?.heap[record.next];
        if(occurrence&&(!best||occurrence.row<best.occurrence.row))best={record,occurrence,word,variant,vn:tuple?entry[1]:entry.vn};
      }
      if(!best)continue;
      const {record,occurrence,word,variant,vn}=best;if(!options.independentWords)record.next++;
      const hit={i,r:occurrence.row,c:occurrence.cell%ctx.W,n:word.length,p:null,dir:options.through?'loop-'+names[ctx.dirs[occurrence.li]]:'loop',
        start:occurrence.cell,step:null,cells:new Array(word.length),text:word,vn:vn||'',variantFlags:variant.flags,variantIndex:variant.index,variantLabel:variant.label};
      found.push(hit);requests[occurrence.li].push({at:occurrence.at,hit});
    }
    // Recover only selected paths in one additional streaming pass per
    // circuit. Output cells are intrinsic to these bent/wrapping paths.
    for(let li=0;li<requests.length;li++){
      const pending=requests[li];if(!pending.length)continue;
      pending.sort((a,b)=>a.at-b.at);
      const lastEnd=pending.reduce((max,item)=>Math.max(max,item.at+item.hit.n),0),active=[];
      let next=0;
      circuitStream(ctx,ctx.dirs[li],cycleSize,Math.max(0,lastEnd-cycleSize),(at,q)=>{
        while(next<pending.length&&pending[next].at===at)active.push(pending[next++]);
        for(let j=0;j<active.length;){
          const item=active[j],position=at-item.at;item.hit.cells[position]=q;
          if(position+1===item.hit.n){active[j]=active[active.length-1];active.pop();}else j++;
        }
        if(at%262144===0)progress('paths',at,lastEnd);
        if(next===pending.length&&!active.length)return false;
      });
    }
    const foundIndices=Array.from(new Set(found.map(hit=>hit.i)));
    return {...empty,found,foundIndices,foundEver:foundIndices.length,foundCount:found.length,newCount:found.length};
  }

  function vRouteAPI(){
    if(typeof module==='object'&&module.exports&&typeof require==='function')return require('./mayatnik-ochki-v-route.js');
    if(!globalThis.MayatnikOchkiVRoute&&typeof importScripts==='function')importScripts('mayatnik-ochki-v-route.js');
    if(!globalThis.MayatnikOchkiVRoute)throw new Error('Не загружен построитель V-маршрутов.');
    return globalThis.MayatnikOchkiVRoute;
  }

  function vSearch(ctx,options,progress){
    if(['ones','zeros','alternating'].includes(options.pattern))throw new RangeError('Поиск серий по V-маршрутам большого поля ещё не поддерживается.');
    const api=vRouteAPI(),{W,H,anchor,parity}=ctx,meetingPoints=options.meetingPoints||[];
    const points=api.verticalPoints(meetingPoints,H);
    progress('routes',0,points.length);
    const lines=api.lines({width:W,height:H,points,pack:false,read:(r,c)=>{
      if((parity===0||parity===1)&&((c-anchor-r)&1)!==parity)return -1;
      return ctx.value(r,c);
    },partition:parity<0?null:(r,c)=>(c-anchor-r)&1});
    progress('routes',points.length,points.length);
    const vsets=options.vsets||[],halves=parity===2?2:1,found=[];
    const lineSets=halves===2?[0,1].map(p=>({p,lines:lines.filter(L=>L.p===p)})):[{p:null,lines}];
    for(const set of lineSets){
      const skip=new Set(set.p===null?options.skip||[]:options.skipByHalf?.[set.p]||options.skip||[]),records=variants(vsets,skip);
      if(options.independentWords)for(const record of records.values())record.need=1;
      const groups=circuitAnchors(records);
      for(let li=0;li<set.lines.length;li++){
        const L=set.lines[li];let hash=0;
        for(let end=0;end<L.n;end++){
          hash=((hash<<1)|(L.str.charCodeAt(end)&1))&MASK;
          for(const group of groups){
            if(end+1<group.length)continue;
            const key=hash&group.mask,bucket=group.buckets.get(key);if(!bucket)continue;
            for(let b=0;b<bucket.length;){
              const record=bucket[b],word=record.word,at=end-word.length+1;
              if(at>=0){
                const row=Math.floor(L.cells[at]/W);
                if(record.heap.length<record.need||record.heap[0].row>row){
                  let j=0;while(j<word.length&&(word[j]===' '||L.str[at+j]===word[j]))j++;
                  if(j===word.length)keep(record,{li,at,row});
                }
              }
              // The ascending arm makes row order nonmonotonic. Only zero
              // proves that a later start/line cannot improve a full heap.
              if(record.heap.length===record.need&&record.heap[0].row===0){bucket[b]=bucket[bucket.length-1];bucket.pop();}
              else b++;
            }
            if(!bucket.length)group.buckets.delete(key);
          }
        }
        if((li&31)===0)progress('search',li,set.lines.length);
        if(groups.every(group=>!group.buckets.size))break;
      }
      for(const record of records.values())record.heap.sort(compare);
      for(let i=0;i<vsets.length;i++){
        if(skip.has(i))continue;
        let best=null;
        for(const entry of vsets[i]||[]){
          const tuple=Array.isArray(entry),word=tuple?entry[0]:entry.word,variant=tuple?entry[2]||{}:entry;
          const record=records.get(word),occurrence=record?.heap[record.next];
          if(occurrence&&(!best||occurrence.row<best.occurrence.row))best={record,occurrence,word,variant,vn:tuple?entry[1]:entry.vn};
        }
        if(!best)continue;
        const {record,occurrence,word,variant,vn}=best;if(!options.independentWords)record.next++;
        const L=set.lines[occurrence.li],cells=Array.from(L.cells.subarray(occurrence.at,occurrence.at+word.length));
        found.push({i,r:occurrence.row,c:cells[0]%W,n:word.length,p:L.p,dir:'v',start:cells[0],step:null,cells,text:word,vn:vn||'',
          variantFlags:variant.flags,variantIndex:variant.index,variantLabel:variant.label});
      }
    }
    const foundIndices=Array.from(new Set(found.map(hit=>hit.i)));
    return {found,foundIndices,foundByHalf:halves===2?[0,1].map(p=>found.filter(hit=>hit.p===p).map(hit=>hit.i)):null,
      foundEver:foundIndices.length,foundCount:found.length,newCount:found.length,total:vsets.length*halves,halves,
      reason:!meetingPoints.length?'На этом кадре нет точки встречи диагональных осей.':!lines.length?'Нет непрерывного маршрута ↘↗ вдоль вертикальных осей.':''};
  }

  function simpleSearch(ctx,lines,options,progress){
    const found=[],types=new Map(),pattern=options.pattern,alternating=pattern==='alternating',wanted=pattern==='zeros'?0:1;
    const minimumLength=Math.max(2,Math.min(4096,Math.trunc(Number(options.minimumLength)||5)));
    let count=0,longest=0;
    for(let li=0;li<lines.length;li++){
      const L=lines[li];let start=-1,previous=-1,firstBit=0;
      function emit(end){
        if(start<0||end-start<minimumLength)return;
        const n=end-start;count++;longest=Math.max(longest,n);
        const type=[n,L.p,L.dir,firstBit].join('|');
        const run={...geometry(ctx,L,start,n,true),startBit:firstBit,alternating};
        if(!types.has(type))types.set(type,run);
        if(found.length<100){
          const text=alternating?(firstBit?'10':'01').repeat(Math.ceil(n/2)).slice(0,n):String(firstBit).repeat(n);
          found.push({...geometry(ctx,L,start,n,!!options.compact),text,vn:!alternating&&firstBit!==wanted?'инв':''});
        }
      }
      for(let j=L.first,r=L.r+j*L.dr,c=L.c+j*L.dc;j<L.n;j++,r+=L.dr,c+=L.dc){
        const v=ctx.value(r,c),allowed=v>=0&&(alternating||options.inverse||v===wanted);
        if(!allowed){emit(j);start=-1;previous=-1;continue;}
        if(start>=0&&(alternating?v===previous:v!==previous)){emit(j);start=-1;}
        if(start<0){start=j;firstBit=v;}
        previous=v;
      }
      emit(L.n);
      if((li&31)===0)progress('search',li,lines.length);
    }
    return {found,typeRuns:Array.from(types.values()),count,longest,simple:true,halves:ctx.parity===2?2:1};
  }

  /**
   * options: mode, anchor, parity (-1 combined, 0/1 selected, 2 independent),
   * vsets (variant tuples [word,vn,metadata] or objects), skip / skipByHalf,
   * pattern, minimumLength, inverse (simple series), invertBits, compact,
   * skipSpaces (omit absent cells within each straight line),
   * through (four cyclic circuits), mode:'loop' (row-major cyclic circuit),
   * mode:'v', meetingPoints (absolute field coordinates of meeting axes),
   * independentWords (let different input rows reuse the earliest match).
   * Optional bounds {x,y,width,height}, inclusive rowLo / rowHi clipping.
   * Presence must describe the searchable geometry: joined and transformed
   * parity views need their own adapter. V uses the existing route budget.
   * Results deliberately contain no dense highlight raster. Compact hits
   * describe cells as start + j*step, 0 <= j < n; typeRuns always compact.
   * A skipSpaces hit spanning holes, loop or V hit always carries explicit
   * cells, step:null. Simple-series patterns currently support straight lines.
   */
  function search(snapshot,options={},onProgress){
    let lastProgress=0;
    function progress(phase,done,total){
      if(!onProgress)return;
      const now=Date.now();if(now-lastProgress<250&&done<total)return;
      lastProgress=now;onProgress({phase,done,total});
    }
    const ctx=context(snapshot,options);
    let result;
    if(ctx.loop)result=loopSearch(ctx,options,progress);
    else if(ctx.vRoute)result=vSearch(ctx,options,progress);
    else{
      const lines=descriptors(ctx,progress);
      result=['ones','zeros','alternating'].includes(options.pattern)?simpleSearch(ctx,lines,options,progress):sequenceSearch(ctx,lines,options,progress);
    }
    progress('complete',1,1);
    return {...result,directions:ctx.dirs.length,complete:true,packed:true,width:ctx.W,height:ctx.H,reason:result.reason||''};
  }
  return {search};
});
