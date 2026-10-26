/* Downward edge-neighbour paths on the two diamond lattices. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSnake=api;})(globalThis,function createSnake(){
  'use strict';
  // Shift-And existence pass on the downward DAG. The first accepting row
  // fixes the earliest starting row; it deliberately does not choose a column.
  function* earliestSteps({width:W,height:H,val,anchor=0,text,skip=[false,false]},checkpoint=()=>null){
    const m=text.length;if(!m||m>H||skip.every(Boolean))return {rows:[-1,-1],words:0,cells:0};
    const words=Math.ceil(m/32),masks=[new Uint32Array(words),new Uint32Array(words)];for(let i=0;i<m;i++)masks[text.charCodeAt(i)-48][i>>>5]|=1<<(i&31);
    let prev=new Uint32Array(W*words),curr=new Uint32Array(W*words),prevLen=new Uint32Array(W),currLen=new Uint32Array(W),operations=0,cells=0;
    const rows=[-1,-1],done=skip.slice(),lastBit=1<<((m-1)&31);
    for(let r=0;r<H;r++){
      let work=0;
      for(let c=0;c<W;c++){
        const p=(c-anchor-r)&1,v=val[r*W+c];if(done[p]||v<0){currLen[c]=0;continue;}cells++;
        const l=c>0?prevLen[c-1]:0,right=c+1<W?prevLen[c+1]:0,parentWords=Math.max(l,right),base=c*words,lb=(c-1)*words,rb=(c+1)*words,mask=masks[v];let carry=1,len=0;
        for(let j=0;j<words&&(j<parentWords||carry);j++){const x=(j<l?prev[lb+j]:0)|(j<right?prev[rb+j]:0),next=((x<<1)|carry)&mask[j];carry=x>>>31;curr[base+j]=next;if(next)len=j+1;operations++;work++;}
        currLen[c]=len;if(len===words&&(curr[base+words-1]&lastBit)){rows[p]=r-m+1;done[p]=true;}
        if(work>=32768){const state=checkpoint(work);work=0;if(state)yield state;}
      }
      const state=checkpoint(work);if(state)yield state;
      if(done[0]&&done[1])break;[prev,curr]=[curr,prev];[prevLen,currLen]=[currLen,prevLen];
    }
    return {rows,words:operations,cells};
  }
  function* findSteps({width,height,val,anchor=0,sequence=[],inverse=false,reverse=false,parities=[0,1],halves:outputHalves=parities.length,maxOperations=Infinity,maxEntries=Infinity,maxMs=Infinity,chunkMs=125,chunkOperations=Infinity}){
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||!val||val.length<width*height||sequence.some(s=>typeof s!=='string'||!/^[01]+$/.test(s)))throw Error('Некорректные данные поиска змеи.');
    if(!Array.isArray(parities)||!parities.length||parities.some(p=>p!==0&&p!==1)||new Set(parities).size!==parities.length)throw Error('Некорректные решётки поиска змеи.');
    const N=width*height,total=sequence.length*parities.length,found=[],hl=new Uint8Array(N),started=Date.now();let operations=0,entries=0,peakEntries=0,complete=true,reason='',chunkStarted=started,chunkAt=0,currentIndex=0,currentHalf=0,reportedFound=0,prepassWords=0,prepassCells=0;
    const limit={};const tick=()=>{operations++;if(operations>maxOperations||(operations%1024===0&&Date.now()-started>maxMs))throw limit;return operations-chunkAt>=chunkOperations||operations%1024===0&&Date.now()-chunkStarted>=chunkMs;};
    const progress=()=>{chunkStarted=Date.now();chunkAt=operations;const newFound=found.slice(reportedFound);reportedFound=found.length;return {operations,entries,peakEntries,found:found.length,total,halves:outputHalves,index:currentIndex,half:currentHalf,newFound};};
    const prepassCheckpoint=work=>{operations+=work;const now=Date.now();if(operations>maxOperations||now-started>maxMs)throw limit;return operations-chunkAt>=chunkOperations||now-chunkStarted>=chunkMs?progress():null;};
    const inv=s=>s.replace(/[01]/g,v=>v==='1'?'0':'1'),rev=s=>s.split('').reverse().join('');
    const variants=sequence.map(text=>{const out=[[text,'']];if(inverse)out.push([inv(text),'инв']);if(reverse)out.push([rev(text),'рев']);if(inverse&&reverse)out.push([rev(inv(text)),'инв+рев']);return out;});
    const starts=[[],[],[],[]],impossible=[{},{}];
    // During one starting row, index = row - startingRow. A shared sliding
    // workspace therefore needs width*maxWordLength slots, not a Map per word.
    const depth=Math.min(height,Math.max(1,...sequence.map(text=>text.length))),memoValues=new Uint32Array(width*depth),memoStamp=new Uint32Array(width*depth);let generation=1,memoOffset=0;
    const workspace={has:q=>memoStamp[q-memoOffset]===generation,get:q=>memoStamp[q-memoOffset]===generation?memoValues[q-memoOffset]:undefined,set(q,value){memoStamp[q-memoOffset]=generation;memoValues[q-memoOffset]=value;},clear(){if(++generation===4294967295){memoStamp.fill(0);generation=1;}}};
    // Only an exhaustive zero-path result is reusable as an impossible prefix.
    // Consuming one occurrence never forbids its starting cell or its prefix.
    const knownImpossible=(text,p)=>{let node=impossible[p];for(const bit of text){if(node.end)return true;node=node[bit];if(!node)return false;}return !!node.end;};
    const rememberImpossible=(text,p)=>{let node=impossible[p];for(const bit of text)node=node[bit]||(node[bit]={});node.end=true;};
    const firstRows=new Map();
    function* firstRow(text,p){
      if(!firstRows.has(text)){const result=yield* earliestSteps({width,height,val,anchor,text,skip:[!parities.includes(0)||knownImpossible(text,0),!parities.includes(1)||knownImpossible(text,1)]},prepassCheckpoint);prepassWords+=result.words;prepassCells+=result.cells;firstRows.set(text,result.rows);for(const half of parities)if(result.rows[half]<0)rememberImpossible(text,half);}
      return firstRows.get(text)[p];
    }
    function occurrence(text,cap,p){
      const memo=workspace;let cursor=0,rank=0,pending=null,startRow=-1,everFound=false,seeded=false;
      const word=Uint8Array.from(text,bit=>bit.charCodeAt(0)-48);
      const candidates=starts[2*p+Number(text[0])],lastStart=(height-text.length+1)*width;
      const release=()=>{entries=0;memo.clear();};
      const store=(key,value)=>{if(++entries>maxEntries)throw limit;peakEntries=Math.max(peakEntries,entries);memo.set(key,value);};
      const valid=(q,i)=>q>=0&&q<N&&val[q]===word[i];
      const children=q=>{const c=q%width,r=Math.floor(q/width);return r+1>=height?[]:[...(c>0?[q+width-1]:[]),...(c+1<width?[q+width+1]:[])];};
      function* count(q,i){
        if(!valid(q,i)||Math.floor(q/width)+text.length-i>height)return 0;
        const key=q;if(memo.has(key))return memo.get(key);
        const stack=[[q,i,0]];
        while(stack.length){if(tick())yield progress();const frame=stack[stack.length-1],[cell,at,stage]=frame,k=cell;if(memo.has(k)){stack.pop();continue;}
          if(!valid(cell,at)||Math.floor(cell/width)+text.length-at>height){store(k,0);stack.pop();continue;}
          if(at+1===text.length){store(k,1);stack.pop();continue;}
          const c=cell%width,left=c>0?cell+width-1:c+1<width?cell+width+1:undefined,right=c>0&&c+1<width?cell+width+1:undefined;
          if(!stage){frame[2]=1;if(left!==undefined&&!memo.has(left))stack.push([left,at+1,0]);continue;}
          const first=left===undefined?0:memo.get(left)||0;
          if(stage===1&&first<cap){frame[2]=2;if(right!==undefined&&!memo.has(right))stack.push([right,at+1,0]);continue;}
          const total=Math.min(cap,first+(stage===2&&right!==undefined?memo.get(right)||0:0));
          store(k,total);stack.pop();
        }
        return memo.get(key)||0;
      }
      function* path(q,which){const cells=[q];for(let i=1;i<text.length;i++){for(const next of children(q)){const n=yield* count(next,i);if(which<n){q=next;cells.push(q);break;}which-=n;}}return cells;}
      return { *peek(){if(pending)return pending;if(!text.length||text.length>height||knownImpossible(text,p))return null;if(!seeded){const row=yield* firstRow(text,p);seeded=true;if(row<0)return null;const minimum=row*width;let lo=0,hi=candidates.length;while(lo<hi){const mid=(lo+hi)>>>1;if(candidates[mid]<minimum)lo=mid+1;else hi=mid;}cursor=lo;}startRow=-1;while(cursor<candidates.length&&candidates[cursor]<lastStart){if(tick())yield progress();const q=candidates[cursor],c=q%width,r=Math.floor(q/width);if(r!==startRow){release();startRow=r;memoOffset=r*width;}const n=yield* count(q,0);if(rank<n){pending={cells:yield* path(q,rank),r,c};everFound=true;release();return pending;}cursor++;rank=0;}release();if(!everFound)rememberImpossible(text,p);return null;},take(){rank++;pending=null;}};
    }
    const needs=new Map();for(const vars of variants)for(const text of new Set(vars.map(v=>v[0])))needs.set(text,(needs.get(text)||0)+1);
    const halves=[0,1].map(p=>new Map(Array.from(needs,([text,cap])=>[text,occurrence(text,cap,p)])));
    try{for(let q=0;q<N;q++){if(tick())yield progress();const bit=val[q];if(bit===0||bit===1)starts[2*((q%width-anchor-Math.floor(q/width))&1)+bit].push(q);}for(let i=0;i<variants.length;i++)for(const p of parities){
      currentIndex=i;currentHalf=p;const occurrences=halves[p];let best=null;for(const [text,vn]of variants[i]){const hit=yield* occurrences.get(text).peek();if(hit&&(!best||hit.r<best.r||hit.r===best.r&&hit.c<best.c))best={...hit,text,vn};}if(!best)continue;occurrences.get(best.text).take();found.push({i,p,r:best.r,c:best.c,n:best.cells.length,cells:best.cells,vn:best.vn,dir:'snake'});for(const cell of best.cells)hl[cell]=1;
    }}catch(e){if(e!==limit)throw e;complete=false;reason='Достигнут предел поиска змеи; проверены не все пути.';}
    return {found,hl,total,halves:outputHalves,snake:true,complete,reason,operations,entries,peakEntries,prepassWords,prepassCells,elapsedMs:Date.now()-started};
  }
  function find(options){const steps=findSteps(options);let step;do{step=steps.next();}while(!step.done);return step.value;}
  function createWorker(){const source='const api=('+createSnake.toString()+')();onmessage=e=>{const steps=api.findSteps(e.data);let last=0,pending=[];const pump=()=>{try{const step=steps.next();if(step.done){const result=step.value;postMessage({result},[result.hl.buffer]);}else{pending.push(...step.value.newFound);if(Date.now()-last>=100||pending.length){last=Date.now();postMessage({progress:{...step.value,newFound:pending}});pending=[];}setTimeout(pump,0);}}catch(error){postMessage({error:error.message});}};pump();};',url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}
  function earliest(options){const steps=earliestSteps(options);let step;do{step=steps.next();}while(!step.done);return step.value;}
  return {find,findSteps,createWorker,earliest};
});
