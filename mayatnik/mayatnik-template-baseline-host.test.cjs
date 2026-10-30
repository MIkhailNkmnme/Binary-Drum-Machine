const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Baseline=require('./mayatnik-template-baseline.js'),Transient=require('./mayatnik-template-transient.js'),Follow=require('./mayatnik-template-follow.js'),Matcher=require('./mayatnik-template-matcher.js'),Template=require('./mayatnik-template.js');
const html=fs.readFileSync(process.env.MAYATNIK_HOST_HTML||__dirname+'/Zerkalius-mayatnik.html','utf8');
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let d=1,i=b+1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return html.slice(a,i);}
function fixture(gpu=false){
 const controls=new Map(),N=48,W=8,mask={x:1,y:1,width:2,height:2,data:Uint32Array.of(100,100,100,0)},source=Int8Array.from({length:N},(_,q)=>q%3===0?-1:q%2),item={hex:'#112233',parts:[{mask,axis:2,p:-1,ox:0}],paintSource:true},library=[{id:'saved',shape:{parts:[{data:[100]}]}}],layers=new Map([['other',{id:'other',kind:'snapshot',x:8,y:9}]]),c={
  window:{},MayatnikTemplateBaseline:Baseline,MayatnikTemplate:Template,MayatnikTemplateAxisTurn:require('./mayatnik-template-axis-turn.js'),MayatnikPaintCache:{write:async()=>{}},
  f:{W,H:6,val:source},geo:{anchor:2},k:3,target:3,img:{width:W,height:6},RK:1,VW:W,VH:6,fillKey:'3:flat:0:8:6:1',fillField:null,fillMask:new Uint32Array(N),paintBits:null,fillBits:null,fillBase:true,paintStash:new Map(),fillHistory:[],fillRedo:[],fillHistoryBytes:0,
  templateItems:[],templateSerial:0,colourTemplate:item,templatePickedIds:new Set(),templatePaintLayer:null,templateMatchLayer:null,templateMatchCache:null,templateMatchRevision:0,templateLibrary:library,removedTemplateIds:new Set(),templateDragging:null,templateHistoryCapture:null,templateHover:null,templateReturn:null,
  templateMove:true,templateVisible:true,templateTransfer:false,templateAxisUnlocked:false,templatePaintBit:1,templateOffsetX:0,templateLastDown:0,templateStatsKey:'',templateFindOnceRun:0,templateFindOnceRunning:false,templateFindNotify:false,templateTransient:Transient.create(),templateTransientCanvas:{style:{}},
  templateLocks:{items:{old:{}},masks:{old:{}},paint:{77:[50,2]}},st:{templateLock:true},gpuBig:gpu?{}:null,mirrorLine:false,templateAxisMove:null,templateAxisControls:{hide(){}},
  $:id=>{if(!controls.has(id))controls.set(id,{value:id==='templateHeight'?100:id==='templateAlpha'?50:0,checked:false,disabled:false,dataset:{},setAttribute(key,value){this[key]=value;}});return controls.get(id);},
  draw(){c.draws=(c.draws||0)+1;},queueDigits(){},savePaint(){c.saves=(c.saves||0)+1;},lockSave(){},templateFallStop(){},templatePaintSync(){},fieldTemplateList(){},templateAxesChanged(){},xorMax:()=>6,fillSync(){},templateItemAllowed:()=>true,templateLimitRefusal(){},autoSync(){},stop(){},scale:()=>1,dispW:()=>8,dispH:()=>6,joinedOn:()=>false,
  rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,
  rasterBit:(x,y,original=false)=>{const q=y*W+x;return !original&&(c.paintBits?.[q]??-1)>=0?c.paintBits[q]:c.f.val[q]??-1;},
  sceneSnapshot:()=>({items:c.templateItems,library,hidden:[],manualPaint:null}),
  pushHistory:entry=>{c.window.mayTemplateBaseline.history(entry);c.fillHistory.push(entry);c.fillHistoryBytes+=entry.bytes||0;},
  templateFollowScope:()=>({owner:c.f,key:c.k+'|'+c.templateMatchRevision})
 };
 c.window.mayTemplateLibrary={clear(){c.libraryClears=(c.libraryClears||0)+1;}};c.window.mayLayers={list:()=>[...layers.values()],_drop:id=>layers.delete(id)};
 const pinned=Follow.pack({rk:1,parts:[{width:1,height:1,data:[1]}]},Matcher.compile);c.templateFollow=Follow.create({capture:c.templateFollowScope,search:async()=>{c.searches=(c.searches||0)+1;}},{on:true,source:pinned});
 vm.createContext(c);const a=html.indexOf('  // Originals and paint ownership are runtime state,'),b=html.indexOf('  // Delete is a session-only',a);assert.ok(a>=0,'baseline host integration');vm.runInContext(html.slice(a,b),c);
 for(const name of ['rememberTemplate','selectTemplate','registerTemplate','duplicateTemplate','templateOptions','templateRect','templatePartWidth','templateSync','liftTemplateSource','traceTemplate','trailUndo','xorNextLevel'])vm.runInContext(fn(name),c);
 c.registerTemplate('original');c.fillField=c.f;for(const q of [9,10,17])c.fillMask[q]=100;c.fillMask[0]=888;
 return {c,item,source:source.slice(),library,layers,api:c.window.mayTemplateBaseline,pinned:JSON.stringify(c.templateFollow.snapshot().source)};
}
test('actual lift/trace/XOR plus rotation, scale, colour, axes and Delete reset to the original instance and preserve library/source',()=>{
 for(const gpu of [false,true]){const f=fixture(gpu),{c,item}=f;c.liftTemplateSource(true);c.$('templateDown').value=2;c.templateLastDown=2;c.traceTemplate(0,2);c.xorNextLevel(1);
  c.$('templateHeight').value=200;c.$('templateAlpha').value=90;item.hex='#ffffff';item.templateAxes={manualH:{visible:true,position:77}};item.parts=Array.from({length:3},()=>({...item.parts[0],axisOriginY:1,mask:{...item.parts[0].mask,data:Uint32Array.of(55,55,55,55)}}));
  const copy=c.duplicateTemplate();f.layers.set('template:'+copy.id,{id:'template:'+copy.id,kind:'template',x:9,y:7});c.templatePaintLayer={colours:{[item.id]:'#654321'}};c.templateMatchLayer={indices:Uint32Array.of(5)};
  c.templateTransient.hide([{mask:{width:1,height:1,data:[1]},rect:{x:1,y:1,width:1,height:1}}],[item.id]);assert.equal(f.api.reset(),true);
  assert.equal(c.templateItems.length,1);const original=c.templateItems[0];assert.equal(original.id,item.id);assert.equal(original.hex,'#112233');assert.equal(original.parts.length,1);assert.deepEqual([...original.parts[0].mask.data],[100,100,100,0]);assert.equal(original.parts[0].bitsData,undefined);assert.equal(original.templateAxes,undefined);assert.equal(original.view.height,100);assert.equal(original.view.down,0);assert.equal(original.view.alpha,50);
  assert.equal(c.templateTransient.active,false);assert.equal(c.templatePaintLayer,null);assert.equal(c.templateMatchLayer,null);assert.equal(c.fillMask[0],888);for(const q of [9,10,17])assert.equal(c.fillMask[q],100);assert.ok(!c.paintBits||c.paintBits.every(v=>v===-1));assert.deepEqual(c.f.val,f.source);assert.equal(c.templateLibrary,f.library);assert.equal(JSON.stringify(c.templateFollow.snapshot().source),f.pinned);assert.equal(c.templateFollow.on,true);assert.deepEqual([...f.layers.keys()],['other']);
 }
});
test('manual paint after template edits, including equal colours, remains and its Undo is rebased to the original field',()=>{
 const f=fixture(),{c}=f;c.liftTemplateSource(true);f.api.write(9,777,1);const manual={indices:Uint32Array.of(9),previous:Uint32Array.of(777),next:Uint32Array.of(777),bytes:12};c.fillMask[9]=777;c.pushHistory(manual);
 c.fillHistory.push({templateOwned:true,transientView:{},indices:new Uint32Array(0),bytes:12});f.api.reset();assert.equal(c.fillMask[9],777);assert.equal(c.fillHistory.length,1);assert.equal(c.fillHistory[0].previous[0],100);assert.equal(c.fillHistory[0].next[0],777);assert.ok(!c.paintBits||c.paintBits[9]===-1);
});
test('frame departure clears all template instances/effects before stash and returning cannot resurrect them; manual caches and persistent Find all survive',async()=>{
 const f=fixture(),{c}=f;c.liftTemplateSource(true);const geometryKey='3:joined:0:8:6:1';const colour=Uint32Array.of(9,8),bits=Int8Array.of(-1,-1);c.paintStash.set(geometryKey,{fillMask:colour,paintBits:bits,templateItems:[{...f.item,id:'viewcopy'}],templatePaintLayer:{colours:{viewcopy:'#ffffff'}},faceLayer:{manual:true}});
 f.api.frame(4);assert.equal(c.templateItems.length,0);assert.equal(c.paintStash.get(geometryKey).templateItems.length,0);assert.equal(c.paintStash.get(geometryKey).templatePaintLayer,null);assert.equal(c.paintStash.get(geometryKey).fillMask,colour);assert.deepEqual(c.paintStash.get(geometryKey).faceLayer,{manual:true});assert.equal(c.fillMask[9],100);assert.equal(Object.keys(c.templateLocks.items).length,0);assert.equal(Object.keys(c.templateLocks.masks).length,0);assert.deepEqual(c.templateLocks.paint,{77:[50,2]});
 c.k=4;await c.templateFollow.ensure();assert.equal(c.searches,1);f.api.frame(3);c.k=3;assert.equal(c.templateItems.length,0);assert.equal(c.templateFollow.on,true);assert.equal(JSON.stringify(c.templateFollow.snapshot().source),f.pinned);assert.equal(c.templateLibrary,f.library);assert.deepEqual(c.f.val,f.source);
});
test('Reset stays enabled with no active selection and has no generic capture wrapper to create duplicate Undo',()=>{
 const {c,item,api}=fixture();c.selectTemplate(null,false);c.templateSync();assert.equal(c.$('bTemplateReset').disabled,false);api.reset();assert.equal(c.templateItems[0].id,item.id);
 const line=html.split('\n').find(line=>line.includes('const historyButtons='));assert.ok(!line.includes("'bTemplateReset'"));assert.match(html,/Отменить все изменения полевых шаблонов/);
});
function turningFixture(){const f=fixture(),c=f.c;c.f.val.fill(1);f.source=c.f.val.slice();c.window.mayLayers.get=id=>f.layers.get(id);
 c.fieldCellAt=(x,y)=>x>=0&&y>=0&&x<8&&y<6?{c:Math.floor(x),r:Math.floor(y)}:null;c.templateMatchKey=()=>c.k+':field';
 c.document={createElement:()=>({getContext:()=>({putImageData(){}})})};c.ImageData=function(data,width,height){Object.assign(this,{data,width,height});};c.mirrorLive=false;c.manualPaintRevision=0;c.colReplayRestore=()=>{};c.persistLibrary=()=>{};
 c.sceneSnapshot=()=>({items:c.templateItems.map(item=>({...item,view:{...item.view}})),matches:c.templateMatchLayer,templatePaint:c.templatePaintLayer,active:c.colourTemplate?.id,picked:[...c.templatePickedIds],library:f.library,hidden:[],manualPaint:null});
 c.templateAxisCommit=before=>{c.templateMatchRevision++;c.pushHistory({indices:new Uint32Array(),previous:new Uint32Array(),next:new Uint32Array(),beforeScene:before,afterScene:c.sceneSnapshot(),bytes:1024,templateOwned:true});};
 for(const name of ['templateAxisState','flipParts','turnTemplateAxis','historyStep'])vm.runInContext(fn(name),c);return f;
}
test('axis turn vacates only the original field silhouette once; repeated same-axis turns return the same item and one Undo restores source',()=>{
 for(const gpu of [false,true]){const f=turningFixture(),c=f.c;c.gpuBig=gpu?{}:null;const id=c.colourTemplate.id,original=c.colourTemplate.parts[0].mask.data.slice(),initialRect=c.templateRect(c.colourTemplate.parts[0]);
  assert.equal(c.turnTemplateAxis('right'),true);assert.equal(c.templateItems.length,1);assert.equal(c.colourTemplate.id,id);assert.deepEqual([...c.templateMatchLayer.indices].sort((a,b)=>a-b),[9,10,17]);assert.equal(c.templateMatchLayer.bits[18],2,'transparent hole is untouched');assert.equal(c.templateMatchLayer.bits[11],2,'intermediate destination is not erased');assert.equal(c.fillHistory.length,1);
  const cut=c.templateMatchLayer;assert.equal(c.turnTemplateAxis('right'),true);assert.equal(c.templateMatchLayer,cut,'second turn does not erase a new underlay');assert.deepEqual(c.templateRect(c.colourTemplate.parts[0]),initialRect);assert.deepEqual([...c.colourTemplate.parts[0].mask.data],[...original]);assert.equal(c.templateItems.length,1);
  assert.equal(c.historyStep(false),true);assert.equal(c.templateMatchLayer,cut);assert.equal(c.historyStep(false),true);assert.equal(c.templateMatchLayer,null);assert.equal(c.colourTemplate.sourceVacated,undefined);assert.deepEqual(c.f.val,f.source);
  assert.equal(c.historyStep(true),true);assert.equal(c.templateMatchLayer,cut);f.api.reset();assert.equal(c.templateMatchLayer,null);assert.equal(c.templateItems[0].sourceVacated,undefined);assert.equal(c.templateItems[0].templateAxes,undefined);
 }
});
test('library insertions and explicit copies never vacate unrelated underlying field bits',()=>{
 for(const sourceKind of ['library','copy']){const f=turningFixture(),c=f.c;c.colourTemplate.sourceKind=sourceKind;c.colourTemplate.sourcePreserving=true;assert.equal(c.turnTemplateAxis('right'),true);assert.equal(c.templateMatchLayer,null);assert.equal(c.colourTemplate.sourceVacated,undefined);assert.deepEqual(c.f.val,f.source);}
});
test('vacated source is absent from real CPU/GPU matcher snapshots and base rendering, while holes and source bits remain unchanged',async()=>{
 for(const gpu of [false,true]){const f=turningFixture(),c=f.c;c.gpuBig=gpu?{fresh:true,k:c.k}:null;c.bmGen=0;c.templateMatchRows=()=>6;c.templateMatchCurrent=()=>true;c.EMPTY=[5,7,11];c.lockCell=(pixels,q,colour)=>pixels[q]=colour;
  vm.runInContext('async '+fn('templateMatchField')+'\n'+fn('templateMatchApply'),c);c.turnTemplateAxis('right');const snapshot=await c.templateMatchField();for(const q of [9,10,17])assert.equal(snapshot.data[q],-1);assert.equal(snapshot.data[18],1);
  const pixels=new Uint32Array(48).fill(123);c.templateMatchApply(pixels);for(const q of [9,10,17])assert.equal(pixels[q],c.rgba(c.EMPTY));assert.equal(pixels[18],123);assert.deepEqual(c.f.val,f.source);
 }
});
