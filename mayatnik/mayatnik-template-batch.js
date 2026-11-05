/* Exact library silhouettes on every frame. Results are disposable overlays. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateBatch=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const MAX_ENTRIES=256,MAX_SHAPE_CELLS=2097152;
  function normalize(value){
    if(value==null)return {on:false,entryIds:[]};
    if(typeof value!=='object'||typeof value.on!=='boolean'||!Array.isArray(value.entryIds)||value.entryIds.length>MAX_ENTRIES||value.entryIds.some(id=>typeof id!=='string'||!id||id.length>512))throw Error('Некорректный набор поиска шаблонов');
    const entryIds=[...new Set(value.entryIds)];
    if(value.on&&!entryIds.length)throw Error('Выберите шаблоны для поиска');
    return {on:value.on,entryIds};
  }
  function create(host,initial){
    const matcher=host.matcher||root.MayatnikTemplateMatcher;
    if(!matcher?.compile||!matcher?.find)throw Error('Поиск шаблонов недоступен');
    let state=normalize(initial),serial=0,pending=null,done=null,failed=null,selection=null,drain=Promise.resolve();
    const cache=new WeakMap(),same=(a,b)=>!!a&&!!b&&a.owner===b.owner&&a.key===b.key;
    const pause=host.yieldTask||(()=>new Promise(resolve=>setTimeout(resolve,0)));
    const abort=()=>matcher.abort?matcher.abort():Object.assign(Error('Поиск отменён'),{name:'AbortError'});
    const maxMatches=Number.isSafeInteger(host.maxMatches)&&host.maxMatches>0?host.maxMatches:250000;
    function clear(){selection=null;host.result?.(null);}
    function invalidate(){serial++;pending=null;done=null;failed=null;clear();}
    function restore(value){const next=normalize(value);state=next;invalidate();host.changed?.(normalize(state));}
    function enable(ids){restore({on:true,entryIds:ids==null?host.entries().map(e=>e.id):ids});}
    function off(){restore({...state,on:false});}
    function patternsFor(entry){
      const shape=entry.shape;if(!shape||!Array.isArray(shape.parts)||!shape.parts.length||shape.parts.length>2)throw Error('Повреждён шаблон: '+entry.name);
      let patterns=cache.get(shape);if(patterns)return patterns;
      let cells=0;const rk=shape.rk==null?1:shape.rk;
      if(!Number.isFinite(rk)||rk<1||rk>8)throw Error('Некорректный масштаб шаблона: '+entry.name);
      for(const part of shape.parts){cells+=part.width*part.height;if(!Number.isSafeInteger(part.width)||!Number.isSafeInteger(part.height)||part.width<1||part.height<1||cells>MAX_SHAPE_CELLS||!part.data||part.data.length!==part.width*part.height)throw Error('Повреждён силуэт: '+entry.name);}
      patterns=[];
      // Preserve the original engine's part/reflection precedence and side boundaries.
      for(const mirrorX of [false,true])for(const part of shape.parts){
        const pattern=matcher.compile(part,rk,{silhouette:true,mirrorX});
        if(!patterns.some(p=>p.width===pattern.width&&p.height===pattern.height&&p.data.every((v,i)=>v===pattern.data[i])))patterns.push(pattern);
      }
      cache.set(shape,patterns);return patterns;
    }
    async function search(scope,ids,cancelled){
      const check=()=>{if(cancelled())throw abort();};check();
      const library=host.entries(),byId=new Map();
      for(const entry of library){if(byId.has(entry.id))throw Error('Повторяется идентификатор шаблона: '+entry.id);byId.set(entry.id,entry);}
      const entries=ids.map(id=>{const entry=byId.get(id);if(!entry)throw Error('Шаблон больше не найден: '+id);return {id,name:entry.name,patterns:patternsFor(entry)};});
      const field=await host.field();check();
      const valid=()=>!cancelled()&&host.current(field);
      const checkField=()=>{if(!valid())throw abort();};checkField();
      const W=field.width,H=field.height,N=W*H;
      if(!Number.isSafeInteger(W)||!Number.isSafeInteger(H)||W<1||H<1||!Number.isSafeInteger(N)||!field.data||field.data.length!==N)throw Error('Размер поля не совпадает');
      const result={scope,field,width:W,height:H,selected:new Uint8Array(N),selectedCount:0,count:0,entries:[],matches:[],instances:[]};
      const rows=Math.max(1,Math.min(32,Math.floor(262144/W)));
      for(const entry of entries){
        checkField();const own={id:entry.id,name:entry.name,count:0,matches:[]};result.entries.push(own);
        const patterns=entry.patterns.filter(p=>p.width<=W&&p.height<=H);
        if(!patterns.length)continue;
        const maxHeight=Math.max(...patterns.map(p=>p.height));
        for(let start=0;start<H;start+=rows){
          checkField();const end=Math.min(H,start+rows),top=Math.max(0,start-1),bottom=Math.min(H,end+maxHeight);
          // One context row above and a full pattern below keep chunk edges
          // from becoming artificial silhouette boundaries. Accept each origin once.
          const strip={width:W,height:bottom-top,data:field.data.subarray(top*W,bottom*W)};
          const found=await matcher.find(strip,patterns,{collectMatches:true,cancelled:()=>!valid(),yieldTask:pause,budgetMs:8});checkField();
          let copied=0;
          for(const match of found.matches){
            const y=match.y+top;if(y<start||y>=end)continue;
            if(result.count>=maxMatches)throw Error('Слишком много совпадений для точного поиска: '+maxMatches+'; уменьшите поле или набор шаблонов');
            const p=patterns[match.patternIndex],item={...match,y,entryId:entry.id,entryName:entry.name,patternIndex:entry.patterns.indexOf(p),mirrorX:!!p.mirrorX};
            own.matches.push(item);result.matches.push(item);own.count++;result.count++;
            for(const q of p.filled){const at=(y+Math.floor(q/p.width))*W+match.x+q%p.width;if(!result.selected[at]){result.selected[at]=1;result.selectedCount++;}
              if(++copied%131072===0){await pause();checkField();}}
          }
          await pause();checkField();
        }
      }
      checkField();return result;
    }
    function ensure(){
      if(!state.on)return Promise.resolve();const captured=host.capture();if(!captured)return Promise.resolve();
      const scope={owner:captured.owner,key:captured.key};
      if(pending&&same(pending.scope,scope))return pending.promise;
      if(same(done,scope)||same(failed,scope))return Promise.resolve();
      const run=++serial,ids=state.entryIds.slice(),job={scope,promise:null};pending=job;clear();
      const cancelled=()=>run!==serial||!state.on||!same(scope,host.capture());
      // New scopes cancel old work, but never start a second full-field search
      // until the cancelled work has released its temporary buffers.
      job.promise=drain.then(()=>search(scope,ids,cancelled)).then(result=>{
        if(cancelled()||!host.current(result.field))return;selection=result;done=scope;failed=null;host.result?.(result);
      }).catch(error=>{if(!cancelled()){failed=scope;done=null;selection=null;host.error?.(error);}}).finally(()=>{if(pending===job)pending=null;});
      drain=job.promise;return job.promise;
    }
    return {enable,off,restore,invalidate,ensure,idle:()=>drain,snapshot:()=>normalize(state),
      getSelection:()=>selection&&same(selection.scope,host.capture())&&host.current(selection.field)?selection:null,
      get on(){return state.on;},get busy(){return !!pending;},get complete(){return !state.on||same(done,host.capture());},get blocked(){return state.on&&same(failed,host.capture());}};
  }
  return {normalize,create};
});
