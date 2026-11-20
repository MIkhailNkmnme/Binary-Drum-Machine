/* Dedicated classic Worker. The UI cancels by terminating this worker. */
'use strict';
importScripts('prosody-dsp.js?v=019','engine.js?v=019','robot/engine.js?v=001','robot-live.js?v=019','dsh-engine.js?v=019','engines.js?v=005');
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
