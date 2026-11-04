importScripts('xor-space.js?v=016','xor-space-sequence.js?v=016');
self.onmessage=event=>{
 const {source,assignments,options}=event.data;
 try{const result=XorAxesSequence.enumerate(source,assignments,options);self.postMessage(result,[result.codes.buffer]);}
 catch(error){self.postMessage({error:String(error.message||error)});}
};
