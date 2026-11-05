importScripts('xor-space.js?v=017','xor-space-sequence.js?v=017');
self.onmessage=event=>{
 const {source,assignments,options}=event.data;
 try{const result=XorAxesSequence.enumerate(source,assignments,options);self.postMessage(result,[result.codes.buffer]);}
 catch(error){self.postMessage({error:String(error.message||error)});}
};
