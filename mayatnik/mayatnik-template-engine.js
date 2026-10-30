(function(root){
  'use strict';
  function create(host){
    const listeners=new Set(),patternCache=new WeakMap(),results=[];
    let serial=0,selection=null,libraryStamp=[],scopeKey=null,filterSerial=0,filterPending=Promise.resolve(),visibleIds=host.scope?new Set():null,state={selectedId:null,count:0,busy:false,message:'',filtering:false};
    function emit(){for(const fn of listeners)fn({...state});}
    function patternsFor(entry,mirrorX=false){
      let cache=patternCache.get(entry.shape);if(!cache){cache={};patternCache.set(entry.shape,cache);}
      const key=mirrorX?'mirrored':'direct';if(cache[key])return cache[key];const patterns=[];
      for(const part of entry.shape.parts)for(const reflected of mirrorX?[false,true]:[false]){
        const p=root.MayatnikTemplateMatcher.compile(part,entry.shape.rk||1,{silhouette:true,mirrorX:reflected});
        if(!patterns.some(q=>q.width===p.width&&q.height===p.height&&q.data.every((v,i)=>v===p.data[i])))patterns.push(p);
      }
      return cache[key]=patterns;
    }
    async function filter(items,run){
      // Placed figures are already known to exist; show them before a full-field scan.
      visibleIds=new Set(items.filter(entry=>(host.listedInstances||host.visibleInstances)?.(entry.id)).map(entry=>entry.id));state.filtering=true;emit();
      const missing=items.filter(entry=>!visibleIds.has(entry.id)&&host.selectionAllowed?.(entry)!==false);
      // Oversize saved shapes remain listed; defer their expensive matching until the limit permits it.
      for(const entry of items)if(host.selectionAllowed?.(entry)===false)visibleIds.add(entry.id);
      try{if(!missing.length)return;const field=await host.field();if(run!==filterSerial)return;
        for(const entry of missing){if(run!==filterSerial)return;if(!host.current(field)){scopeKey=null;return;}
          const exists=(host.listedInstances||host.visibleInstances)?.(entry.id)||((await root.MayatnikTemplateMatcher.find(field,patternsFor(entry),{existsOnly:true,cancelled:()=>run!==filterSerial||!host.current(field)})).count>0);
          if(exists){visibleIds.add(entry.id);emit();}
        }
      }catch(e){if(run===filterSerial){if(e.name==='AbortError')scopeKey=null;else state.message=e.message;}}
      finally{if(run===filterSerial){state.filtering=false;emit();}}
    }
    function refresh(){const items=host.entries(),key=host.scope?.(),active=host.filterActive?.()!==false;
      const changed=items.length!==libraryStamp.length||!items.every((t,i)=>{const p=libraryStamp[i];return t.id===p.id&&t.name===p.name&&t.shape===p.shape;});
      if(changed)libraryStamp=items.map(t=>({id:t.id,name:t.name,shape:t.shape}));
      if(host.scope){if(!active){if(state.filtering){filterSerial++;state.filtering=false;scopeKey=null;}if(changed)scopeKey=null;return;}if(changed||scopeKey!==key){scopeKey=key;filterPending=filter(items.slice(),++filterSerial);}return;}
      if(changed)emit();
    }
    function clear(message=''){serial++;selection=null;state={...state,count:0,busy:false,message};host.redrawSelection();emit();}
    async function select(id){
      const entry=host.entries().find(t=>t.id===id);if(!entry)return state;
      return selectEntry(entry);
    }
    async function selectEntry(entry,temporary=false,options={}){
      const id=temporary?null:entry.id;
      if(host.selectionAllowed?.(entry)===false){state={...state,message:host.selectionMessage?.()||'Template area limit'};emit();if(options.follow)throw Error(state.message);return {...state};}
      const run=++serial;selection=null;state={...state,selectedId:id,count:0,busy:true,message:'Поиск в текущих строках…'};emit();
      if(!temporary)host.choose(id);if(!options.follow)host.stop();host.redrawSelection();
      try{
        if(options.materialize&&typeof host.materializeMatches!=='function')throw Error('Создание шаблонов из найденных фигур недоступно');
        const field=await host.field(true,options);if(run!==serial){if(options.follow)throw root.MayatnikTemplateMatcher.abort();return state;}
        const patterns=patternsFor(entry,!!options.mirrorX),cancelled=()=>run!==serial||!!options.cancelled?.()||!host.current(field,options);
        if(cancelled())throw root.MayatnikTemplateMatcher.abort();
        let found=results.find(r=>r.field===field&&r.patterns===patterns&&(!options.materialize||r.found.matches))?.found;
        if(!found){found=await root.MayatnikTemplateMatcher.find(field,patterns,{collectMatches:!!options.materialize,cancelled});results.push({field,patterns,found});while(results.length>3)results.shift();}
        if(run!==serial){if(options.follow)throw root.MayatnikTemplateMatcher.abort();return state;}
        const instances=temporary?(host.shapeInstances?.(entry.shape,{mirrorX:!!options.mirrorX})||[]):host.instances(id);
        if(options.materialize){
          if(cancelled())throw root.MayatnikTemplateMatcher.abort();
          // The host stages source-preserving copies, validates its raster projection,
          // then commits them and their common undo entry in one synchronous step.
          const result=await host.materializeMatches({shape:entry.shape,field,patterns,matches:found.matches,instances},cancelled);
          if(run!==serial){if(options.follow)throw root.MayatnikTemplateMatcher.abort();return state;}
          if(!result||!Array.isArray(result.instances))throw Error('Не удалось выделить найденные шаблоны');
          const ids=[...new Set(result.instances)];selection=null;
          state={...state,selectedId:id,count:ids.length,busy:false,message:ids.length?`Найдено в текущих строках: ${ids.length} шаблонов`:'В текущих строках этого шаблона нет'};
          host.redrawSelection();emit();
          if(ids.length&&!options.follow)host.focus?.({id,instances:ids,first:found.first||null,field});
          return {...state,completedScope:result.completedScope};
        }
        selection={...found,instances,field};state={...state,selectedId:id,count:found.count+instances.length,busy:false,message:`Найдено: ${found.count} · отдельных копий: ${instances.length}`};
        if(!state.count){selection=null;state.message='В текущих строках этого шаблона нет';}
        host.redrawSelection();emit();
        if(selection&&!options.follow)host.focus?.({id,instances:[...instances],first:found.first||null,field});
      }catch(e){if(run!==serial){if(options.follow)throw root.MayatnikTemplateMatcher.abort();return state;}selection=null;state={...state,busy:false,count:0,message:e.name==='AbortError'?'Поле изменилось — выберите шаблон снова':e.message};host.redrawSelection();emit();if(options.follow)throw e;}
      return {...state};
    }
    async function edit(kind,value){
      if(state.busy||!selection)return false;
      if(!host.current(selection.field)){clear('Поле изменилось — выберите шаблон снова');return false;}
      if(kind==='colour'&&!/^#[0-9a-f]{6}$/i.test(value))return false;
      state.busy=true;emit();const run=++serial;
      try{await host.edit(selection,kind,value,()=>run!==serial);if(run!==serial)return false;
        if(kind==='delete'){selection=null;state.count=0;}else selection.field=await host.field(false);
        state.message=kind==='delete'?'Выделенные фигуры удалены с поля':'Цвет всех выделенных фигур изменён';
        host.redrawSelection();return true;
      }catch(e){state.message=e.message;return false;}finally{if(run===serial){state.busy=false;emit();}}
    }
    return {
      list:()=>host.entries().filter(t=>!visibleIds||visibleIds.has(t.id)).map(t=>({id:t.id,name:t.name,hex:t.shape.hex,parts:t.shape.parts,previewKey:t.shape,builtin:String(t.id).startsWith('standard:')})),allIds:()=>host.entries().map(t=>t.id),whenFiltered:()=>filterPending,
      exportList:()=>host.entries().map(({id,name})=>({id,name})),
      exportItem(id){const entry=host.entries().find(t=>t.id===id);if(!entry)throw Error('Шаблон не найден');const item=structuredClone(entry);return {id:item.id,name:item.name,files:[{extension:'.template.json',blob:new Blob([JSON.stringify({format:'mayatnik-templates',version:1,templates:[item]})],{type:'application/json'})}]};},
      select,selectShape:(shape,options)=>selectEntry({shape},true,options),colour:hex=>edit('colour',hex),removeMatches:()=>edit('delete'),
      async action(id,action,value){const result=await host.action(id,action,value);if(action==='visible'||action==='skip-selection'){clear();if(action==='visible'){scopeKey=null;refresh();}emit();}return result;},
      visibility:id=>host.visibility?.(id)||{placed:0,visible:false,skipSelection:false},getControls:()=>null,
      getState:()=>({...state}),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      recordExternal:(before,after,apply)=>host.recordExternal(before,after,apply),
      getSelection:()=>selection,clear,refresh,
      savedMessage(id,message){if(state.selectedId===id&&!state.busy){state.message=message;emit();}},
      saved(id,message){serial++;selection=null;state={...state,selectedId:id,count:0,busy:false,message};host.redrawSelection?.();scopeKey=null;refresh();emit();},
      changed(){if(selection&&!host.current(selection.field))clear('Поле изменилось — выберите шаблон снова');else emit();}
    };
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateEngine=api;
})(typeof window==='object'?window:globalThis);
