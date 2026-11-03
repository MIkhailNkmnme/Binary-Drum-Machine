'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('./mayatnik-core'),Construction=require('./mayatnik-construction'),Reset=require('./mayatnik-reset-state'),Work=require('./mayatnik-work-file'),bank=require('./mayatnik-xorrom-bank');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
const part=(first,next)=>html.slice(html.indexOf('  '+first),html.indexOf('  '+next,html.indexOf('  '+first)+1));
function scene(state){
 const controls=Object.fromEntries(Object.entries({rows:state.rows,steps:state.steps,mode:state.mode,bg:state.bg,view:state.view,speed:state.speed}).map(([key,value])=>[key,{value:String(value)}]));
 const marker=Error('allocated'),noop=()=>{},context={st:structuredClone(state),window:{mayManualSnake:{reset:noop},mayTemplateLibrary:{clear:noop}},
  $:id=>controls[id]||(controls[id]={value:''}),clampInt:(v,a,b,d)=>Number.isFinite(+v)?Math.max(a,Math.min(b,Math.round(+v))):d,
  vSteps:n=>n,edgeWidthFactor:()=>4,save:noop,animatrixOn:()=>false,rowBuildCancel:noop,compareFreezeService:null,testBuildTimer:0,
  testPattern:null,testStatsEl:null,templateMatchLayer:null,templateMatchRevision:0,templateMatchCache:null,foldSuspend:noop,stop:noop,
  clearKonus:noop,advancePaintColour:noop,pairOn:()=>false,compareOn:()=>false,MayatnikConstruction:Construction,MAYATNIK:Core,
  Int8Array,Uint8Array,console,gpuSetup:()=>{throw marker;}};
 vm.createContext(context);vm.runInContext(part('function readUI(','function axisStroke(')+part('function reset(','// v0.014:'),context);
 return {context,controls,reset(steps){assert.throws(()=>context.reset(false,steps),error=>error===marker);}};
}
test('restoring stored frame geometry preserves explicit 31 vertices instead of replacing them with 128 rows',async()=>{
 for(const entry of bank){
  const saved=await Work.decode(new Blob([Buffer.from(entry.frame.base64,'base64')])),s=scene(saved.data.st);
  s.reset(saved.data.st.steps);
  assert.equal(s.context.st.steps,31);assert.equal(s.controls.steps.value,31);
  assert.equal(s.context.f.W,285);assert.equal(s.context.f.H,128);assert.equal(s.context.f.val.length,saved.data.field.length);
  s.context.f.val.set(saved.data.field);assert.deepEqual(s.context.f.val,saved.data.field);
 }
});
test('ordinary Build still derives N vertices from rows after opening a custom-size saved frame',()=>{
 const s=scene({...Reset.defaults(),rows:128,steps:31});s.reset();
 assert.equal(s.context.st.steps,128);assert.equal(s.context.f.W,Core.geometry('pend',128,128).W);
});
