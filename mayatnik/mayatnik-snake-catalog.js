/* Lossless catalog of all downward routes. Counts and ranks cross IO as decimal strings. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikSnakeCatalog=api;})(globalThis,function createCatalog(){
  'use strict';
  const copy=value=>structuredClone(value),decimal=value=>{if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value))throw Error('Некорректный точный ранг');return BigInt(value);};
  function graph(nodes){
    if(!Array.isArray(nodes))throw Error('Нет графа видимых клеток');
    return nodes.map((node,id)=>{
      if(!node||!Number.isFinite(node.x)||!Number.isFinite(node.y)||![0,1,-1].includes(node.bit))throw Error('Некорректная клетка '+id);
      const edges=[...new Set(node.edges||[])];
      for(const q of edges)if(!Number.isSafeInteger(q)||q<0||q>=nodes.length||nodes[q].y<=node.y||nodes[q].x===node.x)throw Error('Некорректное ребро графа');
      edges.sort((a,b)=>nodes[a].x-nodes[b].x||nodes[a].y-nodes[b].y||a-b);
      return {...copy(node),edges};
    });
  }
  function prepare(sequence,variants){
    if(!Array.isArray(sequence)||sequence.some(text=>typeof text!=='string'||!/^[01]+$/.test(text)))throw Error('Некорректная последовательность');
    const words=[],known=new Map(),rows=sequence.map((text,i)=>{
      const refs=[],seen=new Set(),items=variants?.[i]||[[text,'']];
      for(const item of items){const word=Array.isArray(item)?item[0]:item.word??item.text,label=Array.isArray(item)?item[1]:item.label;
        if(typeof word!=='string'||word.length!==text.length||!/^[01]+$/.test(word))throw Error('Некорректный вариант строки');
        if(seen.has(word))continue;seen.add(word);let index=known.get(word);if(index===undefined){index=words.length;known.set(word,index);words.push({text:word});}refs.push({word:index,index:Array.isArray(item)?refs.length:item.index??refs.length,label:label||'',vn:Array.isArray(item)?label||'':item.vn??label??'',flags:Array.isArray(item)?undefined:copy(item.flags)});
      }
      if(!refs.length)throw Error('Нет вариантов строки');return {i,text,variants:refs};
    });return {words,rows};
  }
  // Each suffix level uses N counters. No path enumeration and no saturation.
  function* suffixSteps(nodes,text,{chunkOperations=32768,cancelled=()=>false,keep=false,maxOperations=Infinity}={}){
    let next=Array(nodes.length).fill(0n),operations=0,chunk=0;const levels=keep?Array(text.length):null;
    for(let at=text.length-1;at>=0;at--){const curr=Array(nodes.length).fill(0n),bit=Number(text[at]);
      for(let q=0;q<nodes.length;q++){
        if(cancelled())throw Error('Поиск отменён');if(++operations>maxOperations)throw Error('Достигнут предел поиска; полнота не доказана');
        const node=nodes[q];if(node.bit===bit){if(at===text.length-1)curr[q]=1n;else for(const edge of node.edges)curr[q]+=next[edge];}
        if(++chunk>=chunkOperations){chunk=0;yield {operations,at};}
      }if(keep)levels[at]=curr;next=curr;
    }return {counts:next,levels,operations};
  }
  function* compileSteps({nodes,sequence,variants,frame=0,geometry='',settings={},chunkOperations=32768,maxOperations=Infinity,cancelled=()=>false}){
    nodes=graph(nodes);const prepared=prepare(sequence,variants),words=[];let operations=0;
    for(let index=0;index<prepared.words.length;index++){
      const text=prepared.words[index].text,result=yield* suffixSteps(nodes,text,{chunkOperations,maxOperations:maxOperations-operations,cancelled});operations+=result.operations;
      const starts=[];let count=0n;for(let q=0;q<nodes.length;q++)if(result.counts[q]){starts.push({node:q,count:String(result.counts[q])});count+=result.counts[q];}
      words.push({text,count:String(count),starts});yield {word:index+1,words:prepared.words.length,operations};
    }
    const rows=prepared.rows.map(row=>({...row,count:String(row.variants.reduce((sum,ref)=>sum+BigInt(words[ref.word].count),0n))}));
    return {version:1,kind:'all-snake-routes',complete:true,frame,geometry,settings:copy(settings),nodes,words,rows,operations};
  }
  function drain(steps){let step;do{step=steps.next();}while(!step.done);return step.value;}
  const compile=options=>drain(compileSteps(options));
  const address=node=>({row:Number.isInteger(node.row)?node.row:null,bit:Number.isInteger(node.col)?node.col:Number.isInteger(node.c)?node.c:null,x:node.x,y:node.y,fragment:node.fragment??null});
  function* pageSteps(catalog,{row,offset='0',limit=50,chunkOperations=32768,cancelled=()=>false}={}){
    if(catalog?.version!==1||catalog.complete!==true||!Number.isSafeInteger(row)||!catalog.rows[row]||!Number.isInteger(limit)||limit<1||limit>500)throw Error('Некорректная страница маршрутов');
    const record=catalog.rows[row],first=decimal(offset),total=decimal(record.count);let rank=first;const items=[],cache=new Map();
    while(rank<total&&items.length<limit){let local=rank,ref;
      for(const candidate of record.variants){const count=decimal(catalog.words[candidate.word].count);if(local<count){ref=candidate;break;}local-=count;}
      const word=catalog.words[ref.word];let root;
      for(const start of word.starts){const count=decimal(start.count);if(local<count){root=start.node;break;}local-=count;}
      if(!cache.has(ref.word))cache.set(ref.word,(yield* suffixSteps(catalog.nodes,word.text,{keep:true,chunkOperations,cancelled})).levels);
      const levels=cache.get(ref.word),cells=[root];let q=root;
      for(let at=1;at<word.text.length;at++){let chosen;for(const next of catalog.nodes[q].edges){const count=levels[at][next];if(local<count){chosen=next;break;}local-=count;}if(chosen===undefined)throw Error('Повреждён каталог маршрутов');cells.push(chosen);q=chosen;}
      items.push({id:catalog.frame+':'+row+':'+rank,i:row,frame:catalog.frame,rank:String(rank),text:word.text,vn:ref.vn??ref.label,variantFlags:copy(ref.flags),flags:copy(ref.flags),variantLabel:ref.label,variantIndex:ref.index,dir:'snake',cells,n:cells.length,start:address(catalog.nodes[root]),end:address(catalog.nodes[q])});rank++;
    }
    return {row,offset,total:String(total),next:rank<total?String(rank):null,items};
  }
  // Number of complete routes through each node, including overlaps/reconvergence.
  function* unionSteps(catalog,{row,chunkOperations=32768,cancelled=()=>false}={}){
    const record=catalog.rows[row];if(!record)throw Error('Нет строки каталога');const totals=Array(catalog.nodes.length).fill(0n);let ops=0;
    for(const ref of record.variants){const word=catalog.words[ref.word];if(word.count==='0')continue;const {levels}=yield* suffixSteps(catalog.nodes,word.text,{keep:true,chunkOperations,cancelled});let reach=Array(catalog.nodes.length).fill(0n);for(const start of word.starts)reach[start.node]=1n;
      for(let at=0;at<word.text.length;at++){const next=Array(catalog.nodes.length).fill(0n);for(let q=0;q<reach.length;q++){if(cancelled())throw Error('Поиск отменён');if(reach[q]&&levels[at][q]){totals[q]+=reach[q]*levels[at][q];if(at+1<word.text.length)for(const edge of catalog.nodes[q].edges)if(levels[at+1][edge])next[edge]+=reach[q];}if(++ops%chunkOperations===0)yield {operations:ops};}reach=next;}
    }return {row,count:record.count,cells:totals.flatMap((count,node)=>count?[{node,count:String(count)}]:[])};
  }
  function workerSource(){return 'const api=('+createCatalog.toString()+')();onmessage=e=>{const {id,method="compile",options,catalog}=e.data;try{const steps=method==="page"?api.pageSteps(catalog,options):method==="union"?api.unionSteps(catalog,options):api.compileSteps(options);let last=0;const pump=()=>{try{const step=steps.next();if(step.done)postMessage({id,result:step.value});else{if(Date.now()-last>=100){last=Date.now();postMessage({id,progress:step.value});}setTimeout(pump,0);}}catch(error){postMessage({id,error:error.message});}};pump();}catch(error){postMessage({id,error:error.message});}};';}
  function createWorker(){const url=URL.createObjectURL(new Blob([workerSource()],{type:'text/javascript'}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}
  async function query(method,catalog,options,{signal,onProgress=()=>{},worker=true}={}){
    if(!['page','union'].includes(method))throw Error('Неизвестный запрос каталога');if(signal?.aborted)throw Error('Запрос отменён');
    if(worker&&typeof Worker!=='undefined')return new Promise((resolve,reject)=>{const instance=createWorker(),finish=(error,result)=>{signal?.removeEventListener('abort',abort);instance.terminate();error?reject(error):resolve(result);},abort=()=>finish(Error('Запрос отменён'));signal?.addEventListener('abort',abort,{once:true});instance.onerror=event=>finish(Error(event.message||'Ошибка Worker'));instance.onmessage=event=>{if(event.data.error)finish(Error(event.data.error));else if(event.data.result)finish(null,event.data.result);else onProgress(event.data.progress);};instance.postMessage({id:'query',method,catalog,options});});
    const steps=(method==='page'?pageSteps:unionSteps)(catalog,{...options,cancelled:()=>!!signal?.aborted});let step;do{step=steps.next();if(!step.done){onProgress(step.value);await new Promise(r=>setTimeout(r,0));}}while(!step.done);return step.value;
  }
  return {compile,compileSteps,page:(catalog,options)=>drain(pageSteps(catalog,options)),pageSteps,union:(catalog,options)=>drain(unionSteps(catalog,options)),unionSteps,prepare,createWorker,workerSource,query};
});
