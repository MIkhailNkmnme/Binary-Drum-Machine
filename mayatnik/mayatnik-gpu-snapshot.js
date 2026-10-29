(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikGpuSnapshot=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // Readback owns its buffer until the caller's exact field/frame is still current.
  // Cancellation cannot abort WebGPU mapping, but always prevents its publication.
  function create(){
    let generation=0,active=null;
    const cancel=()=>{generation++;active=null;};
    function start({read,current,commit,length,onState=()=>{}}){
      const token=++generation,job={token};active=job;
      const valid=()=>active===job&&generation===token&&current();
      const promise=(async()=>{
        try{
          onState('reading');
          const data=await read();
          if(!valid())return {status:'cancelled'};
          if(!(data instanceof Int8Array)||data.length!==length)throw Error('Неполный снимок поля с видеокарты');
          // No await between validation and commit: live state cannot advance here.
          commit(data);
          if(!valid())return {status:'cancelled'};
          onState('ready');
          return {status:'ready'};
        }catch(error){
          if(!valid())return {status:'cancelled'};
          onState('error',error);
          return {status:'error',error};
        }finally{if(active===job)active=null;}
      })();
      job.promise=promise;return promise;
    }
    return {start,cancel,get pending(){return !!active;}};
  }
  return {create};
});
