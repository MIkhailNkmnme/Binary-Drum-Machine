/* Complete work files: typed binary chunks + JSON metadata, gzip compression.
   Ternary fields use two bits/cell. Legacy colouring JSON remains readable. */
(function(root){
  'use strict';
  const MAGIC='MYTW0002',LIMIT=512*1024*1024,types={u32:Uint32Array,u8:Uint8Array,c8:Uint8ClampedArray,f32:Float32Array,i32:Int32Array};
  function pack(a){const out=new Uint8Array(Math.ceil(a.length/4));for(let i=0;i<a.length;i++){
    if(a[i]<-1||a[i]>1)throw Error('Invalid field value');out[i>>2]|=(a[i]+1)<<((i&3)*2);
  }return out;}
  function unpack(bytes,length){if(bytes.length!==Math.ceil(length/4))throw Error('Invalid field length');const out=new Int8Array(length);
    for(let i=0;i<length;i++){const v=(bytes[i>>2]>>((i&3)*2))&3;if(v===3)throw Error('Invalid field code');out[i]=v-1;}return out;}
  async function encode(data){
    const chunks=[],desc=[];let total=0;
    const json=JSON.stringify({format:'mayatnik-work',version:2,data},(_,v)=>{
      if(!ArrayBuffer.isView(v))return v;
      const type=v instanceof Int8Array?'t2':Object.keys(types).find(k=>v instanceof types[k]);if(!type)throw Error('Unsupported array');
      const bytes=type==='t2'?pack(v):new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
      const id=chunks.length;desc.push({type,length:v.length,size:bytes.length});chunks.push(bytes);total+=bytes.length;
      if(total>LIMIT)throw Error('Work is too large');return {$mayArray:id};
    });
    const header=new TextEncoder().encode(JSON.stringify({json,arrays:desc})),prefix=new Uint8Array(12);
    prefix.set(new TextEncoder().encode(MAGIC));new DataView(prefix.buffer).setUint32(8,header.length,true);
    const raw=new Blob([prefix,header,...chunks]);if(raw.size>LIMIT)throw Error('Work is too large');
    return typeof CompressionStream==='function'?new Response(raw.stream().pipeThrough(new CompressionStream('gzip'))).blob():raw;
  }
  async function bounded(stream){const reader=stream.getReader(),parts=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT)throw Error('File expands beyond size limit');parts.push(value);}}finally{await reader.cancel();}
    const out=new Uint8Array(size);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length;}return out;}
  async function decode(file){
    if(file.size>LIMIT)throw Error('File too large');const first=new Uint8Array(await file.slice(0,12).arrayBuffer());
    let bytes;
    if(first[0]===31&&first[1]===139){if(typeof DecompressionStream!=='function')throw Error('Gzip is not available');bytes=await bounded(file.stream().pipeThrough(new DecompressionStream('gzip')));}
    else if(new TextDecoder().decode(first.slice(0,8))===MAGIC)bytes=new Uint8Array(await file.arrayBuffer());
    else return JSON.parse(await file.text(),(_,v)=>{
      if(!v||!['i8','u32'].includes(v.array))return v;
      if(!Array.isArray(v.data)||v.data.length>100e6||v.data.some(n=>!Number.isInteger(n)||n<(v.array==='i8'?-1:0)||n>(v.array==='i8'?1:0xffffffff)))throw Error('Invalid legacy array');
      return v.array==='i8'?Int8Array.from(v.data):Uint32Array.from(v.data);
    });
    if(bytes.length<12||new TextDecoder().decode(bytes.slice(0,8))!==MAGIC)throw Error('Invalid work file');
    const len=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true);if(len>bytes.length-12)throw Error('Truncated header');
    const header=JSON.parse(new TextDecoder().decode(bytes.subarray(12,12+len)));if(!Array.isArray(header.arrays)||typeof header.json!=='string')throw Error('Invalid header');
    let pos=12+len,total=0;
    const arrays=header.arrays.map(d=>{
      if(!Number.isSafeInteger(d.length)||d.length<0||d.length>100e6||!Number.isSafeInteger(d.size)||d.size<0||pos+d.size>bytes.length)throw Error('Invalid chunk');
      const Type=types[d.type],size=d.type==='t2'?Math.ceil(d.length/4):Type?d.length*Type.BYTES_PER_ELEMENT:-1;
      if(size!==d.size)throw Error('Invalid array size');total+=d.type==='t2'?d.length:size;if(total>LIMIT)throw Error('Decoded work too large');
      const chunk=bytes.slice(pos,pos+d.size);pos+=d.size;return d.type==='t2'?unpack(chunk,d.length):new Type(chunk.buffer);
    });
    if(pos!==bytes.length)throw Error('Trailing data');
    return JSON.parse(header.json,(_,v)=>{
      if(v&&Object.hasOwn(v,'$mayArray')){if(!Number.isInteger(v.$mayArray)||v.$mayArray<0||v.$mayArray>=arrays.length)throw Error('Invalid array reference');return arrays[v.$mayArray];}return v;
    });
  }
  const api={pack,unpack,encode,decode};
  api.run=(op,value)=>new Promise((resolve,reject)=>{
    if(typeof Worker!=='function'){api[op](value).then(resolve,reject);return;}
    const worker=new Worker(new URL('mayatnik-file-worker.js?v=139',document.currentScript?.src||location.href));
    worker.onmessage=e=>{worker.terminate();e.data.error?reject(Error(e.data.error)):resolve(e.data.result);};
    worker.onerror=e=>{worker.terminate();reject(Error(e.message));};worker.postMessage({op,value});
  });
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MayatnikWorkFile=api;
})(typeof globalThis==='object'?globalThis:this);
