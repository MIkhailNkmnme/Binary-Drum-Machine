/* Dedicated classic Worker. The UI cancels by terminating this worker. */
'use strict';
importScripts('engine.js?v=1','robot/engine.js?v=1','robot-live.js?v=1','dsh-engine.js?v=1','engines.js?v=1');
self.onmessage=function(event){
  const request=event.data,id=request&&request.id;
  try{
    // Missing engineId is an old v1 bank recipe, never a silent engine switch.
    const engineId=request?.engineId===undefined?'bank':request.engineId;
    const result=self.VoiceEngines.get(engineId).render(request);
    self.postMessage({id,type:'result',result},[result.samples.buffer]);
  }catch(error){
    self.postMessage({id,type:'error',error:{message:error instanceof Error?error.message:String(error)}});
  }
};
