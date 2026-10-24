// Node-only logic timings. These are not browser FPS or end-to-end UI measurements.
const M=require('./mayatnik-template-matcher.js');global.MayatnikTemplateMatcher=M;const E=require('./mayatnik-template-engine.js');
(async()=>{
 const width=6144,height=2048,data=new Int8Array(width*height);let seed=37;
 for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed>>>24)&1;}
 const part={width:5,height:5,data:[0,0,1,0,0,0,1,1,1,0,1,1,1,1,1,0,1,1,1,0,0,0,1,0,0]},entry={id:'bench',name:'bench',shape:{hex:'#ffffff',parts:[part],rk:1}},field={width,height,data};
 for(let i=0;i<100;i++)for(let y=0;y<5;y++)for(let x=0;x<5;x++)data[(100+Math.floor(i/20)*20+y)*width+100+(i%20)*20+x]=part.data[y*5+x];
 const host={entries:()=>[entry],field:async()=>field,current:f=>f===field,instances:()=>[],choose(){},stop(){},redrawSelection(){},insert(){},edit(){},action(){}};const api=E.create(host);
 let t=performance.now();await api.select('bench');const first=performance.now()-t,result=api.getSelection();t=performance.now();await api.select('bench');const cached=performance.now()-t;
 let emits=0;api.subscribe(()=>emits++);api.refresh();emits=0;t=performance.now();for(let i=0;i<10000;i++)api.refresh();const idle=performance.now()-t;
 const absent={width:64,height:64,data:Array(4096).fill(1)},start=performance.now(),negative=await M.find(field,[M.compile(absent)]);
 console.log(JSON.stringify({environment:'Node, no browser',width,height,cells:data.length,mask:'5x5',matches:result.count,firstMs:+first.toFixed(2),cachedMs:+cached.toFixed(3),yields:result.yields,maxWorkSliceMs:+result.maxSliceMs.toFixed(2),idleRefresh10000Ms:+idle.toFixed(2),idleEmits:emits,negative64x64:{ms:+(performance.now()-start).toFixed(2),matches:negative.count,yields:negative.yields,maxWorkSliceMs:+negative.maxSliceMs.toFixed(2)}},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
