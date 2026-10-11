/* Codex — независимый исследователь Хоррориуса, 2026-10-12.
   Actual core timing; page memory accounting is a lower estimate, not measured Chrome RSS. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const html=fs.readFileSync(path.join(__dirname,'../mayatnik/Zerkalius-mayatnik.html'),'utf8');
const ctx={module:{exports:{}}};vm.runInNewContext(html.match(/\/\* ==== ЯДРО[^]*?\*\/([^]*?)\/\* ==== \/ЯДРО/)[1],ctx);
const M=ctx.module.exports;
const sample=M.field(1,1,'empty'),bytesPerCell=sample.val.byteLength+(sample.col?.byteLength||0);
function pageMemory(N,S){
 const {W}=M.geometry('pend',S,N),cells=W*N,frame=bytesPerCell*cells,interval=Math.max(1,Math.ceil(S*frame/200e6));
 const snapshots=1+Math.floor(S/interval),explicitBytes=frame*(1+snapshots)+4*cells;
 return {rows:N,vertices:S,width:W,cells,snapshotCount:snapshots,explicitBytes,withOneCanvasBackingBytes:explicitBytes+4*cells,
   explicitMiB:+(explicitBytes/2**20).toFixed(1),withOneCanvasBackingMiB:+((explicitBytes+4*cells)/2**20).toFixed(1)};
}
function benchmark(N,steps){
 const {W,anchor}=M.geometry('pend',N,N),f=M.field(W,N,'empty');
 // Warm the same kernel and branch patterns before timing a complete sequence or sample.
 for(let k=0;k<8;k++)M.cone(f,anchor+M.offset('pend',k),N);
 f.val.fill(-1);if(f.col)f.col.fill(0);
 const start=performance.now();
 for(let k=0;k<steps;k++)M.cone(f,anchor+M.offset('pend',k),N);
 const seconds=(performance.now()-start)/1000;
 return {rows:N,measuredVertices:steps,seconds:+seconds.toFixed(4),secondsPerVertex:+(seconds/steps).toFixed(6),
   allNVertices:steps===N?'measured':'extrapolated',estimatedSecondsForN:+(seconds/steps*N).toFixed(2),
   estimatedSecondsForThird:+(seconds/steps*(Math.ceil(N/3)+Math.ceil(N/64))).toFixed(2),arrayMiB:+(bytesPerCell*f.val.length/2**20).toFixed(1)};
}
if(require.main===module){
 const results=[];
 for(const N of [256,512,1024,2024,4096]){
  const r=benchmark(N,N<=1024?N:64);results.push(r);console.error(JSON.stringify(r));if(global.gc)global.gc();
 }
 const out={author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',sourcePageVersion:html.match(/Маятник — (v\d+\.\d+)/)[1],bytesPerCell,cpu:os.cpus()[0].model,
  runtime:process.version,physicalRamGiB:+(os.totalmem()/2**30).toFixed(2),coreTimings:results,
  memory:[1024,2024,4096,8192,16384].flatMap(N=>[pageMemory(N,N),pageMemory(N,Math.ceil(N/3)+Math.ceil(N/64)),pageMemory(N,4*N)])};
 fs.writeFileSync(path.join(__dirname,'horrorius-capacity-results.json'),JSON.stringify(out,null,2)+'\n');
}
module.exports={pageMemory,benchmark};
