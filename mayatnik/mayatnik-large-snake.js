/* МАЯ-653: exact downward snake search on immutable packed GPU planes.
 * search(snapshot, options, onProgress) and findSteps(snapshot, options).
 * A hit's cells, r and c are absolute source addresses. No full-field hl.
 * Paths are consumed per word and parity, exactly as mayatnik-snake.js:
 * sequence order, earliest row/column, left child first, variant-order ties.
 * Terminate the worker to cancel; explicit budgets return complete:false.
 */
(function(root,factory){
  'use strict';
  const variants=typeof module==='object'&&module.exports?require('./mayatnik-variants.js'):root.MayatnikVariants;
  const api=factory(variants);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikLargeSnake=api;
  if(typeof WorkerGlobalScope!=='undefined'&&root instanceof WorkerGlobalScope){
    root.onmessage=event=>{
      const {id,snapshot,options}=event.data||{};
      try{root.postMessage({id,result:api.search(snapshot,options,progress=>root.postMessage({id,progress}))});}
      catch(error){root.postMessage({id,error:String(error?.message||error)});}
    };
  }
})(globalThis,function(Variants){
  'use strict';
  function prepare(snapshot,options){
    const {width:W,height:H,stride,bits,present}=snapshot||{};
    // A row-backed reader stays in its owning worker; it returns raw bits.
    const readValue=typeof snapshot?.readValue==='function'?snapshot.readValue.bind(snapshot):null;
    const packed=bits instanceof Uint32Array&&present instanceof Uint32Array&&bits.length>=stride*H&&present.length>=stride*H;
    if(!Number.isSafeInteger(W)||W<1||!Number.isSafeInteger(H)||H<1||!Number.isSafeInteger(W*H)||
      !Number.isSafeInteger(stride)||stride<Math.ceil(W/32)||(!readValue&&!packed))
      throw Error('Неполный упакованный снимок для поиска змеи.');
    if(options.skipSpaces||options.through||options.joined)throw Error('Упакованная змея требует обычные две решётки без пропуска пустот или составной проекции.');
    const anchor=options.anchor??0;
    if(!Number.isSafeInteger(anchor))throw Error('Некорректная ось поиска змеи.');
    const parities=options.parities??(options.parity===0?[0]:options.parity===1?[1]:[0,1]);
    if(!Array.isArray(parities)||!parities.length||parities.some(p=>p!==0&&p!==1)||new Set(parities).size!==parities.length)
      throw Error('Некорректные половины поиска змеи.');
    const b=options.bounds||{},x0=Math.max(0,Math.min(W,Math.floor(b.x||0))),y0=Math.max(0,Math.min(H,Math.floor(b.y||0)));
    const x1=Math.min(W,x0+(b.width==null?W:Math.max(0,Math.floor(b.width)))),y1=Math.min(H,y0+(b.height==null?H:Math.max(0,Math.floor(b.height))));
    if(![x0,x1,y0,y1].every(Number.isSafeInteger))throw Error('Некорректные границы поиска змеи.');
    const lo=options.rowLo?.length?options.rowLo:null,hi=options.rowHi?.length?options.rowHi:null,invert=options.invertBits?1:0;
    if(lo&&lo.length<H||hi&&hi.length<H)throw Error('Неполные построчные границы поиска змеи.');
    const value=(r,c)=>{
      if(r<y0||r>=y1||c<x0||c>=x1||lo&&c<lo[r]||hi&&c>hi[r])return -1;
      if(readValue){
        const bit=readValue(r,c);
        if(bit!==-1&&bit!==0&&bit!==1)throw new TypeError('Чтение снимка должно синхронно вернуть -1, 0 или 1.');
        return bit<0?-1:bit^invert;
      }
      const q=r*stride+Math.floor(c/32),shift=c&31;
      return present[q]>>>shift&1?(bits[q]>>>shift&1)^invert:-1;
    };
    let vsets=options.vsets;
    if(vsets==null){
      if(!Variants)throw Error('Для генерации вариантов нужен mayatnik-variants.js; передайте готовые vsets.');
      if(!Array.isArray(options.sequence))throw Error('Не задана последовательность поиска змеи.');
      vsets=options.sequence.map(word=>Variants.generate(word,options));
    }
    if(!Array.isArray(vsets))throw Error('Некорректные варианты поиска змеи.');
    vsets=vsets.map(list=>{
      if(!Array.isArray(list))throw Error('Некорректная строка вариантов поиска змеи.');
      return list.map(entry=>{
        const tuple=Array.isArray(entry),record=tuple?entry[2]||{}:entry,word=tuple?entry[0]:record?.word;
        if(typeof word!=='string'||!/^[01 ]+$/.test(word))throw Error('Вариант змеи должен содержать биты или пробелы-маски.');
        return {word,vn:tuple?entry[1]:record.vn,flags:record.flags,index:record.index,label:record.label};
      });
    });
    const skips=options.skipIndices??options.skipByHalf??[options.skip||[],options.skip||[]];
    if(!Array.isArray(skips)||skips.length!==2||skips.some(list=>!Array.isArray(list)||list.some(i=>!Number.isInteger(i)||i<0||i>=vsets.length)))
      throw Error('Некорректные исключения поиска змеи.');
    return {W,H,anchor,parities,x0,x1,y0,y1,value,vsets,excluded:skips.map(list=>new Set(list))};
  }

  function* findSteps(snapshot,options={}){
    const ctx=prepare(snapshot,options),{W,H,anchor,parities,x0,x1,y0,y1,value,vsets,excluded}=ctx;
    const halves=options.halves??parities.length,total=vsets.length*halves,found=[],started=Date.now();
    let operations=0,prepassWords=0,prepassCells=0,entries=0,peakEntries=0,currentIndex=0,currentHalf=0,reported=0,phase='search';
    let chunkStarted=started,chunkAt=0,complete=true,reason='';
    const chunkMs=options.chunkMs??125,chunkOperations=options.chunkOperations??Infinity;
    const maxOperations=options.maxOperations??Infinity,maxMs=options.maxMs??Infinity;
    const limit={};
    function tick(work=1){
      operations+=work;
      if(operations>maxOperations)throw limit;
      if(operations-chunkAt>=chunkOperations||operations%1024===0){
        if(options.cancelled?.())throw Error('Поиск змеи отменён.');
        const now=Date.now();if(now-started>maxMs)throw limit;
        return operations-chunkAt>=chunkOperations||now-chunkStarted>=chunkMs;
      }
      return false;
    }
    function progress(){
      chunkStarted=Date.now();chunkAt=operations;
      const newFound=found.slice(reported);reported=found.length;
      return {phase,operations,entries,peakEntries,found:found.length,total,halves,index:currentIndex,half:currentHalf,newFound};
    }
    const needs=[new Map(),new Map()];
    for(const p of parities)for(let i=0;i<vsets.length;i++)if(!excluded[p].has(i))for(const text of new Set(vsets[i].map(v=>v.word)))
      needs[p].set(text,(needs[p].get(text)||0)+1);
    let maxDepth=1;for(const map of needs)for(const text of map.keys())if(text.length<=y1-y0)maxDepth=Math.max(maxDepth,text.length);

    // Direct-mapped, bounded memo. A collision discards only an optimization,
    // never a pending child's answer: the DFS keeps returned counts on its own
    // typed stack. No object graph or width*height array is constructed.
    const requested=options.memoEntries??1048576;
    if(!Number.isSafeInteger(requested)||requested<1||requested>16777216)throw Error('Некорректный размер кэша змеи.');
    let slots=1;while(slots<Math.min(requested,Math.max(1,(x1-x0)*maxDepth)))slots*=2;
    const keys=new Float64Array(slots),counts=new Uint32Array(slots),stamps=new Uint32Array(slots),slotMask=slots-1;
    let generation=1;
    const clear=()=>{entries=0;if(++generation===4294967295){stamps.fill(0);generation=1;}};
    const slot=q=>(Math.imul(q>>>0,2654435761)>>>0)&slotMask;
    const get=q=>{const s=slot(q);return stamps[s]===generation&&keys[s]===q?counts[s]:undefined;};
    function put(q,n){
      const s=slot(q);if(stamps[s]!==generation){entries++;peakEntries=Math.max(peakEntries,entries);}
      keys[s]=q;counts[s]=n;stamps[s]=generation;
    }
    const stackCell=new Float64Array(maxDepth),stackStage=new Uint8Array(maxDepth),stackLeft=new Uint32Array(maxDepth);
    const firstRows=new Map(),impossible=[{},{}];
    const knownImpossible=(text,p)=>{let node=impossible[p];for(const bit of text){if(node.end)return true;node=node[bit];if(!node)return false;}return !!node.end;};
    const rememberImpossible=(text,p)=>{let node=impossible[p];for(const bit of text)node=node[bit]||(node[bit]={});node.end=true;};

    // Same Shift-And recurrence as the CPU search, restricted to the visible
    // columns. It decides only the first start row, never column/path ties.
    function* firstRow(text,p){
      if(firstRows.has(text))return firstRows.get(text)[p];
      const m=text.length,rows=[-1,-1],done=[0,1].map(n=>!needs[n].has(text)||knownImpossible(text,n));
      if(m>y1-y0||x1<=x0){firstRows.set(text,rows);return -1;}
      const words=Math.ceil(m/32),CW=x1-x0,masks=[new Uint32Array(words),new Uint32Array(words)];
      for(let i=0;i<m;i++){const mark=1<<(i&31);if(text[i]===' '){masks[0][i>>>5]|=mark;masks[1][i>>>5]|=mark;}else masks[text.charCodeAt(i)-48][i>>>5]|=mark;}
      let prev=new Uint32Array(CW*words),curr=new Uint32Array(CW*words),prevLen=new Uint32Array(CW),currLen=new Uint32Array(CW);
      const lastBit=1<<((m-1)&31);phase='first-row';
      for(let r=y0;r<y1;r++){
        for(let c=x0;c<x1;c++){
          if(tick())yield progress();
          const n=c-x0,half=(c-anchor-r)&1,v=value(r,c);
          if(done[half]||v<0){currLen[n]=0;continue;}prepassCells++;
          const l=n>0?prevLen[n-1]:0,right=n+1<CW?prevLen[n+1]:0,parentWords=Math.max(l,right),base=n*words,lb=(n-1)*words,rb=(n+1)*words,mask=masks[v];
          let carry=1,len=0;
          for(let j=0;j<words&&(j<parentWords||carry);j++){
            const x=(j<l?prev[lb+j]:0)|(j<right?prev[rb+j]:0),next=((x<<1)|carry)&mask[j];
            carry=x>>>31;curr[base+j]=next;if(next)len=j+1;prepassWords++;if(tick())yield progress();
          }
          currLen[n]=len;if(len===words&&(curr[base+words-1]&lastBit)){rows[half]=r-m+1;done[half]=true;}
        }
        if(done[0]&&done[1])break;
        [prev,curr]=[curr,prev];[prevLen,currLen]=[currLen,prevLen];
      }
      phase='paths';firstRows.set(text,rows);
      for(const half of parities)if(needs[half].has(text)&&rows[half]<0)rememberImpossible(text,half);
      return rows[p];
    }

    function occurrence(text,cap,p){
      if(cap>0xffffffff)throw Error('Слишком много повторов одной строки поиска.');
      let r=y0,c=x0,rank=0,pending=null,seeded=false,ended=false;
      const valid=(q,i)=>{const v=value(Math.floor(q/W),q%W);return v>=0&&(text[i]===' '||v===text.charCodeAt(i)-48);};
      function* count(q,index){
        let top=0,answer=0;stackCell[0]=q;stackStage[0]=0;
        while(top>=0){
          if(tick())yield progress();
          const cell=stackCell[top],at=index+top,stage=stackStage[top],col=cell%W;
          if(stage===0){
            const cached=get(cell);
            if(cached!==undefined){answer=cached;top--;continue;}
            if(!valid(cell,at)||Math.floor(cell/W)+text.length-at>y1){answer=0;put(cell,0);top--;continue;}
            if(at+1===text.length){answer=1;put(cell,1);top--;continue;}
            stackStage[top]=1;
            if(col>x0){top++;stackCell[top]=cell+W-1;stackStage[top]=0;}
            else answer=0;
            continue;
          }
          if(stage===1){
            stackLeft[top]=answer;
            if(answer>=cap||col+1>=x1){put(cell,answer);top--;continue;}
            stackStage[top]=2;top++;stackCell[top]=cell+W+1;stackStage[top]=0;continue;
          }
          answer=Math.min(cap,stackLeft[top]+answer);put(cell,answer);top--;
        }
        return answer;
      }
      function* path(q,which){
        const cells=[q];
        for(let i=1;i<text.length;i++){
          const col=q%W;let left=0;if(col>x0)left=yield* count(q+W-1,i);
          if(which<left)q+=W-1;
          else{which-=left;if(col+1>=x1)throw Error('Не удалось восстановить точный путь змеи.');const right=yield* count(q+W+1,i);if(which>=right)throw Error('Изменился снимок поиска змеи.');q+=W+1;}
          cells.push(q);
        }
        return cells;
      }
      return {
        *peek(){
          if(pending)return pending;if(ended||knownImpossible(text,p))return null;
          if(!seeded){seeded=true;r=yield* firstRow(text,p);c=x0;if(r<0){ended=true;return null;}}
          clear();
          for(;r+text.length<=y1;r++,c=x0,rank=0){
            for(;c<x1;c++,rank=0){
              if(tick())yield progress();
              if(((c-anchor-r)&1)!==p)continue;
              const q=r*W+c;if(!valid(q,0))continue;
              const n=yield* count(q,0);
              if(rank<n){pending={r,c,cells:yield* path(q,rank)};return pending;}
            }
            clear();
          }
          ended=true;return null;
        },
        take(){rank++;pending=null;}
      };
    }
    const occurrences=[0,1].map(p=>new Map(Array.from(needs[p],([text,cap])=>[text,occurrence(text,cap,p)])));
    try{
      for(let i=0;i<vsets.length;i++)for(const p of parities){
        if(excluded[p].has(i))continue;currentIndex=i;currentHalf=p;let best=null;
        for(const variant of vsets[i]){
          const hit=yield* occurrences[p].get(variant.word).peek();
          if(hit&&(!best||hit.r<best.r||hit.r===best.r&&hit.c<best.c))best={...hit,variant};
        }
        if(!best)continue;
        const {variant,cells,r,c}=best;occurrences[p].get(variant.word).take();
        found.push({i,p,r,c,n:cells.length,cells,vn:variant.vn||'',text:variant.word,variantFlags:variant.flags,variantIndex:variant.index,variantLabel:variant.label,dir:'snake'});
        yield progress();
      }
    }catch(error){
      if(error!==limit)throw error;
      complete=false;reason='Достигнут предел поиска змеи; проверены не все пути.';
    }
    const foundIndices=Array.from(new Set(found.map(hit=>hit.i)));
    return {found,foundIndices,foundByHalf:[0,1].map(p=>found.filter(hit=>hit.p===p).map(hit=>hit.i)),foundEver:foundIndices.length,foundCount:found.length,newCount:found.length,
      total,halves,snake:true,complete,reason,operations,entries,peakEntries,prepassWords,prepassCells,elapsedMs:Date.now()-started};
  }
  function search(snapshot,options={},onProgress=()=>{}){
    const iterator=findSteps(snapshot,options);let step;
    do{step=iterator.next();if(!step.done)onProgress(step.value);}while(!step.done);
    return step.value;
  }
  return {search,findSteps};
});
