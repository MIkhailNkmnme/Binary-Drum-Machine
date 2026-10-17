importScripts('mayatnik-work-file.js?v=139');
onmessage=async e=>{try{
  const {op,value}=e.data;if(!['encode','decode'].includes(op))throw Error('Invalid operation');
  const result=await MayatnikWorkFile[op](value),buffers=new Set();
  const collect=v=>{if(ArrayBuffer.isView(v))buffers.add(v.buffer);else if(v&&typeof v==='object'&&!(v instanceof Blob))for(const child of Object.values(v))collect(child);};
  if(op==='decode')collect(result);postMessage({result},[...buffers]);
}catch(error){postMessage({error:String(error.message||error)});}};
