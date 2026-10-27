const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Auto=require('./mayatnik-auto-axes.js');
const AxisColour=require('./mayatnik-axis-colour.js');
const html=fs.readFileSync(require.resolve('./Zerkalius-mayatnik.html'),'utf8');
const hostSource=html.slice(html.indexOf('  let autoAxesRevision='),html.indexOf('  // v0.046: оси по направлениям'));
const plain=x=>JSON.parse(JSON.stringify(x));
function makeHost({fallback=false}={}){
  const nodes=new Map(),workers=[];
  const ctx={axisStroke:(g,o)=>require('./mayatnik-axis-style.js').stroke(g,{mode:'purple-black',...o}),st:{autoAxes:true,view:'bits'},f:{W:15,H:14,val:new Int8Array(210).fill(1)},geo:{anchor:7},k:4,VX:0,VW:15,VH:14,RG:2,bmGen:0,gpuBig:null,quiet:false,redraws:0,symCanvas:{hidden:false},window:{},
    $:id=>{if(!nodes.has(id))nodes.set(id,{textContent:''});return nodes.get(id);},navQuick:()=>ctx.quiet,parityVisible:()=>true,outShow:()=>false,queueDigits:()=>ctx.redraws++,joinedOn:()=>false,rombP:()=>-1,
    MayatnikAutoAxes:{...Auto,createWorker(){if(fallback)throw Error('CSP');const w={terminated:false,terminate(){this.terminated=true;},postMessage(data){this.request=data;}};workers.push(w);return w;}}};
  for(let r=0;r<4;r++)for(let c=4+r;c<=10-r;c++)ctx.f.val[(2+r)*15+c]=0;
  vm.createContext(ctx);vm.runInContext(hostSource,ctx);
  const deliver=(w,data=Auto.analyze(w.request.field))=>w.onmessage({data:{id:w.request.id,...data}});
  return {ctx,workers,deliver,nodes,api:ctx.window.mayAutoAxes};
}
test('host passes packed logical field with display masks, never RGB or input mutation',()=>{
  const {ctx,api,workers}=makeHost();ctx.VX=2;ctx.VW=9;ctx.VH=10;ctx.parityVisible=(r,c)=>!(r===1&&c===4);ctx.outShow=(r,c)=>r===8&&c===6;
  const before=ctx.f.val.slice();assert.equal(api.get(),null);
  const f=workers[0].request.field;assert.equal(f.W,9);assert.equal(f.H,10);assert.equal(f.val[1*9+2],-1);assert.equal(f.val[8*9+4],-1);
  assert.deepEqual(ctx.f.val,before);assert.equal(api.status().pending,true);assert.equal(api.status().data,null);
});
test('complete worker result equals pure helper and is reused until invalidation',()=>{
  const {ctx,api,workers,deliver}=makeHost();api.get();deliver(workers[0]);
  assert.deepEqual(plain(api.get().segments),Auto.analyze(ctx.f).segments);assert.equal(api.status().pending,false);assert.equal(ctx.redraws,1);assert.equal(workers.length,1);
  vm.runInContext('autoAxesInvalidate()',ctx);assert.equal(api.status().data,null);assert.equal(ctx.symCanvas.hidden,true);api.get();assert.equal(workers.length,2);
});
test('terminated old success or error cannot replace a newer frame result',()=>{
  const {ctx,api,workers,deliver}=makeHost();api.get();const old=workers[0];ctx.k++;api.get();const current=workers[1];assert.equal(old.terminated,true);
  deliver(old);old.onerror();assert.equal(api.status().data,null);assert.equal(api.status().pending,true);
  deliver(current);const key=api.status().data.key;deliver(old,{triangles:[],segments:[],error:'old'});assert.equal(api.status().data.key,key);assert.equal(api.status().data.error,undefined);
});
test('rows, view, field identity, and same-frame invalidation reject old snapshots',()=>{
  for(const mutate of [ctx=>{ctx.VH--;},ctx=>{ctx.st.view='romb2';},ctx=>{ctx.f={...ctx.f,val:ctx.f.val.slice()};},ctx=>vm.runInContext('autoAxesInvalidate()',ctx)]){
    const {ctx,api,workers,deliver}=makeHost();api.get();const old=workers[0];mutate(ctx);api.get();deliver(old);assert.equal(api.status().data,null);deliver(workers[1]);assert.ok(api.status().data);
  }
});
test('disabled, navigation, and unread GPU frames never begin analysis',()=>{
  const {ctx,api,workers}=makeHost();ctx.st.autoAxes=false;assert.equal(api.get(),null);ctx.st.autoAxes=true;ctx.quiet=true;assert.equal(api.get(),null);ctx.quiet=false;ctx.gpuBig={fresh:false,k:4};assert.equal(api.get(),null);ctx.gpuBig={fresh:true,k:3};assert.equal(api.get(),null);assert.equal(workers.length,0);
  ctx.gpuBig.k=4;api.get();assert.equal(workers.length,1);
});
test('CSP fallback completes atomically; worker error exits pending and stays explicit',()=>{
  const fallback=makeHost({fallback:true});const result=fallback.api.get();assert.deepEqual(plain(result.segments),Auto.analyze(fallback.ctx.f).segments);assert.equal(fallback.api.status().pending,false);
  const {api,workers}=makeHost();api.get();workers[0].onerror();assert.match(api.get().error,/Поиск/);assert.equal(api.status().pending,false);assert.equal(workers.length,1);
});
test('auto axes transform endpoints for adjacent and joined panels',()=>{
  const {ctx}=makeHost();const paths=[],g={save(){},restore(){},beginPath(){},rect(){},clip(){},setLineDash(){},moveTo(x,y){this.start=[x,y];},lineTo(x,y){paths.push([this.start,[x,y]]);},stroke(){}};
  ctx.g=g;ctx.data={segments:[{x:7.5,y0:6,y1:10,h:4}]};ctx.rombP=()=>2;
  vm.runInContext('paintAutoAxes(g,data,10,20,2)',ctx);assert.deepEqual(paths,[[[25,32],[25,40]],[[59,32],[59,40]]]);
  paths.length=0;ctx.joinedOn=()=>true;ctx.joinedGeometry=()=>({parts:[{matrix:[1,0,0,1,0,0]},{matrix:[-1,0,0,-1,15,28]}]});
  vm.runInContext('paintAutoAxes(g,data,0,0,1)',ctx);assert.deepEqual(paths,[[[7.5,6],[7.5,10]],[[7.5,22],[7.5,18]]]);
});
test('all-shown seed feed accepts auto-only and refuses any partial pending result',()=>{
  const {ctx,api,workers,deliver}=makeHost();const s=html.slice(html.indexOf('  function axesColourSeeds(){'),html.indexOf('  async function axesColourApply(){'));
  Object.assign(ctx,{axesColourStatus:()=>({reason:''}),MayatnikAxisColour:AxisColour,MayatnikNAxes:{normaliseSets:()=>[]},dispH:()=>ctx.VH,RK:1,img:{width:15,height:14},displayCell:(x,y)=>{const c=Math.floor(x),r=Math.floor(y);return {c,r,q:r*15+c};},displayPoint:(c,r)=>({x:c+.5,y:r+.5}),fillBit:(x,y)=>ctx.f.val[y*15+x]});
  vm.runInContext(s,ctx);assert.throws(()=>vm.runInContext('axesColourSeeds()',ctx),/Дождитесь/);assert.equal(api.status().pending,true);
  deliver(workers[0]);const out=vm.runInContext('axesColourSeeds()',ctx);assert.equal(out.axes,2);assert.deepEqual([...out.indices],[7,22,97,112,127,142,157,172,187,202]);
});
test('menu, clear/undo, restores and export include the auto-axes state',()=>{
  const menu=fs.readFileSync(require.resolve('./mayatnik-menu.js'),'utf8');
  assert.match(menu,/autoAxes:'Автооси ▼'/);assert.match(menu,/\['autoAxes','axes'\]/);assert.match(html,/clearAxesKeys=\[[^\]]*'autoAxes'/);
  assert.match(html,/symTriangles:false,autoAxes:false/);assert.match(html,/paintAutoAxes\(cg,automatic,0,0,RK\)/);
  assert.match(html,/!!st\.autoAxes!==autoAxesOn/);assert.match(html,/if\(!symPending&&!autoAxesPending\)/);
});
test('PNG refuses an incomplete/error result and exports the full accepted axes',()=>{
  const handler=html.slice(html.indexOf("  $('bPng').onclick = () =>"),html.indexOf('  function frameSnapshot(){'));
  const nodes={bPng:{},fillInfo:{textContent:''}},calls={capture:0,axes:0,download:0};let result=null;
  const ctx={viewRotation:{capture:c=>c},$:id=>nodes[id],st:{autoAxes:true},f:{},img:{},autoAxesGet:()=>result,capturePicture:()=>{calls.capture++;return {width:12,height:14};},document:{createElement:()=>({getContext:()=>({putImageData(){}}),toBlob:callback=>callback({})})},paintBitContours(){},paintTemplate(){},paintGeomCenter(){},paintAutoAxes(g,a){assert.equal(a,result);calls.axes++;},RK:1,download(){calls.download++;},fname:()=> 'field.png'};
  vm.runInNewContext(handler,ctx);nodes.bPng.onclick();assert.equal(calls.capture,0);assert.match(nodes.fillInfo.textContent,/дождитесь/);
  result={error:'failed'};nodes.bPng.onclick();assert.equal(calls.capture,0);assert.match(nodes.fillInfo.textContent,/failed/);
  result={triangles:[],segments:[{x:1.5,y0:2,y1:8,h:6}]};nodes.bPng.onclick();assert.deepEqual(calls,{capture:1,axes:1,download:1});
});
