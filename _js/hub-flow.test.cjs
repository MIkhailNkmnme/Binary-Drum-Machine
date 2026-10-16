const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Core=require('./hub-flow-core.js');
function setup(saved={}){
 const nodes=[],queue=new Map(),metrics={distance:0,snow:0,water:0};let id=0,time=0;
 const context=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:()=>{}});
 class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.style={};nodes.push(this);}append(...v){this.children.push(...v);}setAttribute(k,v){this.attrs[k]=v;}getContext(){return context;}}
 const toolbar=new Node('div'),body=new Node('body'),stored={value:JSON.stringify(saved)};
 class Field extends Core.Field{stepWater(){metrics.snow++;super.stepWater();}advanceRay(ray,d){metrics.distance+=d;return super.advanceRay(ray,d);}}
 class WaterField extends Core.WaterField{stepWater(){metrics.water++;super.stepWater();}}
 const window={addEventListener(){},HubView:{drawFlowObstacles:()=>false},HubMirror:{colors:()=>({sym:'#fa0'})}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/hub-flow.js','utf8'),{window,document:{readyState:'complete',body,hidden:false,getElementById:()=>toolbar,createElement:t=>new Node(t),addEventListener(){}},HubFlowCore:{Field,WaterField},innerWidth:60,innerHeight:300,scrollY:0,matchMedia:()=>({matches:false}),localStorage:{getItem:()=>stored.value,setItem:(k,v)=>stored.value=v},requestAnimationFrame:f=>{queue.set(++id,f);return id;},cancelAnimationFrame:i=>queue.delete(i),performance:{now:()=>time}});
 const byLabel=label=>nodes.find(n=>n.attrs['aria-label']===label);
 const frame=()=>{time+=1000/60;const calls=[...queue.values()];queue.clear();for(const fn of calls)fn(time);};
 const set=(key,value)=>{const n=byLabel('Множитель скорости '+key);n.value=String(value);n.oninput();};
 const play=()=>{byLabel('А — свет: включить / выключить').onclick();byLabel('Б — мокрый снег сверху: включить / выключить').onclick();byLabel('В — вода: горизонтальный уровень и сток').onclick();};
 return {nodes,metrics,stored,byLabel,frame,set,play};
}
test('each speed changes only its own physical clock and zero pauses that stream',()=>{
 const run=speeds=>{const f=setup({speeds});f.play();for(let i=0;i<30;i++)f.frame();return f.metrics;};
 const base=run({light:1,snow:1,water:1});
 const slowSnow=run({light:1,snow:.5,water:1});assert.equal(slowSnow.water,base.water);assert.ok(Math.abs(slowSnow.snow*2-base.snow)<=1);assert.equal(slowSnow.distance,base.distance);
 const fastWater=run({light:1,snow:1,water:2});assert.equal(fastWater.snow,base.snow);assert.ok(Math.abs(fastWater.water-base.water*2)<=1);assert.equal(fastWater.distance,base.distance);
 const pause=run({light:0,snow:0,water:0});assert.deepEqual(pause,{distance:0,snow:0,water:0});
 const onlyLight=run({light:2,snow:0,water:0});assert.ok(onlyLight.distance>base.distance);assert.equal(onlyLight.snow,0);assert.equal(onlyLight.water,0);
});
test('slider change freezes existing rays and liquid, resumes independently and saves all speeds',()=>{
 const f=setup();f.play();for(let i=0;i<10;i++)f.frame();
 f.set('света',0);f.set('воды',0);f.set('снега',2);const before={...f.metrics};
 for(let i=0;i<10;i++)f.frame();assert.equal(f.metrics.distance,before.distance);assert.equal(f.metrics.water,before.water);assert.ok(f.metrics.snow>before.snow);
 f.set('воды',.5);f.frame();assert.ok(f.metrics.water>before.water);assert.equal(f.metrics.distance,before.distance);
 assert.deepEqual(JSON.parse(f.stored.value).speeds,{light:0,snow:2,water:.5});
 const restored=setup(JSON.parse(f.stored.value));assert.equal(restored.byLabel('Множитель скорости воды').value,'0.5');assert.equal(restored.byLabel('Множитель скорости света').value,'0');
});
test('dense water emits only on its own physical steps and pauses without clearing existing water',()=>{
 const f=setup({dense:true,speeds:{light:0,snow:0,water:1}});f.play();for(let i=0;i<10;i++)f.frame();
 const canvas=f.nodes.find(n=>n.id==='hubFlow'),amount=canvas.dataset.water;assert.ok(Number(amount)>0);
 f.set('воды',0);for(let i=0;i<10;i++)f.frame();assert.equal(canvas.dataset.water,amount);
 assert.equal(canvas.dataset.waterSpeed,'0');assert.equal(canvas.dataset.snowSpeed,'0');
});
test('old settings default to normal speed; saved invalid values are bounded',()=>{
 const f=setup({speeds:{light:10,snow:-1,water:'bad'}});
 assert.equal(f.byLabel('Множитель скорости света').value,'4');assert.equal(f.byLabel('Множитель скорости снега').value,'0');assert.equal(f.byLabel('Множитель скорости воды').value,'1');
});
