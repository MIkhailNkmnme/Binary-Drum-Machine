/* Codex — независимый исследователь Хоррориуса, 2026-10-12. */
'use strict';
const {create}=require('./horrorius-packed.cjs'),fs=require('node:fs'),path=require('node:path');
function run(N,complete=true){
 const target=Math.ceil(N/3)+Math.ceil(N/64),field=create(N,target),count=complete?target:64,start=performance.now();
 for(let k=0;k<count;k++){
  field.next();
  if(k&&k%256===0)console.error(JSON.stringify({rows:N,progress:field.completed,target,elapsedSeconds:+((performance.now()-start)/1000).toFixed(2)}));
 }
 const seconds=(performance.now()-start)/1000;
 return {rows:N,targetVertices:target,completedVertices:field.completed,seconds:+seconds.toFixed(3),
   measuredFullTarget:complete,estimatedFullTargetSeconds:complete?null:+(seconds/count*target).toFixed(2),
   allocatedMiB:+(field.bits.byteLength/2**20).toFixed(3),width:field.width,
   sampleBits:[field.value(N-1,field.anchor),field.value(N-2,field.anchor),field.value(N-1,field.anchor+7)]};
}
if(require.main===module){
 const cases=process.argv[2]?process.argv[2].split(',').map(Number):[1024,4096,8192,16384],results=[];
 for(const N of cases){const result=run(N,N<=8192);results.push(result);console.error(JSON.stringify(result));if(global.gc)global.gc();}
 fs.writeFileSync(path.join(__dirname,'horrorius-packed-results.json'),JSON.stringify({author:'Codex — независимый исследователь Хоррориуса',date:'2026-10-12',scope:'empty field; pendulum; bits only; no canvas, colours or undo snapshots',results},null,2)+'\n');
}
module.exports={run};
