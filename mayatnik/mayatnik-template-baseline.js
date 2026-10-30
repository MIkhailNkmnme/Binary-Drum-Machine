/* Runtime originals and a sparse journal of template-owned raster writes.
 * Field source bits, the saved library and unrelated paint are never owned here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateBaseline=api;})(globalThis,function(){
  'use strict';
  function copy(value,seen=new Map()){
    if(value===null||typeof value!=='object')return value;
    if(ArrayBuffer.isView(value))return value.slice();
    if(seen.has(value))return seen.get(value);
    // Canvas and other platform objects are immutable render references, not data snapshots.
    const proto=Object.getPrototypeOf(value);if(!Array.isArray(value)&&proto!==null&&proto?.constructor?.name!=='Object')return value;
    const result=Array.isArray(value)?[]:{};seen.set(value,result);
    for(const [key,child]of Object.entries(value)){
      if(['bitCanvas','commandPaint','edges'].includes(key))continue;
      result[key]=copy(child,seen);
    }
    return result;
  }
  function create(){
    let originals=new Map(),derived=new Set(),rasters=new Map(),history=new WeakMap(),owned=new WeakSet();
    const pixels=key=>{let map=rasters.get(key);if(!map){map=new Map();rasters.set(key,map);}return map;};
    function remember(item,isDerived=false,key=null){
      if(!item?.id)return;
      if(isDerived){derived.add(item.id);return;}
      if(!derived.has(item.id)&&!originals.has(item.id))originals.set(item.id,{item:copy(item),key});
    }
    function originalsFor(items=[],key=null){for(const item of items)remember(item,false,key);return [...originals.values()].filter(record=>key===null||record.key===key).map(record=>copy(record.item));}
    function write(key,q,paintBefore,bitsBefore,paintAfter,bitsAfter,size=q+1){
      if(paintBefore===paintAfter&&bitsBefore===bitsAfter)return;
      const map=pixels(key);map.length=Math.max(map.length||0,size);let cell=map.get(q);
      if(!cell){cell={paint:paintBefore,bits:bitsBefore,lastPaint:paintBefore,lastBits:bitsBefore};map.set(q,cell);}
      // Unrecorded ordinary painting (e.g. an auto tool) takes precedence too.
      if(cell.lastPaint!==paintBefore)cell.paint=paintBefore;
      if(cell.lastBits!==bitsBefore)cell.bits=bitsBefore;
      cell.lastPaint=paintAfter;cell.lastBits=bitsAfter;
    }
    function recordHistory(entry,key,paint,bits,isOwned=false){
      if(isOwned){owned.add(entry);return;}
      const map=rasters.get(key),indices=entry.indices||[],values=new Map();
      if(!map?.size)return;
      for(let i=0;i<indices.length;i++){
        const q=indices[i],cell=map.get(q);if(!cell)continue;const actualPaint=paint?.[q]||0,actualBits=bits?.[q]??-1;
        const record={beforePaint:cell.paint,beforeBits:cell.bits,afterPaint:actualPaint,afterBits:entry.bitsNext?actualBits:cell.bits};values.set(q,record);
        cell.paint=record.afterPaint;cell.bits=record.afterBits;cell.lastPaint=actualPaint;cell.lastBits=actualBits;
      }
      if(values.size)history.set(entry,{key,values});
    }
    function applyHistory(entry,redo,key,paint,bits){
      const map=rasters.get(key);if(!map)return;const clean=history.get(entry);
      for(let i=0;i<(entry.indices?.length||0);i++){const q=entry.indices[i],cell=map.get(q);if(!cell)continue;
        const record=clean?.key===key?clean.values.get(q):null;
        if(record){cell.paint=redo?record.afterPaint:record.beforePaint;cell.bits=redo?record.afterBits:record.beforeBits;}
        else if(!owned.has(entry)){const p=redo?entry.next:entry.previous,b=redo?entry.bitsNext:entry.bitsPrevious;if(p)cell.paint=p[i];if(b)cell.bits=b[i];}
        cell.lastPaint=paint?.[q]||0;cell.lastBits=bits?.[q]??-1;
      }
    }
    function clean(key,paint,bits){
      const map=rasters.get(key);if(!map?.size)return {paint,bits};let nextPaint=paint,nextBits=bits;
      for(const [q,cell]of map){
        const p=paint?.[q]||0,b=bits?.[q]??-1;
        if(p!==cell.lastPaint)cell.paint=p;if(b!==cell.lastBits)cell.bits=b;
        if(p!==cell.paint){if(nextPaint===paint)nextPaint=paint?.slice()||new Uint32Array(bits?.length||map.length);nextPaint[q]=cell.paint;}
        if(b!==cell.bits){if(nextBits===bits)nextBits=bits?.slice()||new Int8Array(paint?.length||map.length).fill(-1);nextBits[q]=cell.bits;}
      }
      return {paint:nextPaint,bits:nextBits};
    }
    function cleanHistory(entry,key){
      if(owned.has(entry)||entry.transientView)return null;
      const stored=history.get(entry),map=rasters.get(key);if(!stored||stored.key!==key||!map?.size)return entry;
      // Keep the user's ordinary edit and its order, replacing only the template-dependent rollback values.
      const result={...entry,previous:entry.previous?.slice(),next:entry.next?.slice(),bitsPrevious:entry.bitsPrevious?.slice(),bitsNext:entry.bitsNext?.slice()};
      for(let i=0;i<(entry.indices?.length||0);i++){const record=stored.values.get(entry.indices[i]);if(!record)continue;
        if(result.previous)result.previous[i]=record.beforePaint;if(result.next)result.next[i]=record.afterPaint;
        if(result.bitsPrevious)result.bitsPrevious[i]=record.beforeBits;if(result.bitsNext)result.bitsNext[i]=record.afterBits;
      }
      return result;
    }
    return {remember,originals:originalsFor,original:id=>originals.has(id)?copy(originals.get(id).item):null,write,recordHistory,applyHistory,clean,cleanHistory,
      get hasOriginals(){return originals.size>0;},get hasEffects(){return [...rasters.values()].some(map=>map.size>0);},
      clearEffects(){rasters.clear();history=new WeakMap();owned=new WeakSet();},
      clear(){originals.clear();derived.clear();rasters.clear();history=new WeakMap();owned=new WeakSet();}
    };
  }
  return {create,copy};
});
