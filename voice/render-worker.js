/* Dedicated classic Worker. The UI cancels by terminating this worker. */
'use strict';
importScripts('engine.js?v=1');
self.onmessage=function(event){
  const request=event.data,id=request&&request.id;
  try{
    const result=self.ZerkaliusVoice.render(request);
    self.postMessage({id,type:'result',result},[result.samples.buffer]);
  }catch(error){
    self.postMessage({id,type:'error',error:{message:error instanceof Error?error.message:String(error)}});
  }
};
