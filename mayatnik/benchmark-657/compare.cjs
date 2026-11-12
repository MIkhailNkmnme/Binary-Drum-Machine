'use strict';
// Pure comparison of saved measurements; does not start a browser or GPU job.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const rows=[];
for(const suffix of ['','-hit','-8192']){
 const before=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline'+suffix+'.json'))),after=JSON.parse(fs.readFileSync(path.join(__dirname,'current'+suffix+'.json')));
 for(const key of ['H','W','stride','anchor','frame','mode','pair','range'])assert.deepEqual(after.setup[key],before.setup[key],key);
 assert.deepEqual(after.errors,[]);assert.deepEqual(before.errors,[]);
 assert.equal(before.results.length,after.results.length);
 for(let i=0;i<before.results.length;i++){
  const a=before.results[i],b=after.results[i],{gpu,occurrenceCount,...actual}=b.result;
  assert.deepEqual(b.options,a.options);assert.deepEqual(actual,a.result);
  // Equal archive byte length is recorded, not claimed to prove equal contents.
  rows.push({scenario:suffix||'16384-no-hit',sameOptions:true,semanticResultEqual:true,frame:before.setup.frame,height:before.setup.H,query:a.options.vsets[0][0][0],direction:a.options.mode,found:a.result.found.length,beforeTotalMs:a.metrics.totalMs,afterTotalMs:b.metrics.totalMs,totalSpeedup:a.metrics.totalMs/b.metrics.totalMs,beforeReadbackBytes:a.metrics.readbackBytes,afterSearchReadbackBytes:b.metrics.readbackBytes,readbackReduction:a.metrics.readbackBytes/b.metrics.readbackBytes,archiveBytesBefore:a.archiveBytes,archiveBytesAfter:b.archiveBytes});
 }
}
fs.writeFileSync(path.join(__dirname,'comparison.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows,null,2));
