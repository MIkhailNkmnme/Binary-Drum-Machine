const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('./mayatnik-template-matcher.js'),T=require('./mayatnik-template.js'),L=require('./mayatnik-template-limit.js');
const html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
function production(name){const match=new RegExp('  (?:async )?function '+name+'\\(').exec(html);assert.ok(match,name);const start=html.indexOf('{',match.index);let depth=1,i=start+1;for(;depth;i++){if(html[i]==='{')depth++;if(html[i]==='}')depth--;}return html.slice(match.index,i);}
const part={width:3,height:2,data:[1,1,1,1,0,0]};
function fixture({rk=1,vx=0,vw=14}={}){
  const nodes=new Map(),W=14,H=6,field={width:W,height:H,data:new Int8Array(W*H).fill(-1)},pixels=Uint32Array.from({length:vw*rk*H*rk},(_,i)=>(0xff000000|i*347+0x14325)>>>0);
  for(const [x,y,bit,mirrorX]of [[1,1,0,false],[8,2,1,true]]){const p=M.compile(part,1,{silhouette:true,mirrorX});for(const q of p.filled)field.data[(y+Math.floor(q/p.width))*W+x+q%p.width]=bit;}
  const control=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='templateHeight'||id==='templateAlpha'?100:0,checked:false,setAttribute(){}});return nodes.get(id);};
  const c={manualPaintCurrent:()=>null,manualPaintState:null,manualPaintRevision:0,Uint32Array,Uint8Array,Uint8ClampedArray,Int8Array,Map,Set,Date,JSON,Promise,setTimeout,Math,Number,String,Array,Object,ImageData:class{constructor(data,width,height){Object.assign(this,{data,width,height});}},
    document:{createElement:()=>({getContext:()=>({putImageData(){}})})},$:control,img:{width:vw*rk,height:H*rk,data:new Uint8ClampedArray(pixels.buffer)},gpuBig:null,playing:false,bmGen:0,f:{W,H,val:field.data},geo:{anchor:6},k:10,
    VX:vx,VW:vw,VH:H,RK:rk,RG:2,rombP:()=>-1,scale:()=>1,DPR:()=>1,wrap:{clientWidth:800,clientHeight:600},st:{templateMaxArea:4096,view:'bits'},parityVisible:()=>true,compareOn:()=>false,tintAt:()=>0,PAL:{bits:[[[1,2,3]],[[7,8,9]]]},rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,
    MayatnikTemplateMatcher:M,MayatnikTemplate:T,MayatnikTemplateLimit:L,window:{mayLayers:{get:()=>null},mayTemplateLibrary:{clear(){}}},templateItems:[],templateSerial:0,templatePickedIds:new Set(),colourTemplate:null,templateOffsetX:0,templateDragging:null,templateMatchRevision:0,templateMatchCache:null,templateMatchLayer:null,templateLibrary:[],removedTemplateIds:new Set(),
    templateTransfer:false,templateAxisUnlocked:false,templateVisible:false,templatePaintBit:1,templateReturn:null,templateLastDown:0,templateStatsKey:'',templateMove:false,fillMode:false,autoVertical:0,
    faceLayer:null,templatePaintLayer:null,fillMask:Uint32Array.of(5,6),paintBits:Int8Array.of(0,1),fillBits:null,fillHistory:[],fillRedo:[],fillHistoryBytes:0,mirrorLive:false,mirrorApplying:false,
    colReplaySnapshot:()=>[],colReplayRestore(){},autoSync(){},fillSync(){},templateSync(){},queueDigits(){},savePaint(){},draw(){},persistLibrary(){},MayatnikPaintCache:{write:async()=>{}},templateSelectionSkipped:()=>false};
  vm.createContext(c);for(const name of ['templateOptions','templateRect','templateItemAllowed','rememberTemplate','selectTemplate','sceneSnapshot','pushHistory','templateSceneHistory','historyStep','templateMatchKey','templateMatchProjection','templateMatchOffscreenColour','materializeTemplateMatches','templateShapeInstances','liftTemplateSource'])vm.runInContext(production(name),c);
  async function request(){const patterns=[M.compile(part,1,{silhouette:true}),M.compile(part,1,{silhouette:true,mirrorX:true})],found=await M.find(field,patterns,{collectMatches:true});return {field,patterns,matches:found.matches,instances:c.templateItems.map(t=>t.id),shape:{rk:1,parts:[part],searchProjection:c.templateMatchProjection()}};}
  return {c,field,pixels,request,nodes};
}
test('production host creates distinct source-colour copies, selects all, preserves field/paint, and repeats without duplicates',async()=>{
  for(const rk of [1,2,3]){
    const f=fixture({rk}),{c}=f,before={field:c.f.val.slice(),paint:c.fillMask.slice(),bits:c.paintBits.slice(),pixels:f.pixels.slice()};
    const result=await c.materializeTemplateMatches(await f.request(),()=>false);assert.equal(result.createdCount,2);assert.equal(c.templateItems.length,2);assert.equal(c.templatePickedIds.size,2);assert.equal(c.fillHistory.length,1);
    for(const t of c.templateItems){assert.equal(t.sourcePreserving,true);assert.equal(t.paintSource,false);assert.equal(t.lifted,null);assert.equal(t.parts[0].bitsData,undefined);const m=t.parts[0].mask;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(m.data[y*m.width+x])assert.equal(m.data[y*m.width+x],f.pixels[(m.y+y)*c.img.width+m.x+x]);}
    const again=await c.materializeTemplateMatches(await f.request(),()=>false);assert.equal(again.createdCount,0);assert.equal(c.templateItems.length,2);assert.equal(c.fillHistory.length,1);
    assert.deepEqual(c.f.val,before.field);assert.deepEqual(c.fillMask,before.paint);assert.deepEqual(c.paintBits,before.bits);assert.deepEqual(f.pixels,before.pixels);assert.equal(c.templateMatchLayer,null);
    c.liftTemplateSource(true);assert.deepEqual(c.paintBits,before.bits);assert.deepEqual(c.fillMask,before.paint);
  }
});
test('production undo and redo restore the entire picked set in one step',async()=>{
  const f=fixture(),{c}=f;await c.materializeTemplateMatches(await f.request(),()=>false);const ids=[...c.templatePickedIds];
  c.historyStep(false);assert.equal(c.templateItems.length,0);assert.equal(c.templatePickedIds.size,0);assert.equal(c.colourTemplate,null);
  c.historyStep(true);assert.equal(c.templateItems.length,2);assert.deepEqual([...c.templatePickedIds],ids);assert.equal(c.colourTemplate.id,ids[0]);assert.equal(c.fillHistory.length,1);
  c.selectTemplate(null,false);await c.materializeTemplateMatches(await f.request(),()=>false);assert.equal(c.fillHistory.length,2);
  c.historyStep(false);assert.equal(c.templateItems.length,2);assert.equal(c.colourTemplate,null);assert.equal(c.templatePickedIds.size,0);
});
test('exact transformed placement reuses existing copies, while an offset copy remains independent',async()=>{
  const f=fixture(),{c}=f;await c.materializeTemplateMatches(await f.request(),()=>false);const original=c.templateItems[0],mirror=c.templateItems[1];
  original.view.x=4;c.colourTemplate=null;c.selectTemplate(mirror,false);const request=await f.request();const result=await c.materializeTemplateMatches(request,()=>false);
  assert.equal(result.createdCount,1);assert.equal(c.templateItems.length,3);assert.equal(c.templatePickedIds.size,3);assert.equal(c.templateItems.filter(t=>t.parts[0].mask.x===1&&t.view.x===0).length,1);
  const repeated=await c.materializeTemplateMatches(await f.request(),()=>false);assert.equal(repeated.createdCount,0);
});
test('ordinary full-width matches outside the raster window are still materialized at correct coordinates',async()=>{
  const f=fixture({vx:4,vw:6}),{c}=f;const result=await c.materializeTemplateMatches(await f.request(),()=>false);assert.equal(result.createdCount,2);
  const left=c.templateItems[0].parts[0].mask;assert.equal(left.x,-3);assert.equal(left.data.find(Boolean),0xff030201);assert.equal(c.templateItems[1].parts[0].mask.x,4);
});
test('projection changes, hidden parity, GPU and allocation limits fail before committing any copies',async()=>{
  const changed=fixture(),request=await changed.request();changed.c.st.view='col';await assert.rejects(changed.c.materializeTemplateMatches(request,()=>false),{name:'AbortError'});assert.equal(changed.c.templateItems.length,0);
  const hidden=fixture();hidden.c.parityVisible=(r,c)=>c<7;await assert.rejects(hidden.c.materializeTemplateMatches(await hidden.request(),()=>false),/скрытую решётку/);assert.equal(hidden.c.templateItems.length,0);assert.equal(hidden.c.fillHistory.length,0);
  const gpu=fixture();gpu.c.gpuBig={};await assert.rejects(gpu.c.materializeTemplateMatches(await gpu.request(),()=>false),/GPU/);assert.equal(gpu.c.templateItems.length,0);
  const limited=fixture();limited.c.wrap={clientWidth:10000,clientHeight:10000};await assert.rejects(limited.c.materializeTemplateMatches(await limited.request(),()=>false),/лимит.*1 новых/);assert.equal(limited.c.templateItems.length,0);assert.equal(limited.c.fillHistory.length,0);
});
test('source-preserving templates do not enter automatic colour locks',()=>{
  const f=fixture(),{c}=f;c.templateItems=[{sourcePreserving:true,view:{visible:true}}];Object.assign(c,{LOCK_OFF:false,templateLocks:{sig:'same',items:{},paint:{},masks:{}},lockSig:()=> 'same',lockSave(){throw Error('source-preserving selection must not save locks');}});
  vm.runInContext(production('templateLockCheck'),c);assert.equal(c.templateLockCheck(),false);assert.deepEqual(Object.keys(c.templateLocks.items),[]);assert.deepEqual(Object.keys(c.templateLocks.masks),[]);
});
test('shape instance matching includes horizontal reflections only when requested',()=>{
  const f=fixture(),{c}=f;const direct={id:'direct',view:{visible:true},parts:[{mask:part}]},mirror={id:'mirror',view:{visible:true},parts:[{mask:{...part,data:[1,1,1,0,0,1]}}]};c.templateItems=[direct,mirror];c.templateItemAllowed=()=>true;
  assert.deepEqual([...c.templateShapeInstances({rk:1,parts:[part]})],['direct']);assert.deepEqual([...c.templateShapeInstances({rk:1,parts:[part]},{mirrorX:true})],['direct','mirror']);
});
test('real diamond projections materialize the exact displayed cells and preserve their RGBA',async()=>{
  for(const mode of ['romb0','romb1','romb2','rombJoin','rombJoin180','joined180']){
    const f=fixture({rk:3}),{c}=f;c.st.view=mode==='joined180'?'bits':mode;c.st.joined180=mode==='joined180';c.f.val.fill(-1);c.f.val[2*c.f.W+4]=0;c.f.val[2*c.f.W+9]=1;
    Object.assign(c,{joinedCache:null,MayatnikJoinedRomb:require('./mayatnik-joined-romb.js'),joinedOn:()=>!!c.st.joined180||mode.startsWith('rombJoin'),rombP:()=>mode==='romb0'?0:mode==='romb1'?1:mode==='romb2'?2:3});
    const rot=html.indexOf('  const joinedRotated =');vm.runInContext(html.slice(rot,html.indexOf('\n',rot)),c);
    c.halfOf=fx=>c.rombP()!==2?[c.rombP(),fx]:fx<c.VW?[0,fx]:fx>=c.VW+c.RG?[1,fx-c.VW-c.RG]:null;
    for(const name of ['joinedGeometry','rombCell','displayCell','displayPoint','fieldCellAt','cellPixels'])vm.runInContext(production(name),c);
    const width=(c.joinedOn()?c.joinedGeometry().width:mode==='romb2'?2*c.VW+c.RG:c.VW)*c.RK,height=(c.joinedOn()?c.joinedGeometry().height:c.VH)*c.RK;
    const pixels=Uint32Array.from({length:width*height},(_,i)=>(0xff000000|i*431+777)>>>0);c.img={width,height,data:new Uint8ClampedArray(pixels.buffer)};
    c.fillBit=(x,y)=>{const cell=c.fieldCellAt(x,y);return cell?c.f.val[cell.r*c.f.W+cell.c]:-1;};
    const matches=(mode==='romb0'?[4]:mode==='romb1'?[9]:[4,9]).map(x=>({x,y:2,width:1,height:1,patternIndex:0,bit:x===4?0:1}));
    const result=await c.materializeTemplateMatches({field:{data:c.f.val},patterns:[M.compile({width:1,height:1,data:[1]})],matches,instances:[],shape:{searchProjection:c.templateMatchProjection()}},()=>false);
    assert.equal(result.createdCount,matches.length,mode);
    for(let i=0;i<c.templateItems.length;i++)for(const part of c.templateItems[i].parts){const m=part.mask;assert.ok(m.count>0,mode);for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(m.data[y*m.width+x]){const cell=c.fieldCellAt(m.x+x,m.y+y);assert.equal(cell.c,matches[i].x,mode);assert.equal(cell.r,2,mode);assert.equal(m.data[y*m.width+x],pixels[(m.y+y)*width+m.x+x],mode);}}
  }
});
test('a projection change during a yielded preparation aborts with no additions or history',async()=>{
  const f=fixture(),{c}=f;const mask={x:0,y:0,width:100,height:100,data:new Uint32Array(10000).fill(0xff123456)};
  c.templateItems=[{id:'large',view:{height:100,down:0,x:0,visible:true},parts:[{mask,axis:50}]}];c.st.templateMaxArea=20000;c.setTimeout=fn=>{c.st.view='col';fn();};
  const request=await f.request();await assert.rejects(c.materializeTemplateMatches(request,()=>false),{name:'AbortError'});assert.equal(c.templateItems.length,1);assert.equal(c.fillHistory.length,0);
});
test('real engine + materializer acknowledge their own history revision and follow later CPU/GPU frames without duplicates',async()=>{
  const Follow=require('./mayatnik-template-follow.js');global.MayatnikTemplateMatcher=M;const Engine=require('./mayatnik-template-engine.js');
  for(const gpu of [false,true]){
    const {c}=fixture();c.paintBits=null;if(gpu)c.gpuBig={fresh:true,k:c.k,cpuRaster:true};c.playing=true;let searches=0,stops=0,focus=0;
    for(const name of ['templateMatchRows','templateMatchCurrent','templateMatchField'])vm.runInContext(''+(name==='templateMatchField'?'async ':'')+production(name).replace(/^\s*async /,''),c);
    c.templateFollowScope=()=>({owner:c.f,key:c.k+':'+c.templateMatchRevision});
    const engine=Engine.create({entries:()=>[],field:c.templateMatchField,current:c.templateMatchCurrent,shapeInstances:()=>[],stop(){stops++;},redrawSelection(){},focus(){focus++;},materializeMatches:async(req,cancelled)=>{searches++;return c.materializeTemplateMatches(req,cancelled);}});
    const follow=Follow.create({capture:c.templateFollowScope,search:(shape,cancelled)=>engine.selectShape({...shape,searchProjection:c.templateMatchProjection()},{materialize:true,mirrorX:true,follow:true,cancelled})},{on:true,source:Follow.pack({rk:1,parts:[part]},M.compile)});
    await follow.ensure();assert.equal(follow.complete,true);assert.equal(c.templateItems.length,2);assert.equal(c.templateMatchRevision,1);assert.equal(searches,1);await follow.ensure();assert.equal(searches,1);
    c.k++;if(gpu)c.gpuBig.k=c.k;await follow.ensure();assert.equal(searches,2);assert.equal(follow.complete,true);assert.equal(c.templateItems.length,2);assert.equal(c.templatePickedIds.size,2);assert.equal(stops,0);assert.equal(focus,0);assert.equal(c.playing,true);
    follow.off();assert.equal(c.templateItems.length,2);
  }
});
test('new and reused matches get source-relative orientation; metadata-only correction has atomic undo/redo',async()=>{
 const host=fixture(),{c}=host;const original=c.f.val.slice(),pixels=Uint8ClampedArray.from(c.img.data);
 await c.materializeTemplateMatches(await host.request(),()=>false);assert.deepEqual(c.templateItems.map(t=>t.matchOrientation),['direct','mirror']);const ids=c.templateItems.map(t=>t.id);
 c.templateItems[0].matchOrientation='mirror';c.templateItems[1].matchOrientation='direct';const before=c.fillHistory.length;
 const again=await c.materializeTemplateMatches(await host.request(),()=>false);assert.equal(again.createdCount,0);assert.deepEqual(c.templateItems.map(t=>t.id),ids);assert.deepEqual(c.templateItems.map(t=>t.matchOrientation),['direct','mirror']);assert.equal(c.fillHistory.length,before+1);
 c.historyStep(false);assert.deepEqual(c.templateItems.map(t=>t.matchOrientation),['mirror','direct']);c.historyStep(true);assert.deepEqual(c.templateItems.map(t=>t.matchOrientation),['direct','mirror']);
 const count=c.fillHistory.length;await c.materializeTemplateMatches(await host.request(),()=>false);assert.equal(c.fillHistory.length,count);assert.deepEqual(c.f.val,original);assert.deepEqual(c.img.data,pixels);
});
test('orientation survives real work serialization and the production template restore path; legacy metadata stays absent',async()=>{
 const host=fixture(),{c}=host;await c.materializeTemplateMatches(await host.request(),()=>false);
 Object.assign(c,{structuredClone,manualPaintSnapshot:()=>null,autoPaintIds:[],mirrorLive:false,mirrorXor:false});vm.runInContext(production('paintSnapshot'),c);
 const Work=require('./mayatnik-work-file.js'),saved=await Work.decode(await Work.encode(c.paintSnapshot()));assert.deepEqual(saved.data.templates.map(t=>t.matchOrientation),['direct','mirror']);
 const start=html.indexOf('      templateItems=data.schema===2?'),end=html.indexOf('      if(Array.isArray(data.library))',start);c.data=saved.data;vm.runInContext(html.slice(start,end),c);assert.deepEqual([...c.templateItems].map(t=>t.matchOrientation),['direct','mirror']);
 delete c.data.templates[0].matchOrientation;c.data.templates[1].matchOrientation='unknown';vm.runInContext(html.slice(start,end),c);assert.equal(c.templateItems[0].matchOrientation,undefined);assert.equal(c.templateItems[1].matchOrientation,undefined);
});
test('stale preparation never changes existing orientation metadata or adds a history entry',async()=>{
 const host=fixture(),{c}=host;await c.materializeTemplateMatches(await host.request(),()=>false);c.templateItems[0].matchOrientation='mirror';const request=await host.request(),before=c.fillHistory.length;
 await assert.rejects(c.materializeTemplateMatches(request,()=>true),{name:'AbortError'});assert.equal(c.templateItems[0].matchOrientation,'mirror');assert.equal(c.fillHistory.length,before);
});
