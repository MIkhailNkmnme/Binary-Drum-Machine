/* МАЯ-653: exact catalog of every downward route in packed GPU planes.
 * No graph nodes, per-cell starts or per-route enumeration during compile.
 * Counts/ranks cross persistence as decimal strings. A catalog references an
 * immutable archived snapshot; page/union must receive that snapshot again.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MayatnikLargeSnakeCatalog=api;
})(globalThis,function createPackedCatalog(){
  'use strict';
  const clone=value=>structuredClone(value);
  const decimal=value=>{
    if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value))throw Error('Некорректный точный ранг или счётчик');
    return BigInt(value);
  };
  function prepare(sequence,variants){
    if(!Array.isArray(sequence)||sequence.some(text=>typeof text!=='string'||!/^[01]+$/.test(text)))throw Error('Некорректная последовательность');
    const words=[],known=new Map();
    const rows=sequence.map((text,i)=>{
      const refs=[],seen=new Set(),items=variants?.[i]||[[text,'']];
      if(!Array.isArray(items))throw Error('Некорректные варианты строки');
      for(const item of items){
        const tuple=Array.isArray(item),word=tuple?item[0]:item?.word??item?.text,label=tuple?item[1]:item?.label;
        if(typeof word!=='string'||word.length!==text.length||!/^[01 ]+$/.test(word))throw Error('Некорректный вариант строки');
        if(seen.has(word))continue;seen.add(word);
        let index=known.get(word);if(index===undefined){index=words.length;known.set(word,index);words.push({text:word});}
        refs.push({word:index,index:tuple?refs.length:item.index??refs.length,label:label||'',vn:tuple?label||'':item.vn??label??'',flags:tuple?undefined:clone(item.flags)});
      }
      if(!refs.length)throw Error('Нет вариантов строки');return {i,text,variants:refs};
    });
    return {words,rows};
  }
  function rectangle(bounds,W,H){
    const b=bounds||{},x=Math.max(0,Math.min(W,Math.floor(b.x??0))),y=Math.max(0,Math.min(H,Math.floor(b.y??0)));
    const right=Math.min(W,x+Math.max(0,Math.floor(b.width??W))),bottom=Math.min(H,y+Math.max(0,Math.floor(b.height??H)));
    if(![x,y,right,bottom].every(Number.isSafeInteger))throw Error('Некорректный прямоугольник поиска');
    return {x,y,width:right-x,height:bottom-y};
  }
  function context(snapshot,search={}){
    const {width:W,height:H,stride,bits,present}=snapshot||{};
    if(!Number.isSafeInteger(W)||W<1||!Number.isSafeInteger(H)||H<1||!Number.isSafeInteger(W*H)||
      !Number.isSafeInteger(stride)||stride<Math.ceil(W/32)||!(bits instanceof Uint32Array)||!(present instanceof Uint32Array)||
      bits.length<stride*H||present.length<stride*H)throw Error('Неполный упакованный снимок каталога');
    if(search.joined||search.through||search.skipSpaces)throw Error('Каталог поддерживает обычные решётки без составной проекции и пропуска пустот');
    const anchor=search.anchor??0;
    if(!Number.isSafeInteger(anchor))throw Error('Некорректная ось каталога');
    const parities=search.parities??(search.parity===0?[0]:search.parity===1?[1]:[0,1]);
    if(!Array.isArray(parities)||!parities.length||parities.some(p=>p!==0&&p!==1)||new Set(parities).size!==parities.length)throw Error('Некорректные половины каталога');
    const bounds=rectangle(search.bounds,W,H),x0=bounds.x,x1=x0+bounds.width,y0=bounds.y,y1=y0+bounds.height;
    const lo=search.rowLo?.length?search.rowLo:null,hi=search.rowHi?.length?search.rowHi:null,invert=search.invertBits?1:0;
    if(lo&&lo.length<H||hi&&hi.length<H)throw Error('Неполные построчные границы каталога');
    const value=(r,c)=>{
      if(r<y0||r>=y1||c<x0||c>=x1||lo&&c<lo[r]||hi&&c>hi[r]||parities.length===1&&((c-anchor-r)&1)!==parities[0])return -1;
      const q=r*stride+Math.floor(c/32),shift=c&31;
      return present[q]>>>shift&1?(bits[q]>>>shift&1)^invert:-1;
    };
    const source={width:W,height:H,stride,anchor,parities:parities.slice(),bounds,invertBits:!!invert,
      rowLo:lo?clone(lo):null,rowHi:hi?clone(hi):null};
    return {W,H,stride,x0,x1,y0,y1,anchor,value,source};
  }
  function meter(options={}){
    const quantum=options.chunkOperations??32768,maxOperations=options.maxOperations??Infinity;
    if(!Number.isSafeInteger(quantum)||quantum<1||typeof maxOperations!=='number'||maxOperations<0||Number.isNaN(maxOperations))throw Error('Некорректный предел вычислений каталога');
    let operations=0,pending=0;
    const check=()=>{if(options.cancelled?.())throw Error('Каталог отменён');};
    check();
    return {
      tick(){operations++;if(operations>maxOperations)throw Error('Достигнут предел вычислений; полнота каталога не доказана');if(++pending<quantum)return false;pending=0;check();return true;},
      check,get operations(){return operations;}
    };
  }
  function valid(value,text,at){return value>=0&&(text[at]===' '||value===text.charCodeAt(at)-48);}
  function* work(meter,detail){if(meter.tick())yield {operations:meter.operations,...detail};}

  // Counts at one target row/word position. Two rows of BigInts suffice;
  // the dependency cone expands only as far as the remaining word requires.
  // direction=+1 counts suffixes; -1 counts prefixes backwards from the cell.
  function* countRow(ctx,text,at,endAt,row,direction,from,to,m){
    const depth=Math.abs(endAt-at),far=row+direction*depth;
    if(from>=to||far<ctx.y0||far>=ctx.y1||row<ctx.y0||row>=ctx.y1)return {left:from,values:Array(Math.max(0,to-from)).fill(0n)};
    const left=Math.max(ctx.x0,from-depth),right=Math.min(ctx.x1,to+depth),width=right-left;
    let next=Array(width).fill(0n),curr=Array(width).fill(0n);
    for(let distance=depth;distance>=0;distance--){
      const r=row+direction*distance,index=at+direction*distance,start=Math.max(left,from-distance),stop=Math.min(right,to+distance);
      for(let c=start;c<stop;c++){
        const q=c-left,v=ctx.value(r,c);
        curr[q]=valid(v,text,index)?distance===depth?1n:(q>0?next[q-1]:0n)+(q+1<width?next[q+1]:0n):0n;
        if(m.tick())yield {operations:m.operations,phase:direction===1?'suffix':'prefix',row:r,at:index};
      }
      [next,curr]=[curr,next];
    }
    return {left,values:next};
  }
  function* countWord(ctx,text,m,{maxCounterSlots=262144}={}){
    if(!Number.isSafeInteger(maxCounterSlots)||maxCounterSlots<1)throw Error('Некорректный размер рабочего буфера каталога');
    const width=ctx.x1-ctx.x0,length=text.length,rowCounts=[];let total=0n;
    if(!width||length>ctx.y1-ctx.y0)return {count:'0',rowCounts};
    // Prefer one backward field pass when the suffix frontier is small.
    // The threshold is a memory/performance choice, never a search limit.
    if(width*length<=maxCounterSlots){
      const layers=Array.from({length},()=>Array(width).fill(0n));
      for(let r=ctx.y1-1;r>=ctx.y0;r--){
        let sum=0n;
        for(let at=0;at<length;at++){
          const current=layers[at],next=layers[at+1];
          for(let c=ctx.x0;c<ctx.x1;c++){
            const q=c-ctx.x0;
            current[q]=valid(ctx.value(r,c),text,at)?at===length-1?1n:(q>0?next[q-1]:0n)+(q+1<width?next[q+1]:0n):0n;
            if(at===0)sum+=current[q];
            if(m.tick())yield {operations:m.operations,phase:'count',row:r,at};
          }
        }
        if(sum){total+=sum;rowCounts.push([r,String(sum)]);}
      }
      rowCounts.reverse();
    }else{
      // Very long words use two rows, recomputing each start-row window.
      // This can be slower but never materializes field*length counters.
      for(let r=ctx.y0;r+length<=ctx.y1;r++){
        const counts=yield* countRow(ctx,text,0,length-1,r,1,ctx.x0,ctx.x1,m);let sum=0n;
        for(let c=ctx.x0;c<ctx.x1;c++){sum+=counts.values[c-counts.left];if(m.tick())yield {operations:m.operations,phase:'sum',row:r};}
        if(sum){total+=sum;rowCounts.push([r,String(sum)]);}
      }
    }
    return {count:String(total),rowCounts};
  }
  function* compileSteps({snapshot,sequence,variants,vsets,frame=0,geometry='plain-packed',settings={},search={},...options}={}){
    if(!Number.isSafeInteger(frame)||frame<0)throw Error('Некорректный кадр каталога');
    const ctx=context(snapshot,search),prepared=prepare(sequence,variants??vsets),m=meter(options),words=[];
    for(let index=0;index<prepared.words.length;index++){
      const text=prepared.words[index].text,result=yield* countWord(ctx,text,m,options);
      words.push({text,...result});yield {phase:'word',word:index+1,words:prepared.words.length,operations:m.operations};
    }
    m.check();
    const rows=prepared.rows.map(row=>({...row,count:String(row.variants.reduce((sum,ref)=>sum+decimal(words[ref.word].count),0n))}));
    return {version:1,kind:'packed-all-snake-routes',complete:true,frame,geometry,settings:clone(settings),source:ctx.source,words,rows,operations:m.operations};
  }
  function readCatalog(catalog,snapshot,row){
    if(catalog?.version!==1||catalog.kind!=='packed-all-snake-routes'||catalog.complete!==true||!Number.isSafeInteger(row)||!catalog.rows?.[row]||!Array.isArray(catalog.words))throw Error('Некорректный упакованный каталог');
    const source=catalog.source;
    if(!source||snapshot?.width!==source.width||snapshot?.height!==source.height||snapshot?.stride!==source.stride||snapshot.frame!=null&&snapshot.frame!==catalog.frame)throw Error('Снимок не соответствует кадру каталога');
    return context(snapshot,source);
  }
  const address=(ctx,q)=>({row:Math.floor(q/ctx.W),bit:q%ctx.W,x:q%ctx.W+.5,y:Math.floor(q/ctx.W)+.5,fragment:null});
  function* pageSteps(catalog,{snapshot,row,offset='0',limit=50,...options}={}){
    const ctx=readCatalog(catalog,snapshot,row),m=meter(options),record=catalog.rows[row],total=decimal(record.count);
    if(!Number.isInteger(limit)||limit<1||limit>500)throw Error('Некорректный размер страницы маршрутов');
    let rank=decimal(offset);const items=[],cache=new Map();let startCache=null;
    const capacity=options.memoEntries??4096;
    if(!Number.isSafeInteger(capacity)||capacity<1||capacity>1048576)throw Error('Некорректный кэш страницы маршрутов');
    function* suffix(wordIndex,at,r,c){
      const key=wordIndex+':'+at+':'+r+':'+c;
      if(cache.has(key))return cache.get(key);
      const text=catalog.words[wordIndex].text,counts=yield* countRow(ctx,text,at,text.length-1,r,1,c,c+1,m),count=counts.values[c-counts.left];
      if(cache.size>=capacity)cache.delete(cache.keys().next().value);cache.set(key,count);return count;
    }
    while(rank<total&&items.length<limit){
      m.check();let local=rank,ref=null;
      for(const candidate of record.variants){const count=decimal(catalog.words[candidate.word]?.count);if(local<count){ref=candidate;break;}local-=count;}
      if(!ref)throw Error('Повреждены счётчики вариантов каталога');
      const word=catalog.words[ref.word];let startRow=null;
      for(const [r,countString] of word.rowCounts){const count=decimal(countString);if(local<count){startRow=r;break;}local-=count;}
      if(!Number.isInteger(startRow))throw Error('Повреждены счётчики стартовых строк');
      if(!startCache||startCache.word!==ref.word||startCache.row!==startRow){
        const counts=yield* countRow(ctx,word.text,0,word.text.length-1,startRow,1,ctx.x0,ctx.x1,m);
        startCache={word:ref.word,row:startRow,...counts};
      }
      let c=ctx.x0;
      for(;c<ctx.x1;c++){
        const count=startCache.values[c-startCache.left];if(local<count)break;local-=count;
        if(m.tick())yield {operations:m.operations,phase:'rank',rank:String(rank)};
      }
      if(c===ctx.x1)throw Error('Снимок не совпадает со счётчиками каталога');
      const root=startRow*ctx.W+c,cells=[root];let r=startRow;
      for(let at=1;at<word.text.length;at++){
        let left=0n;if(c>ctx.x0)left=yield* suffix(ref.word,at,r+1,c-1);
        if(local<left)c--;
        else{local-=left;if(c+1>=ctx.x1)throw Error('Повреждён ранг маршрута');const right=yield* suffix(ref.word,at,r+1,c+1);if(local>=right)throw Error('Снимок не совпадает с маршрутом');c++;}
        r++;cells.push(r*ctx.W+c);
      }
      if(local!==0n)throw Error('Повреждён конечный ранг маршрута');
      const p=(root%ctx.W-ctx.anchor-startRow)&1;
      items.push({id:catalog.frame+':'+row+':'+rank,i:row,p,r:startRow,c:root%ctx.W,frame:catalog.frame,rank:String(rank),text:word.text,
        vn:ref.vn??ref.label,variantFlags:clone(ref.flags),flags:clone(ref.flags),variantLabel:ref.label,variantIndex:ref.index,
        dir:'snake',cells,n:cells.length,start:address(ctx,root),end:address(ctx,cells[cells.length-1])});
      rank++;yield {operations:m.operations,phase:'page',items:items.length,rank:String(rank)};
    }
    m.check();return {row,offset,total:String(total),next:rank<total?String(rank):null,items};
  }
  function* unionSteps(catalog,{snapshot,row,bounds,maxCells=1000000,...options}={}){
    const ctx=readCatalog(catalog,snapshot,row),m=meter(options),record=catalog.rows[row];
    if(!bounds)throw Error('Для объединения большого поля нужен видимый прямоугольник');
    const region=rectangle(bounds,ctx.W,ctx.H),from=Math.max(ctx.x0,region.x),to=Math.min(ctx.x1,region.x+region.width),top=Math.max(ctx.y0,region.y),bottom=Math.min(ctx.y1,region.y+region.height);
    if(!Number.isSafeInteger(maxCells)||maxCells<1||Math.max(0,to-from)*Math.max(0,bottom-top)>maxCells)throw Error('Объединение охватывает слишком много клеток. Приблизьте поле или уменьшите прямоугольник.');
    const cells=[];
    // At a cell, every complete path is a unique prefix/suffix pair for
    // exactly one word position. Multiplication counts reconvergence exactly.
    for(let r=top;r<bottom;r++){
      const counts=Array(Math.max(0,to-from)).fill(0n);
      for(const ref of record.variants){
        const word=catalog.words[ref.word];if(word.count==='0')continue;const text=word.text;
        for(let at=0;at<text.length;at++){
          if(r-at<ctx.y0||r+text.length-1-at>=ctx.y1)continue;
          const prefix=yield* countRow(ctx,text,at,0,r,-1,from,to,m),suffix=yield* countRow(ctx,text,at,text.length-1,r,1,from,to,m);
          for(let c=from;c<to;c++){
            counts[c-from]+=prefix.values[c-prefix.left]*suffix.values[c-suffix.left];
            if(m.tick())yield {operations:m.operations,phase:'union',row:r,at};
          }
        }
      }
      for(let c=from;c<to;c++){if(counts[c-from])cells.push({node:r*ctx.W+c,count:String(counts[c-from])});if(m.tick())yield {operations:m.operations,phase:'union-output',row:r};}
      yield {operations:m.operations,phase:'union-row',row:r,done:r-top+1,total:Math.max(0,bottom-top)};
    }
    m.check();return {row,count:record.count,cells,bounds:region,clipped:true,complete:true};
  }
  function drain(iterator,onProgress=()=>{}){let step;do{step=iterator.next();if(!step.done)onProgress(step.value);}while(!step.done);return step.value;}
  const compile=(options,onProgress)=>drain(compileSteps(options),onProgress);
  const page=(catalog,options,onProgress)=>drain(pageSteps(catalog,options),onProgress);
  const union=(catalog,options,onProgress)=>drain(unionSteps(catalog,options),onProgress);
  function workerSource(){
    return 'const api=('+createPackedCatalog.toString()+')();onmessage=e=>{const {id,method="compile",catalog,options}=e.data;try{if(!["compile","page","union"].includes(method))throw Error("Неизвестный запрос каталога");const steps=method==="compile"?api.compileSteps(options):method==="page"?api.pageSteps(catalog,options):api.unionSteps(catalog,options);let last=0;const pump=()=>{try{const step=steps.next();if(step.done)postMessage({id,result:step.value});else{if(Date.now()-last>=100){last=Date.now();postMessage({id,progress:step.value});}setTimeout(pump,0);}}catch(error){postMessage({id,error:error.message});}};pump();}catch(error){postMessage({id,error:error.message});}};';
  }
  function createWorker(){
    const url=URL.createObjectURL(new Blob([workerSource()],{type:'text/javascript'}));
    try{return new Worker(url);}finally{URL.revokeObjectURL(url);}
  }
  async function query(method,catalog,options,{signal,onProgress=()=>{},worker=true,transferSnapshot=false}={}){
    if(!['compile','page','union'].includes(method))throw Error('Неизвестный запрос каталога');
    if(signal?.aborted)throw Error('Запрос отменён');
    if(worker&&typeof Worker!=='undefined')return new Promise((resolve,reject)=>{
      let instance,settled=false;
      const finish=(error,result)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);instance?.terminate();error?reject(error):resolve(result);};
      const abort=()=>finish(Error('Запрос отменён'));
      try{
        instance=createWorker();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
        instance.onerror=event=>finish(Error(event.message||'Ошибка Worker каталога'));
        instance.onmessage=event=>{try{if(event.data.error)finish(Error(event.data.error));else if(event.data.result)finish(null,event.data.result);else onProgress(event.data.progress);}catch(error){finish(error);}};
        const snapshot=options?.snapshot,transfer=transferSnapshot?[...new Set([snapshot?.bits?.buffer,snapshot?.present?.buffer].filter(buffer=>buffer instanceof ArrayBuffer))]:[];
        instance.postMessage({id:'packed-catalog',method,catalog,options},transfer);
      }catch(error){finish(error);}
    });
    const input={...options,cancelled:()=>!!signal?.aborted||options?.cancelled?.()},steps=method==='compile'?compileSteps(input):method==='page'?pageSteps(catalog,input):unionSteps(catalog,input);
    let step;do{step=steps.next();if(!step.done){onProgress(step.value);await new Promise(resolve=>setTimeout(resolve,0));}}while(!step.done);
    return step.value;
  }
  return {compile,compileSteps,page,pageSteps,union,unionSteps,prepare,createWorker,workerSource,query};
});
