/* Codex — независимый исследователь Хоррориуса · 12.10.2026.
   Test actual worker import/export against a real downloaded browser archive.
   No UI state injection; the worker source runs in a Node sandbox. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),messages=[],context={Blob,crypto:crypto.webcrypto,btoa,atob,console};context.self=context;
vm.createContext(context);context.importScripts=file=>vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'horrorius-scale-worker.js'),'utf8'),context);
context.postMessage=data=>messages.push(data);
(async()=>{
 const raw=fs.readFileSync(process.argv[2]),original=JSON.parse(raw);
 await context.onmessage({data:{type:'import',file:new Blob([raw])}});
 assert.equal(messages.at(-1).type,'imported',JSON.stringify(messages.at(-1)));
 await context.onmessage({data:{type:'export',views:original.views}});
 const saved=JSON.parse(await messages.at(-1).blob.text());
 assert.deepEqual(saved.frames,original.frames);assert.deepEqual(saved.hashes,original.hashes);assert.deepEqual(saved.views,original.views);
 const damaged=JSON.parse(raw),frame=Buffer.from(damaged.frames[0],'base64');frame[0]^=1;damaged.frames[0]=frame.toString('base64');
 await context.onmessage({data:{type:'import',file:new Blob([JSON.stringify(damaged)])}});
 assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/контрольная сумма/);
 const out={author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',frames:original.frames.length,
  importedSuccessfully:true,reexportedFramesIdentical:true,reexportedHashesIdentical:true,reexportedViewsIdentical:true,oneBitCorruptionRejected:true,
  archiveSha256:crypto.createHash('sha256').update(raw).digest('hex'),scope:'actual downloaded archive; worker source import/export; browser file-picker automation unavailable'};
 fs.writeFileSync(path.join(__dirname,'horrorius-worker-check.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
