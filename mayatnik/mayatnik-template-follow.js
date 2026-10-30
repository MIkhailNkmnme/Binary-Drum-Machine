/* A saved source and one exact, cancellable search per displayed frame. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikTemplateFollow=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function normalize(value){
    if(value==null)return {on:false,source:null};
    if(typeof value!=='object'||typeof value.on!=='boolean')throw Error('Некорректный режим поиска шаблона');
    const source=value.source;if(source==null){if(value.on)throw Error('Нет образца поиска');return {on:false,source:null};}
    if(source.version!==1||!Array.isArray(source.parts)||!source.parts.length||source.parts.length>2)throw Error('Некорректный образец поиска');
    let cells=0;const parts=source.parts.map(p=>{const n=p.width*p.height;cells+=n;
      if(!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||cells>2097152||typeof p.bits!=='string'||p.bits.length!==Math.ceil(n/4)||!/^[0-9a-f]+$/.test(p.bits)||!/[1-9a-f]/.test(p.bits))throw Error('Повреждён силуэт поиска');
      return {width:p.width,height:p.height,bits:p.bits};});
    return {on:value.on,source:{version:1,parts}};
  }
  function pack(shape,compile){return normalize({on:true,source:{version:1,parts:shape.parts.map(part=>{const p=compile(part,shape.rk||1),data=p.data;let bits='';for(let i=0;i<data.length;i+=4){let b=0;for(let j=0;j<4;j++)if(data[i+j])b|=1<<j;bits+=b.toString(16);}return {width:p.width,height:p.height,bits};})}}).source;}
  function unpack(source){return {rk:1,parts:source.parts.map(p=>({width:p.width,height:p.height,data:Array.from({length:p.width*p.height},(_,i)=>(parseInt(p.bits[i>>2],16)>>(i&3))&1)}))};}
  function create(host,initial){
    let state=normalize(initial),serial=0,pending=null,done=null,failed=null,shape=state.source?unpack(state.source):null;
    const same=(a,b)=>!!a&&!!b&&a.owner===b.owner&&a.key===b.key;
    function restore(value){state=normalize(value);serial++;pending=null;done=null;failed=null;shape=state.source?unpack(state.source):null;host.changed?.(normalize(state));}
    function off(){restore({...state,on:false});host.cancel?.();}
    function enable(source){restore({on:true,source});}
    function ensure(){
      if(!state.on)return Promise.resolve();const scope=host.capture();if(!scope)return Promise.resolve();
      if(pending&&same(pending.scope,scope))return pending.promise;if(same(done,scope)||same(failed,scope))return Promise.resolve();
      const run=++serial,job={scope,promise:null};pending=job;
      const cancelled=()=>run!==serial||!state.on||!same(scope,host.capture());
      job.promise=Promise.resolve().then(()=>host.search(shape,cancelled)).then(result=>{if(!cancelled()||run===serial&&state.on&&same(result?.completedScope,host.capture())){done=host.capture();failed=null;host.result?.(result);}},error=>{if(!cancelled()&&error.name!=='AbortError'){failed=host.capture();host.error?.(error);}}).finally(()=>{if(pending===job)pending=null;});
      return job.promise;
    }
    return {enable,off,restore,ensure,snapshot:()=>normalize(state),get on(){return state.on;},get busy(){return !!pending;},get blocked(){return same(failed,host.capture());},get complete(){return !state.on||same(done,host.capture());},invalidate(){serial++;pending=null;done=null;failed=null;},idle:()=>pending?.promise||Promise.resolve()};
  }
  return {normalize,pack,unpack,create};
});
