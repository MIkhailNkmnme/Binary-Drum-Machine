const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'Zerkalius-mayatnik.html'),'utf8');
const helpers=source.slice(source.indexOf('  function notifyXorromField(){'),source.indexOf('  function addXorromRecordingAudio('));
function fixture(width=2,height=2){
  const calls=[],acquired=[];let released=0;
  const context={window:{mayXorrom:{fieldChanged:change=>calls.push(change)},mayVisibleSemantic:{async acquire(options){acquired.push(options);return {width:context.VW,height:context.VH,current:()=>true,readBit:(x,y)=>y?0:1,release(){released++;}};}}},
    f:{},geo:{},k:1,VW:width,VH:height,manualPaintRevision:0,templateMatchRevision:0,pxHide:new Set(),gpuBig:null,rgbNeighbourClasses:null,
    st:{view:'bits',viewUpsideDown:false,edgeRhombOn:false,xorrom:{bpm:120}},document:{body:{classList:{contains:()=>false}}},
    manualPaintKey:()=>String(context.k),manualPatternGeometry:()=>context.st.view,rgbNeighbourFilters:()=>context.filters||[],rgbNeighbourBWMode:()=>context.bw||0,
    rombP:()=>-1,joinedOn:()=>false,MayatnikXorromField:require('./mayatnik-xorrom-field.js'),MayatnikXorromGeometry:require('./mayatnik-xorrom-geometry.js')};
  vm.createContext(context);vm.runInContext(helpers,context);
  return {context,calls,acquired,get released(){return released;}};
}
test('material changes notify once; music cues and settings do not dirty the frame',()=>{
  const {context:c,calls}=fixture();c.notifyXorromField();assert.equal(calls.length,1);c.notifyXorromField();c.st.xorrom.bpm=190;c.notifyXorromField();assert.equal(calls.length,1);
  for(const mutate of [()=>c.k++,()=>c.manualPaintRevision++,()=>c.templateMatchRevision++,()=>c.filters=[3],()=>c.bw=2,()=>c.st.viewUpsideDown=true,()=>c.st.view='rgbNeighbours',()=>c.pxHide.add(4),()=>c.st.edgeRhombOn=true,()=>c.f={}]){
    const count=calls.length;mutate();c.notifyXorromField();assert.equal(calls.length,count+1);c.notifyXorromField();assert.equal(calls.length,count+1);
  }
  assert.equal(calls.at(-1).owner,c.f);
});
test('initial capture pauses transport; automatic capture preserves it and reads fresh bits',async()=>{
  const f=fixture();await f.context.captureXorromField();assert.equal(f.acquired[0].preserveTransport,false);
  const score=await f.context.captureXorromField({automatic:true});assert.equal(f.acquired[1].preserveTransport,true);assert.equal(score.frame,1);
  assert.deepEqual(Array.from(score.rows[0].bits),[1,1]);assert.deepEqual(Array.from(score.rows[1].bits),[0,0]);assert.equal(f.released,2);
});
test('automatic small capture finishes coherently before the next task and releases cancelled reads',async()=>{
  const f=fixture(32769,1);let taskRan=false;const timer=setTimeout(()=>{taskRan=true;},0);
  try{await f.context.captureXorromField({automatic:true});assert.equal(taskRan,false);}finally{clearTimeout(timer);}
  await assert.rejects(f.context.captureXorromField({automatic:true,cancelled:()=>true}),{name:'AbortError'});assert.equal(f.released,2);
});
test('capture yield hint applies only to automatic fields of at most one million cells',async()=>{
  const f=fixture();const seen=[];f.context.MayatnikXorromField={MAX_CELLS:16777216,MAX_ROWS:16384,async capture(field,options){seen.push(options);assert.equal(field.current(),true);return {};}};
  await f.context.captureXorromField();await f.context.captureXorromField({automatic:true});
  f.context.VW=1048577;f.context.VH=1;await f.context.captureXorromField({automatic:true});
  assert.equal(seen[0].yieldTask,undefined);assert.equal(typeof seen[1].yieldTask,'function');assert.equal(seen[2].yieldTask,undefined);
});
test('presentation paths notify completed frames and rotation; restore paths explicitly stop music',()=>{
  const present=source.slice(source.indexOf('  function present(quick)'),source.indexOf('  function bothOn()'));
  assert.match(present,/g\.putImageData/);assert.equal((present.match(/notifyXorromField\(\)/g)||[]).length,4);
  assert.match(source,/function viewRotationSync\(\)[^\n]*notifyXorromField\(\)/);
  assert.doesNotMatch(source.slice(source.indexOf('  function reset(paintNow'),source.indexOf('  function reset(paintNow')+150),/mayXorrom\?\.stop/);
  assert.match(source,/window\.mayXorrom\?\.stop\(\);cacheRestoring=true/);
  assert.match(source,/window\.mayXorrom\?\.stop\(\);stopFrameTransports\(\);target=k/);
});


test('geometry is opt-in, runs on captured visible bits and cancels obsolete settings',async()=>{
  const f=fixture(5,3),c=f.context;
  c.window.mayVisibleSemantic.acquire=async()=>({width:5,height:3,current:()=>true,readBit:(x,y)=>x===0||x===4||y===2?1:0,release(){}});
  const plain=await c.captureXorromField();assert.equal(plain.geometry,undefined);
  c.st.xorrom.autoGeometry=true;c.st.xorrom.geometryConnectivity='sides';
  const score=await c.captureXorromField();assert.equal(score.geometry.connectivity,'sides');assert.equal(score.rows[0].geometry.zero,score.rows[1].geometry.zero);assert.equal(score.rows[0].geometry.zero.area,6);
  let seen;c.MayatnikXorromGeometry={async analyze(score,options){seen=options;assert.equal(options.cancelled(),false);c.st.xorrom.geometryConnectivity='bit';assert.equal(options.cancelled(),true);const e=Error('cancelled');e.name='AbortError';throw e;}};
  await assert.rejects(c.captureXorromField({automatic:true}),{name:'AbortError'});assert.equal(seen.yieldTask,undefined,'geometry retains task yields rather than blocking frame with microtasks');
});
