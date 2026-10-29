const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./mayatnik-template-matcher.js');
global.MayatnikTemplateMatcher=M;
const Engine=require('./mayatnik-template-engine.js');
const shape={width:3,height:2,data:[9,9,9,9,0,0]};
function fieldWithCopies(){
  const field={width:14,height:6,data:new Int8Array(84).fill(-1)};
  for(const [x,y,bit,mirrorX]of [[1,1,0,false],[8,2,1,true]]){
    const p=M.compile(shape,1,{silhouette:true,mirrorX});
    for(const q of p.filled)field.data[(y+Math.floor(q/p.width))*field.width+x+q%p.width]=bit;
  }
  return field;
}
test('horizontal reflection searches anywhere and returns individual zero/one occurrences without changing the field',async()=>{
  const field=fieldWithCopies(),before=field.data.slice(),direct=M.compile(shape,1,{silhouette:true}),mirror=M.compile(shape,1,{silhouette:true,mirrorX:true});
  const result=await M.find(field,[direct,mirror],{collectMatches:true});
  assert.equal(result.count,2);assert.equal(result.selectedCount,8);
  assert.deepEqual(result.matches,[{x:1,y:1,width:3,height:2,patternIndex:0,bit:0},{x:8,y:2,width:3,height:2,patternIndex:1,bit:1}]);
  assert.deepEqual(field.data,before);
  assert.equal((await M.find(field,[direct])).count,1);
  assert.equal(Object.hasOwn(await M.find(field,[direct]),'matches'),false);
  assert.equal(Object.hasOwn(await M.find(field,[direct],{collectMatches:true,existsOnly:true}),'matches'),false);
});
test('horizontal reflection preserves the logical mask at different raster scales and mirrors the silhouette boundary',()=>{
  for(const rk of [1,2,3]){
    const width=shape.width*rk,height=shape.height*rk,data=Array.from({length:width*height},(_,q)=>shape.data[Math.floor(q/width/rk)*shape.width+Math.floor(q%width/rk)]);
    const direct=M.compile({width,height,data},rk,{silhouette:true}),mirror=M.compile({width,height,data},rk,{silhouette:true,mirrorX:true});
    assert.deepEqual([...mirror.data],[9,9,9,0,0,9].map(Boolean).map(Number));
    const edges=p=>Array.from({length:p.boundary.length/2},(_,i)=>[p.boundary[i*2],p.boundary[i*2+1]]);
    assert.deepEqual(edges(mirror).map(v=>v.join(':')).sort(),edges(direct).map(([x,y])=>[direct.width-1-x,y].join(':')).sort());
  }
});
test('collecting occurrences retains cancellation and never returns a partial result',async()=>{
  const field={width:1024,height:64,data:Int8Array.from({length:65536},(_,q)=>q%2)},before=field.data.slice();let cancelled=false;
  await assert.rejects(M.find(field,[M.compile({width:1,height:1,data:[1]},1)],{collectMatches:true,budgetMs:0,cancelled:()=>cancelled,yieldTask:async()=>{cancelled=true;}}),{name:'AbortError'});
  assert.deepEqual(field.data,before);
});
function engineFixture(){
  const field=fieldWithCopies(),entry={rk:1,parts:[shape]};let current=true,request,focus,calls=0,instanceOptions;
  const host={entries:()=>[],field:async()=>field,current:value=>value===field&&current,stop(){},redrawSelection(){},
    shapeInstances(value,options){assert.equal(value,entry);instanceOptions=options;return ['source'];},
    async materializeMatches(value,cancelled){assert.equal(cancelled(),false);request=value;calls++;return {instances:['source','reflected'],createdCount:1,reusedCount:1};},
    focus(value){focus=value;}};
  const api=Engine.create(host);return {api,host,field,entry,invalidate(){current=false;},get request(){return request;},get calls(){return calls;},get focus(){return focus;},get instanceOptions(){return instanceOptions;}};
}
test('opt-in materialization receives direct and mirrored occurrences and focuses actual templates without retaining a paint selection',async()=>{
  const f=engineFixture(),before=f.field.data.slice(),state=await f.api.selectShape(f.entry,{mirrorX:true,materialize:true});
  assert.equal(f.calls,1);assert.equal(f.request.patterns.length,2);assert.equal(f.request.matches.length,2);assert.equal(f.request.field,f.field);
  assert.deepEqual(f.request.instances,['source']);assert.deepEqual(f.instanceOptions,{mirrorX:true});
  assert.equal(state.count,2);assert.equal(state.busy,false);assert.match(state.message,/текущих строках/);assert.equal(f.api.getSelection(),null);
  assert.deepEqual(f.focus.instances,['source','reflected']);assert.equal(await f.api.colour('#123456'),false);assert.deepEqual(f.field.data,before);
});
test('symmetric shapes and duplicate parts are scanned once; host instance identities are unique',async()=>{
  const f=engineFixture();f.entry.parts=[{width:1,height:1,data:[9]},{width:1,height:1,data:[3]}];
  let request;f.host.materializeMatches=async value=>{request=value;return {instances:['a','a','b']};};
  const state=await f.api.selectShape(f.entry,{mirrorX:true,materialize:true});
  assert.equal(request.patterns.length,1);assert.equal(state.count,2);assert.deepEqual(f.focus.instances,['a','b']);
});
test('legacy selection remains direct and never materializes; upgrading a cached search collects occurrences',async()=>{
  const f=engineFixture();await f.api.selectShape(f.entry);assert.equal(f.calls,0);assert.equal(f.api.getSelection().count,1);
  await f.api.selectShape(f.entry,{mirrorX:true});assert.equal(f.calls,0);assert.equal(f.api.getSelection().count,2);
  await f.api.selectShape(f.entry,{mirrorX:true,materialize:true});assert.equal(f.calls,1);assert.equal(f.request.matches.length,2);
  const previous=f.request.matches;await f.api.selectShape(f.entry,{mirrorX:true,materialize:true});assert.equal(f.request.matches,previous);
});
test('an atomic host commit may invalidate the field revision without being mistaken for a cancelled search',async()=>{
  const f=engineFixture();f.host.materializeMatches=async(request,cancelled)=>{assert.equal(cancelled(),false);f.invalidate();return {instances:['committed']};};
  const state=await f.api.selectShape(f.entry,{mirrorX:true,materialize:true});assert.equal(state.count,1);assert.equal(state.busy,false);assert.equal(f.api.getSelection(),null);
});
test('cancelling while the host prepares copies prevents its commit and never publishes a partial selection',async()=>{
  const f=engineFixture();let release,ready,committed=false;const entered=new Promise(resolve=>ready=resolve);
  f.host.materializeMatches=async(request,cancelled)=>{ready();await new Promise(resolve=>release=resolve);if(cancelled())throw M.abort();committed=true;return {instances:['bad']};};
  const pending=f.api.selectShape(f.entry,{mirrorX:true,materialize:true});await entered;f.api.clear();release();await pending;
  assert.equal(committed,false);assert.equal(f.api.getSelection(),null);assert.equal(f.api.getState().busy,false);assert.equal(f.api.getState().count,0);
});
test('field changes and explicit materialization limits leave no partial paint selection',async()=>{
  const stale=engineFixture();stale.invalidate();await stale.api.selectShape(stale.entry,{mirrorX:true,materialize:true});assert.equal(stale.calls,0);assert.equal(stale.api.getSelection(),null);assert.match(stale.api.getState().message,/Поле изменилось/);
  const limited=engineFixture();limited.host.materializeMatches=async()=>{throw Error('Недостаточно памяти для всех найденных шаблонов');};
  const result=await limited.api.selectShape(limited.entry,{mirrorX:true,materialize:true});assert.equal(result.count,0);assert.equal(result.busy,false);assert.equal(limited.api.getSelection(),null);assert.match(result.message,/Недостаточно памяти/);
});
