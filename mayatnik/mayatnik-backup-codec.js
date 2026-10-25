/* Portable Mayatnik browser backup. Blobs remain binary; work arrays use MYTW. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./mayatnik-work-file.js'),require('node:crypto').webcrypto);
  else root.MayatnikBackupCodec=factory({encode:v=>root.MayatnikWorkFile.run('encode',v),decode:v=>root.MayatnikWorkFile.run('decode',v)},root.crypto);
})(typeof globalThis==='object'?globalThis:this,function(work,crypto){
  'use strict';
  const MAGIC='MYTB0001',LIMIT=1024*1024*1024,HEADER_LIMIT=16*1024*1024,COUNT_LIMIT=100000;
  const text=new TextEncoder(),reader=new TextDecoder('utf-8',{fatal:true});
  const exact=new Set(['zerk_mayatnik','zerk_mayatnik_session','zerk_mayatnik_layers','zerkalius_mayatnik_template_locks_v1','grozd:mayatnik','zerk_mayatnik_solarius']);
  const isLocalKey=key=>typeof key==='string'&&(key.startsWith('mayatnik-')||exact.has(key));
  function validateLocal(local){
    if(!Array.isArray(local)||local.length>COUNT_LIMIT)throw Error('Повреждены настройки архива');
    const seen=new Set();let bytes=0;
    return local.map(item=>{if(!item||!isLocalKey(item.key)||typeof item.value!=='string'||seen.has(item.key))throw Error('Недопустимый ключ настроек архива');seen.add(item.key);bytes+=text.encode(item.key).length+text.encode(item.value).length;if(bytes>HEADER_LIMIT)throw Error('Слишком большие настройки архива');return {key:item.key,value:item.value};});
  }
  function validateKey(key,seen){if(typeof key!=='string'||!key||key.length>4096||seen.has(key))throw Error('Повреждены ключи хранилища архива');seen.add(key);}
  async function hash(bytes){return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));}
  const hex=bytes=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
  async function encode(snapshot){
    if(!snapshot||!Array.isArray(snapshot.entries)||snapshot.entries.length>COUNT_LIMIT)throw Error('Повреждено хранилище архива');
    const local=validateLocal(snapshot.local),{entries:unused,local:unusedLocal,...metadata}=snapshot;
    const chunks=[],entries=[],seen=new Set();let total=44;
    for(const item of snapshot.entries){
      if(!item)throw Error('Повреждена запись архива');validateKey(item.key,seen);
      const blob=item.value instanceof Blob,chunk=blob?item.value:await work.encode(item.value);
      total+=chunk.size;if(total>LIMIT)throw Error('Архив превышает 1 ГиБ');
      const bytes=await chunk.arrayBuffer();entries.push({key:item.key,kind:blob?'blob':'work',mime:blob?item.value.type:'',size:chunk.size,checksum:hex(await hash(bytes))});chunks.push(chunk);
    }
    const manifest=text.encode(JSON.stringify({format:'mayatnik-backup',version:1,metadata,local,entries}));
    if(manifest.length>HEADER_LIMIT||total+manifest.length>LIMIT)throw Error('Архив слишком большой');
    const prefix=new Uint8Array(44);prefix.set(text.encode(MAGIC));new DataView(prefix.buffer).setUint32(8,manifest.length,true);prefix.set(await hash(manifest),12);
    return new Blob([prefix,manifest,...chunks],{type:'application/x-mayatnik-backup'});
  }
  async function decode(file){
    if(!(file instanceof Blob)||file.size<44||file.size>LIMIT)throw Error('Недопустимый размер архива');
    const prefix=new Uint8Array(await file.slice(0,44).arrayBuffer());if(reader.decode(prefix.subarray(0,8))!==MAGIC)throw Error('Это не архив Маятника');
    const length=new DataView(prefix.buffer).getUint32(8,true);if(length>HEADER_LIMIT||length>file.size-44)throw Error('Повреждён заголовок архива');
    const header=new Uint8Array(await file.slice(44,44+length).arrayBuffer());if(hex(await hash(header))!==hex(prefix.subarray(12)))throw Error('Повреждён заголовок архива: контрольная сумма');
    const manifest=JSON.parse(reader.decode(header));
    if(manifest.format!=='mayatnik-backup'||manifest.version!==1||!Array.isArray(manifest.entries)||manifest.entries.length>COUNT_LIMIT||!manifest.metadata||typeof manifest.metadata!=='object'||Array.isArray(manifest.metadata))throw Error('Неизвестный формат архива');
    const local=validateLocal(manifest.local),seen=new Set();let offset=44+length;
    // Validate every boundary before decoding any potentially expensive work payload.
    for(const item of manifest.entries){if(!item)throw Error('Повреждена запись архива');validateKey(item.key,seen);if(!['blob','work'].includes(item.kind)||typeof item.mime!=='string'||item.mime.length>1024||!Number.isSafeInteger(item.size)||item.size<0||!(/^[0-9a-f]{64}$/.test(item.checksum))||item.size>file.size-offset)throw Error('Повреждена запись архива');offset+=item.size;}
    if(offset!==file.size)throw Error('Лишние данные в архиве');
    const chunks=[];offset=44+length;
    for(const item of manifest.entries){const chunk=file.slice(offset,offset+item.size,item.mime);offset+=item.size;if(hex(await hash(await chunk.arrayBuffer()))!==item.checksum)throw Error('Повреждена запись архива: контрольная сумма');chunks.push(chunk);}
    const entries=[];
    for(let i=0;i<manifest.entries.length;i++){const item=manifest.entries[i];let value=chunks[i];if(item.kind==='work'){const parsed=await work.decode(value);if(parsed?.format!=='mayatnik-work'||parsed.version!==2)throw Error('Повреждены данные работы в архиве');value=parsed.data;}entries.push({key:item.key,value});}
    return {format:'mayatnik-backup',version:1,snapshot:{...manifest.metadata,entries,local}};
  }
  return {encode,decode,validateLocal,isLocalKey,LIMIT};
});
