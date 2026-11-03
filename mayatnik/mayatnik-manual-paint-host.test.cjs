const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Pattern=require('./mayatnik-manual-paint-pattern.js'),html=fs.readFileSync(__dirname+'/Zerkalius-mayatnik.html','utf8');
test('legacy work without new display and paint flags does not inherit the previous work modes',()=>{
 const a=html.indexOf('if(supplied){if(data.frameHost)st=structuredClone(data.st);'),b=html.indexOf('if(data.frameHost){restoreFrameEffects',a);assert.ok(a>0&&b>a);
 for(const value of [undefined,false,true]){
  const ctx={supplied:true,data:{st:value===undefined?{rows:512}:{rows:512,fillWholeColour:value,edgeRhombOn:value}},st:{fillWholeColour:true,edgeRhombOn:true},structuredClone,MayatnikPaintRepeat:require('./mayatnik-paint-repeat.js')};
  vm.runInNewContext(html.slice(a,b),ctx);assert.equal(ctx.st.fillWholeColour,!!value);assert.equal(ctx.st.edgeRhombOn,!!value);
 }
});
function fn(name){const a=html.indexOf('function '+name+'('),b=html.indexOf('{',a);assert.ok(a>=0,name);let i=b+1,d=1;for(;d;i++){if(html[i]==='{')d++;if(html[i]==='}')d--;}return (html.slice(Math.max(0,a-6),a)==='async '?'async ':'')+html.slice(a,i);}
function fixture({W=8,H=5,VX=1,VW=6,VH=3}={}){
 const nodes=new Map(),c={Uint32Array,Int8Array,Uint8Array,Map,Set,structuredClone,performance,setTimeout,window:{},st:{view:'bits',fillArea:'bit',blackMirror:0},f:{W,H,val:Int8Array.from({length:W*H},(_,q)=>q%2)},geo:{anchor:3},k:2,bmGen:0,VX,VW,VH,RK:1,RG:0,
  gpuBig:null,gpuPaintRequests:0,pxHide:new Set(),fillField:null,fillKey:null,paintRepeatSeed:null,paintRepeatPending:null,paintRepeatLayer:null,manualPaintState:null,manualPaintRevision:0,manualPatternBusy:false,manualSemanticRequested:0,manualPatternAuto:{serial:0,pending:null,running:null},manualPaintFrames:new Map(),contourBits:null,currentManualMirrorMap:null,templatePaintLayer:null,fillBase:null,fillMask:null,paintBits:null,faceLayer:null,third:null,templateMatchLayer:null,
  fillHistory:[],fillRedo:[],fillHistoryBytes:0,mirrorLive:false,mirrorApplying:false,templateDragging:false,templateMatchRevision:0,templateMatchCache:null,templateStatsKey:'',fillBits:null,templateItems:[],templatePickedIds:new Set(),templateLibrary:[],removedTemplateIds:new Set(),colourTemplate:null,colReplay:[],colReplayPaint:null,
  img:{width:VW,height:VH,data:new Uint8ClampedArray(VW*VH*4)},colour:'#123456',playing:false,autoVertical:0,MayatnikPaintRepeat:require('./mayatnik-paint-repeat.js'),MayatnikManualPaintPattern:Pattern,MayatnikIsolatedBits:require('./mayatnik-isolated-bits.js'),MayatnikJoinedRomb:require('./mayatnik-joined-romb.js'),MayatnikFaceTransform:{find:()=>-1},MayatnikPaintCache:{write:()=>Promise.resolve()},
  $:id=>{if(!nodes.has(id))nodes.set(id,{value:'#123456',checked:false,dataset:{},textContent:'',setAttribute(k,v){this[k]=v;}});return nodes.get(id);},cv:{getBoundingClientRect:()=>({left:0,top:0,width:VW,height:VH})},rombP:()=>-1,joinedOn:()=>false,manualMirrorPlan:()=>[],faceCurrent:()=>false,fieldSourceKey:()=> 'fixture',parityVisible:()=>true,outShow:()=>false,pxHidden:()=>false,templateMatchKey:()=>'',navQuick:()=>false,stopFrameTransports(){c.playing=false;},
  displayCell:(x,y)=>{const col=VX+Math.floor(x),r=Math.floor(y);return col<VX||col>=VX+VW||r<0||r>=VH?null:{c:col,r,p:-1,q:r*W+col};},displayPoint:(col,r)=>({x:col-VX+.5,y:r+.5}),
  rasterBit:(x,y)=>{const a=c.fieldCellAt(x,y);return a?c.f.val[a.q]:-1;},fieldCellAt:(x,y)=>c.displayCell(x+.5,y+.5),cellPixels:(cell,visit)=>{if(cell.c>=VX&&cell.c<VX+VW&&cell.r<VH)visit(cell.r*VW+cell.c-VX);},
  paintSelection:(x,y)=>({indices:c.selected||Uint32Array.of(y*VW+x)}),lockColourAt:()=>0,lockErase(){},lockWipe(){},fillSync(){},cssLayout(){},save(){},clearFillPreview(){},savePaint(){},rememberTemplate(){},colReplaySnapshot:()=>[],colReplayRestore(){},selectTemplate(){},persistLibrary(){},rgba:rgb=>(0xff000000|rgb[2]<<16|rgb[1]<<8|rgb[0])>>>0,paintToolColour:()=>c.colour,
  g:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)})}};
 c.manualPaintCellAt=(x,y)=>{const a=c.fieldCellAt(x,y);return a?c.displayPoint(a.c,a.r):null;};
 c.parityPlan=()=>({sourceRow:r=>r,visible:(r,col)=>c.parityVisible(r,col),settings:{rowFill:'none'}});
 c.parityValues=()=>c.f.val;c.parityRow=r=>r;
 c.draw=()=>{c.manualPaintFrameSync();c.contourBits=Int8Array.from({length:VW*VH},(_,q)=>c.f.val[Math.floor(q/VW)*W+VX+q%VW]);const pixels=new Uint32Array(c.img.data.buffer);pixels.fill(0xff555555);if(c.fillMask)for(let q=0;q<pixels.length;q++)if(c.fillMask[q])pixels[q]=c.fillMask[q];c.manualPaintLayerApply(pixels);};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('  const joinedWhole ='),html.indexOf('  const rombP =')),c);const a=html.indexOf('  function paintRepeatScope('),b=html.indexOf('  // Colour from the same geometric axes',a);vm.runInContext(html.slice(a,b),c);
 for(const name of ['fillAt','paintWholeColour','paintWholeColourLayer','eraseFillAt','pushHistory','paintHistoryCurrent','sceneSnapshot','editSnapshot','finishEdit','historyStep'])vm.runInContext(fn(name),c);
 const clearStart=html.indexOf("  $('bFillClear').onclick="),clearEnd=html.indexOf("  $('bRegions').onclick",clearStart);vm.runInContext(html.slice(clearStart,clearEnd),c);
 c.paint=(x,y,colour='#123456',force=true)=>{c.$('fillColour').value=colour;c.fillAt(x+.1,y+.1,false,force);};c.draw();return c;
}
test('Весь цвет compares final RGB across gaps, respects the mask, and restores a single stroke',async()=>{
 const c=fixture({W:7,H:1,VX:0,VW:7,VH:1}),rgb=0xff118822,near=0xff118823,chosen=c.rgba([18,52,86]);
 const displayed=Uint32Array.of(rgb,near,0x99118822,near,rgb,near,rgb);
 c.pxView=()=>({data:new Uint8ClampedArray(displayed.buffer)});
 c.st.fillWholeColour=true;c.st.triangleMapMask=true;c.triangleMapRasterMask=()=>Uint8Array.of(0,0,0,0,1,0,0);
 c.fillKey='geometry';c.$('fillMirror').checked=true;c.fillMask=Uint32Array.of(0,0,0xff556622,0,0,0,0);
 const previous=c.fillMask.slice(),bits=c.f.val.slice();c.paint(0,0);
 assert.deepEqual([...c.fillHistory[0].indices],[0,2,6]);assert.equal(c.fillHistory.length,1);
 const painted=Uint32Array.of(chosen,0,chosen,0,0,0,chosen);
 assert.deepEqual(c.fillMask,painted);assert.deepEqual(c.f.val,bits);assert.equal(c.paintBits,null);
 const overlay=displayed.slice();c.paintWholeColourLayer(overlay);assert.equal(overlay[2],chosen);assert.equal(overlay[4],rgb);
 const Work=require('./mayatnik-work-file.js'),Settings=require('./mayatnik-settings-library.js');
 const work=(await Work.decode(await Work.encode({fill:c.fillMask,manualPattern:c.manualPaintSnapshot()}))).data;
 assert.deepEqual(work.fill,painted);assert.ok(work.manualPattern.wholeColour.marked instanceof Uint8Array);
 c.manualPaintRestore(work.manualPattern);assert.deepEqual(c.manualPaintSnapshot().wholeColour.marked,work.manualPattern.wholeColour.marked);
 const settings=Settings.pick(c.st),restored={};Settings.applyState(restored,settings);assert.equal(restored.fillWholeColour,true);
 assert.equal(c.historyStep(false),true);assert.deepEqual(c.fillMask,previous);assert.equal(c.manualPaintCurrent().wholeColour,undefined);
 assert.equal(c.historyStep(true),true);assert.deepEqual(c.fillMask,painted);
 displayed[0]=chosen;c.paint(0,0);assert.equal(c.fillHistory.length,1);assert.deepEqual(c.fillMask,painted);
});
test('ordinary manual fill records actual selected bits and colours; automatic operations do not expand the sample',async()=>{
 const c=fixture(),source=c.f.val.slice();c.paint(0,0);c.paint(1,0,'#abcdef');const before=JSON.stringify(c.manualPaintState.source.sample),history=c.fillHistory.length;
 assert.deepEqual(c.manualPaintState.source.sample.cells.map(x=>x.bit),[1,0]);const r=await c.manualPatternApply('same');assert.ok(r.changed>0);assert.equal(c.fillHistory.length,history+1);assert.equal(JSON.stringify(c.manualPaintState.source.sample),before);assert.deepEqual(c.f.val,source);
 assert.ok(c.manualPaintState.layer.paint[4*c.f.W+5],'unshown rows and columns participate');const repeated=await c.manualPatternApply('same');assert.equal(repeated.changed,0);assert.equal(c.fillHistory.length,history+1);assert.equal(JSON.stringify(c.manualPaintState.source.sample),before);
});
test('Symmetric uses the real anchor rather than crop midpoint and changes only matching bits in the same row',async()=>{
 const c=fixture();c.paint(0,1);const r=await c.manualPatternApply('mirror'),paint=c.manualPaintState.layer.paint;assert.equal(r.selectedCount,1);assert.equal(paint[1*8+5],0xff563412);assert.equal(paint[0*8+5],0);assert.equal(paint[1*8+6],0);
});
test('manual fill, propagation and Clear each restore provenance and derived paint with the same Undo/Redo',async()=>{
 const c=fixture();c.paint(0,0);const sample=c.manualPaintState.source,manualMask=c.fillMask.slice();c.historyStep(false);assert.equal(c.manualPaintState.source,null);c.historyStep(true);assert.equal(c.manualPaintState.source,sample);assert.deepEqual(c.fillMask,manualMask);
 await c.manualPatternApply('same');const layer=c.manualPaintState.layer;c.historyStep(false);assert.equal(c.manualPaintState.layer,null);assert.equal(c.manualPaintState.source,sample);c.historyStep(true);assert.equal(c.manualPaintState.layer,layer);
 c.$('bFillClear').onclick();assert.equal(c.manualPaintState.source,null);assert.equal(c.manualPaintState.layer,null);c.historyStep(false);assert.equal(c.manualPaintState.source,sample);assert.equal(c.manualPaintState.layer,layer);c.historyStep(true);assert.equal(c.manualPaintState.source,null);
});
test('area fill records every painted bit; manual erasure removes ownership, while Columns bypass provenance',()=>{
 const c=fixture();c.selected=Uint32Array.of(0,1,6);c.paint(0,0);assert.equal(c.manualPaintState.source.sample.cells.length,3);c.paint(0,0,'#123456',false);assert.equal(c.manualPaintState.source.sample.cells.length,0);
 c.autoVertical=1;c.columnSeed=()=>({c:1,bit:1});c.columnSelection=()=>({indices:Uint32Array.of(0)});c.colReplayEdit=()=>false;c.paint(0,0);assert.equal(c.manualPaintState.source.sample.cells.length,0);
});
test('snapshot reload restores explicit provenance; legacy files leave an empty sample and a clear message',async()=>{
 const c=fixture();c.paint(0,0);await c.manualPatternApply('same');const stored=structuredClone(c.manualPaintSnapshot()),expected=c.manualPaintState.layer.paint.slice();c.manualPaintClear();c.manualPaintRestore(stored);assert.deepEqual(c.manualPaintState.layer.paint,expected);assert.equal(c.manualPaintState.source.sample.cells.length,1);
 c.manualPaintRestore(null);await c.manualPatternApply('same');assert.equal(c.manualPaintState.source,null);assert.match(c.$('fillInfo').textContent,/Нет образца ручной краски/);
});
test('full GPU read completes before propagation and one Undo/Redo preserves its logical layer',async()=>{
 const c=fixture();c.paint(0,0);const render=c.draw;c.gpuBig={fresh:false,k:1,snapshotPending:{}};c.draw=()=>{if(!c.gpuBig.fresh){setTimeout(()=>{c.gpuBig.fresh=true;c.gpuBig.k=2;c.gpuBig.snapshotPending=null;render();},1);return;}render();};
 const r=await c.manualPatternApply('same');assert.ok(r.changed);const layer=c.manualPaintState.layer;c.historyStep(false);assert.equal(c.manualPaintState.layer,null);c.historyStep(true);assert.equal(c.manualPaintState.layer,layer);assert.equal(c.gpuPaintRequests,0);
});
test('a setting change during yielded matching aborts before a layer/history commit',async()=>{
 const c=fixture({W:257,H:65,VX:0,VW:257,VH:65});c.paint(0,0);const before=c.manualPaintState,history=c.fillHistory.length;
 c.MayatnikManualPaintPattern={...Pattern,find:(field,sample,opts)=>Pattern.find(field,sample,{...opts,budgetMs:0,yieldTask:async()=>{c.st.view='romb0';}})};const r=await c.manualPatternApply('same');assert.equal(r.changed,0);assert.equal(c.manualPaintState,before);assert.equal(c.fillHistory.length,history);
});
test('visible semantic snapshot retains shifted COPY fragments even when fieldCellAt has no base-grid cell',()=>{
 const c=fixture();c.rombP=()=>0;c.contourBits[0]=1;c.displayCell=()=>null;c.fieldCellAt=()=>null;c.currentManualMirrorMap=()=>({x:1.5,y:.5});const snap=c.visibleSemanticSnapshot();assert.equal(snap.bits[0],1);assert.equal(snap.visibleMask[0],1);assert.deepEqual(snap.cellAt(0,0),{x:1.5,y:.5});
 c.RK=4;assert.equal(snap.cellAt(0,0),null);
});

test('isolated actions need no manual sample, search the full field, and Clear/Undo/Redo preserve one derived layer',async()=>{
 const c=fixture({W:7,H:5,VX:1,VW:4,VH:2});c.f.val.fill(0);for(const q of [8,24,34])c.f.val[q]=1;c.draw();const original=c.f.val.slice();
 const result=await c.isolatedPaintApply(1);assert.equal(result.count,3);assert.equal(result.changed,3);assert.equal(c.fillMask,null);assert.equal(c.manualPaintState.source,null);assert.equal(c.fillHistory.length,1);assert.equal(c.manualPaintState.layer.paint[34],0xff563412);assert.deepEqual(c.f.val,original);
 const layer=c.manualPaintState.layer;c.historyStep(false);assert.equal(c.manualPaintState.layer,null);c.historyStep(true);assert.equal(c.manualPaintState.layer,layer);assert.equal((await c.isolatedPaintApply(1)).changed,0);assert.equal(c.fillHistory.length,1);
 c.$('bFillClear').onclick();assert.equal(c.manualPaintState.layer,null);c.historyStep(false);assert.equal(c.manualPaintState.layer,layer);
});
test('isolated diamond mode tests diagonal sides, excludes the hidden phase, and does not treat corner contact as a neighbour',async()=>{
 for(const phase of [0,1]){
  const c=fixture({W:7,H:5,VX:0,VW:7,VH:5});c.rombP=()=>phase;c.st.view='romb'+phase;c.geo.anchor=0;c.f.val.fill(-1);
  const a=1*7+(phase?2:1),b=3*7+(phase?4:3),d=4*7+(phase?5:4);c.f.val[a]=c.f.val[b]=c.f.val[d]=1;c.f.val[phase?0:1]=1;
  const base=c.fieldCellAt;c.fieldCellAt=(x,y)=>{const cell=base(x,y);return cell&&((cell.c-cell.r)&1)===phase?cell:null;};c.draw();
  const r=await c.isolatedPaintApply(1);assert.equal(r.count,1);assert.equal(c.manualPaintState.layer.paint[a],0xff563412);assert.equal(c.manualPaintState.layer.paint[b],0);assert.equal(c.manualPaintState.layer.paint[d],0);assert.equal(c.manualPaintState.layer.paint[phase?0:1],0);
 }
});
test('joined isolated matching includes the real shared base and maps results back to source cells',async()=>{
 for(const rotate of [false,true]){
  const c=fixture({W:7,H:4,VX:0,VW:7,VH:4});c.st.view=rotate?'rombJoin180':'rombJoin';c.rombP=()=>3;c.joinedOn=()=>true;c.geo.anchor=3;c.f.val.fill(-1);
  const mapping=c.MayatnikJoinedRomb.create({width:7,height:4,anchor:3,rotate});let pair;
  for(let q=0;q<28&&!pair;q++){const a=mapping.fromSource(q);if(a.y!==3)continue;for(const dx of [-1,1]){const b=mapping.inverse(a.x+dx,4);if(b){pair=[a.q,b.q];break;}}}
  assert.ok(pair);for(const q of pair)c.f.val[q]=1;c.draw();const r=await c.isolatedPaintApply(1);assert.equal(r.count,0,'same bits across the join are side-neighbours');assert.equal(c.manualPaintState.layer,null);assert.equal(c.fillHistory.length,0);
 }
});
test('changing the frame while isolated matching yields cancels the complete colour transaction',async()=>{
 const c=fixture({W:257,H:65,VX:0,VW:257,VH:65});const api=c.MayatnikIsolatedBits;c.MayatnikIsolatedBits={...api,findGrid:(field,options)=>api.findGrid(field,{...options,budgetMs:0,yieldTask:async()=>{c.k++;}})};
 const r=await c.isolatedPaintApply(1);assert.equal(r.changed,0);assert.equal(c.fillHistory.length,0);assert.equal(c.manualPaintState.layer,null);
});

test('work-file binary roundtrip retains manual provenance and a derived typed paint layer',async()=>{
 const c=fixture();c.paint(0,0);await c.manualPatternApply('same');const saved=c.manualPaintSnapshot(),Work=require('./mayatnik-work-file.js');
 const decoded=await Work.decode(await Work.encode({manualPattern:saved}));c.manualPaintClear();c.manualPaintRestore(decoded.data.manualPattern);
 assert.deepEqual(c.manualPaintState.source.sample,saved.source.sample);assert.deepEqual(c.manualPaintState.layer.paint,saved.layer.paint);assert.ok(c.manualPaintState.layer.paint instanceof Uint32Array);
});
test('frame changes hide the old sample and logical layer, and returning restores only that frame',async()=>{
 const c=fixture();c.paint(0,0);await c.manualPatternApply('same');const before=c.manualPaintState;c.k++;c.manualPaintFrameSync();assert.equal(c.manualPaintState.source,null);assert.equal(c.manualPaintState.layer,null);c.k--;c.manualPaintFrameSync();assert.equal(c.manualPaintState,before);
});

test('changing only the raster geometry retains safe logical colour Undo entries',async()=>{
 const c=fixture();c.paint(0,0);await c.manualPatternApply('same');c.fillField=c.f;vm.runInContext(fn('resetFillHistory'),c);const layer=c.manualPaintState.layer;c.resetFillHistory();assert.equal(c.fillHistory.length,1);c.historyStep(false);assert.equal(c.manualPaintState.layer,null);c.historyStep(true);assert.equal(c.manualPaintState.layer,layer);
});

test('raster sample retains fragments, RK step and its geometry; a changed projection refuses atomically',async()=>{
 const c=fixture({W:6,H:3,VX:0,VW:6,VH:3});c.joinedOn=()=>true;c.rombP=()=>3;c.st.view='rombJoin';c.RK=2;c.manualMirrorPlan=()=>[{op:0}];c.joinedGeometry=()=>({point:(x,y,p)=>({x:p?6-x:x,y})});c.paint(0,0);assert.equal(c.manualPaintState.source.domain,'raster');const sample=c.manualPaintState.source.sample,api=c.MayatnikManualPaintPattern;let options;
 c.MayatnikManualPaintPattern={...api,find:async(field,source,opts)=>{options=opts;return api.find(field,source,opts);}};await c.manualPatternApply('same');assert.equal(options.step,2);assert.equal(c.manualPaintState.source.sample,sample);
 const before=c.manualPaintState,history=c.fillHistory.length;c.RG++;const result=await c.manualPatternApply('mirror');assert.match(result.error,/Проекция ручного образца изменилась/);assert.equal(c.manualPaintState,before);assert.equal(c.fillHistory.length,history);
});
test('unknown semantic history is rejected rather than guessed from the colour of a previous third',()=>{
 const c=fixture();c.contourBits[0]=-2;assert.throws(()=>c.visibleSemanticSnapshot(),/нет точной истории битов/);
});

test('joined single-cell matching includes every same-bit cell including clipped edge diamonds',async()=>{
 for(const rotate of [false,true]){
  const c=fixture({W:8,H:5,VX:0,VW:8,VH:5});c.st.view=rotate?'rombJoin180':'rombJoin';c.joinedOn=()=>true;c.rombP=()=>3;c.paint(1,0);
  assert.equal(c.manualPaintState.source.domain,'cells');assert.equal(c.manualPaintState.source.sample.cells.length,1);const bit=c.manualPaintState.source.sample.cells[0].bit,expected=Array.from(c.f.val).filter(v=>v===bit).length;
  const r=await c.manualPatternApply('same');assert.equal(r.matches,expected);assert.equal(r.changed,expected);assert.equal(c.manualPaintState.layer.paint.filter(v=>v!==0).length,expected);
  for(let q=0;q<c.f.val.length;q++)assert.equal(!!c.manualPaintState.layer.paint[q],c.f.val[q]===bit);
 }
});

test('joined symmetry uses each displayed row and the transformed central axis in both orientations',async()=>{
 for(const rotate of [false,true]){
  const c=fixture({W:8,H:5,VX:0,VW:8,VH:5});c.st.view=rotate?'rombJoin180':'rombJoin';c.joinedOn=()=>true;c.rombP=()=>3;c.f.val.fill(1);c.draw();c.paint(1,0);c.paint(2,0,'#abcdef');
  const mapping=c.MayatnikJoinedRomb.create({width:8,height:5,anchor:3,rotate}),expected=new Map();for(const cell of c.manualPaintState.source.sample.cells){const from=mapping.fromSource(cell.q),axis=mapping.point(3.5,0,from.p).x,target=mapping.inverse(2*axis-1-from.x,from.y);if(target)expected.set(target.q,cell.colour);}
  const r=await c.manualPatternApply('mirror');assert.equal(r.changed,expected.size);for(let q=0;q<40;q++)assert.equal(c.manualPaintState.layer.paint[q],expected.get(q)||0);
 }
});

test('exact mirrored fragments use the shared-side graph and commit one raster layer without adding a sample',async()=>{
 const c=fixture({W:2,H:1,VX:0,VW:2,VH:1});c.st.view='romb0';c.rombP=()=>0;c.RK=8;c.manualMirrorPlan=()=>[{k:'h',p:.5,m:1,op:''}];c.visibleGraphKnown=()=>{};c.MayatnikVisibleCellGraph=require('./mayatnik-visible-cell-graph.js');c.f.val.set([1,0]);
 c.img={width:16,height:8,data:new Uint8ClampedArray(16*8*4)};c.fieldCellAt=(x,y)=>({c:Math.floor(x/8),r:0,q:Math.floor(x/8),p:0});c.manualPaintCellAt=(x,y)=>({x:Math.floor(x/8)+.5,y:.5});
 c.draw=()=>{c.manualPaintFrameSync();c.contourBits=Int8Array.from({length:128},(_,q)=>q%16<8?1:0);c.manualPaintLayerApply(new Uint32Array(c.img.data.buffer));};c.draw();
 const result=await c.isolatedPaintApply(1);assert.equal(result.count,1);assert.equal(result.changed,64);assert.equal(c.fillHistory.length,1);assert.equal(c.manualPaintState.source,null);assert.equal(c.manualPaintState.layer.domain,'raster');assert.equal(c.manualPaintState.layer.paint.filter(Boolean).length,64);
 const layer=c.manualPaintState.layer;c.historyStep(false);assert.equal(c.manualPaintState.layer,null);c.historyStep(true);assert.equal(c.manualPaintState.layer,layer);assert.equal((await c.isolatedPaintApply(1)).changed,0);assert.equal(c.fillHistory.length,1);
 c.RK=1;const before=c.manualPaintState;const failure=await c.isolatedPaintApply(1);assert.match(failure.error,/8 пикселей/);assert.equal(c.manualPaintState,before);assert.equal(c.fillHistory.length,1);
});

test('lazy basic semantics equal the full snapshot with parity, hidden zones, bit edits and template overrides',async()=>{
 const c=fixture({W:9,H:6,VX:1,VW:7,VH:5});c.parityVisible=(r,col)=>r%2===0||col%3!==1;c.outShow=(r,col)=>r===0&&col<3;c.fillField=c.f;c.fillKey=c.k+':flat';c.paintBits=new Int8Array(35).fill(-1);c.paintBits[12]=1;c.templateMatchLayer={key:'same',bits:new Uint8Array(54).fill(2)};c.templateMatchLayer.bits[22]=0;let keys=0;c.templateMatchKey=()=>{keys++;return 'same';};
 c.contourBits=null;const lazy=await c.window.mayVisibleSemantic.acquire({lazy:true}),full=await c.visibleSemanticSnapshotAsync();assert.equal(keys,2,'one key lookup per context, never per pixel');
 for(let y=0;y<5;y++)for(let x=0;x<7;x++){const q=y*7+x;assert.equal(lazy.readBit(x,y),full.bits[q]);assert.equal(lazy.isVisible(x,y),!!full.visibleMask[q]);assert.deepEqual(lazy.cellAt(x,y),full.cellAt(x,y));}assert.equal(lazy.bits,undefined);lazy.release();
});
test('lazy fresh GPU 4096 acquisition allocates no full mask and performs no CPU redraw',async()=>{
 const c=fixture();c.f={W:12286,H:4096,val:new Int8Array(12286*4096)};c.f.val[8*12286+4095]=1;c.VX=0;c.VW=8192;c.VH=4096;c.RK=1;c.img=null;c.contourBits=null;c.gpuBig={fresh:true,k:2,pend:[]};c.draw=()=>assert.fail('basic acquire must not render the full field');
 let allocations=0;c.Int8Array=class extends Int8Array{constructor(...args){super(...args);allocations++;}};c.Uint8Array=class extends Uint8Array{constructor(...args){super(...args);allocations++;}};
 const snap=await c.window.mayVisibleSemantic.acquire({lazy:true});assert.equal(snap.readBit(4095,8),1);assert.deepEqual(JSON.parse(JSON.stringify(snap.cellAt(4095,8))),{x:4095.5,y:8.5});assert.equal(snap.visibleMask,undefined);assert.equal(allocations,0);assert.equal(c.gpuPaintRequests,0);snap.release();
});
test('full semantic snapshot yields between blocks and cancels before publishing a changed frame',async()=>{
 const c=fixture({W:513,H:257,VX:0,VW:513,VH:257});let changed=false,yields=0;c.setTimeout=(fn)=>setTimeout(()=>{yields++;changed=true;fn();},0);const before=c.f.val.slice();
 await assert.rejects(c.visibleSemanticSnapshotAsync(()=>!changed),/поиск отменён/);assert.equal(yields,1);assert.deepEqual(c.f.val,before);
});

test('persistent modes stay pressed while waiting, then one manual stroke and its automatic result share Undo/Redo',async()=>{
 const c=fixture();c.manualPatternToggle('same');await c.manualPatternWhenIdle();assert.equal(c.st.paintSame,true);assert.equal(c.$('bPaintSame')['aria-pressed'],'true');assert.equal(c.$('bPaintSame').disabled,false);assert.match(c.$('fillInfo').textContent,/после мазка/);assert.equal(c.manualPaintState.source,null);
 const count=c.fillHistory.length;c.paint(0,0);await c.manualPatternWhenIdle();assert.equal(c.fillHistory.length,count+1);assert.equal(c.manualPaintState.patterns.same.paint.filter(Boolean).length,20);assert.equal(c.manualPaintState.source.sample.cells.length,1);
 c.historyStep(false);await c.manualPatternWhenIdle();assert.equal(c.st.paintSame,true);assert.equal(c.manualPaintState.source,null);assert.equal(c.manualPaintState.patterns,null);
 c.historyStep(true);await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.source.sample.cells.length,1);assert.equal(c.manualPaintState.patterns.same.paint.filter(Boolean).length,20);
});
test('both independent modes recompute the latest manual shape; OFF removes only its own layer',async()=>{
 const c=fixture();c.paint(0,1);c.manualPatternToggle('same');c.manualPatternToggle('mirror');await c.manualPatternWhenIdle();assert.ok(c.manualPaintState.patterns.same);assert.ok(c.manualPaintState.patterns.mirror);c.paint(1,1,'#abcdef');await c.manualPatternWhenIdle();
 const source=c.manualPaintState.source,expectedSame=await Pattern.find({width:8,height:5,data:c.f.val},source.sample),expectedMirror=await Pattern.find({width:8,height:5,data:c.f.val},source.sample,{mode:'mirror',axisX:3.5});assert.deepEqual(c.manualPaintState.patterns.same.paint,expectedSame.paint);assert.deepEqual(c.manualPaintState.patterns.mirror.paint,expectedMirror.paint);
 const manual=c.fillMask.slice();c.manualPatternToggle('same');await c.manualPatternWhenIdle();assert.equal(c.st.paintSame,false);assert.equal(c.st.paintSymmetric,true);assert.equal(c.manualPaintState.patterns.same,undefined);assert.deepEqual(c.manualPaintState.patterns.mirror.paint,expectedMirror.paint);assert.deepEqual(c.fillMask,manual);assert.equal(c.manualPaintState.source,source);
 c.historyStep(false);await c.manualPatternWhenIdle();assert.equal(c.st.paintSame,true);assert.ok(c.manualPaintState.patterns.same);c.historyStep(true);await c.manualPatternWhenIdle();assert.equal(c.st.paintSame,false);assert.equal(c.manualPaintState.patterns.same,undefined);
});
test('a second manual stroke cancels yielded search and only its combined latest result is committed',async()=>{
 const c=fixture();c.manualPatternToggle('same');await c.manualPatternWhenIdle();let enter,release;const started=new Promise(r=>enter=r),gate=new Promise(r=>release=r);let calls=0;c.MayatnikManualPaintPattern={...Pattern,async find(field,sample,options){if(++calls===1){enter();await gate;}return Pattern.find(field,sample,options);}};
 c.paint(0,0);await started;assert.equal(c.$('bPaintSame').disabled,false);assert.equal(c.$('bPaintSame')['aria-pressed'],'true');c.paint(1,0,'#abcdef');const source=c.manualPaintState.source;release();await c.manualPatternWhenIdle();assert.equal(calls,2);assert.equal(c.manualPaintState.source,source);assert.equal(source.sample.cells.length,2);assert.equal(c.fillHistory.length,3);const expected=await Pattern.find({width:8,height:5,data:c.f.val},source.sample);assert.deepEqual(c.manualPaintState.patterns.same.paint,expected.paint);
});
test('OFF during an active search remains clickable and prevents any late automatic layer',async()=>{
 const c=fixture();c.paint(0,0);let enter,release;const started=new Promise(r=>enter=r),gate=new Promise(r=>release=r);c.MayatnikManualPaintPattern={...Pattern,async find(field,sample,options){enter();await gate;return Pattern.find(field,sample,options);}};c.manualPatternToggle('same');await started;const mask=c.fillMask.slice();c.$('bPaintSame').onclick();assert.equal(c.st.paintSame,false);assert.equal(c.$('bPaintSame')['aria-pressed'],'false');release();await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.patterns,null);assert.deepEqual(c.fillMask,mask);assert.equal(c.manualPaintState.source.sample.cells.length,1);
});
test('manual erase and double-click erase update provenance and remove obsolete automatic results',async()=>{
 const c=fixture();c.manualPatternToggle('same');await c.manualPatternWhenIdle();c.paint(0,0);await c.manualPatternWhenIdle();c.paint(0,0,'#123456',false);await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.source.sample.cells.length,0);assert.equal(c.manualPaintState.patterns,null);
 c.paint(0,0);await c.manualPatternWhenIdle();assert.equal(c.eraseFillAt(.1,.1),true);await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.source.sample.cells.length,0);assert.equal(c.manualPaintState.patterns,null);c.historyStep(false);await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.source.sample.cells.length,1);assert.ok(c.manualPaintState.patterns.same);
});
test('Clear cancels in-flight automatic work; Undo restores the source and both enabled modes',async()=>{
 const c=fixture();c.paint(0,0);c.manualPatternToggle('same');c.manualPatternToggle('mirror');await c.manualPatternWhenIdle();const before=c.manualPaintState;c.$('bFillClear').onclick();await c.manualPatternWhenIdle();assert.equal(c.st.paintSame,true);assert.equal(c.st.paintSymmetric,true);assert.equal(c.manualPaintState.source,null);assert.equal(c.manualPaintState.patterns,null);c.historyStep(false);await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.source,before.source);assert.ok(c.manualPaintState.patterns.same);assert.ok(c.manualPaintState.patterns.mirror);
});
test('mode layers roundtrip with work files and flags roundtrip through settings; reset disables both',async()=>{
 const c=fixture();c.paint(0,0);c.manualPatternToggle('same');c.manualPatternToggle('mirror');await c.manualPatternWhenIdle();const Work=require('./mayatnik-work-file.js'),Settings=require('./mayatnik-settings-library.js'),Reset=require('./mayatnik-reset-state.js');const saved=await Work.decode(await Work.encode(c.manualPaintSnapshot()));const expected=c.manualPaintState.patterns.same.paint.slice();c.manualPaintClear();c.manualPaintRestore(saved.data);assert.deepEqual(c.manualPaintState.patterns.same.paint,expected);
 const preset=Settings.pick(c.st),target={};Settings.applyState(target,preset);assert.equal(target.paintSame,true);assert.equal(target.paintSymmetric,true);assert.equal(Reset.defaults().paintSame,false);assert.equal(Reset.defaults().paintSymmetric,false);
});
test('disabling pattern modes preserves an independent isolated/legacy automatic layer',async()=>{
 const c=fixture();const paint=new Uint32Array(40);paint[39]=0xff010203;c.manualPaintCommit(paint,'cells',null,c.manualPaintState);c.paint(0,0);const base=c.manualPaintState.layer;c.manualPatternToggle('same');await c.manualPatternWhenIdle();c.manualPatternToggle('same');await c.manualPatternWhenIdle();assert.equal(c.manualPaintState.layer,base);assert.equal(c.manualPaintState.layer.paint[39],0xff010203);assert.equal(c.manualPaintState.patterns,null);
});

test('visible union keeps matches unique to each mode and OFF removes only those extra cells',async()=>{
 const c=fixture({W:8,H:5,VX:0,VW:8,VH:5});c.f.val.fill(-1);for(const [q,bit]of [[1,1],[2,0],[4,0],[5,1],[18,1],[19,0]])c.f.val[q]=bit;c.draw();c.paint(1,0);c.paint(2,0,'#abcdef');c.manualPatternToggle('same');c.manualPatternToggle('mirror');await c.manualPatternWhenIdle();
 const pixels=()=>new Uint32Array(c.img.data.buffer);assert.equal(pixels()[1],0xff563412);assert.equal(pixels()[2],0xffefcdab);assert.equal(pixels()[4],0xffefcdab);assert.equal(pixels()[5],0xff563412);assert.equal(pixels()[18],0xff563412);assert.equal(pixels()[19],0xffefcdab);
 c.manualPatternToggle('same');await c.manualPatternWhenIdle();assert.equal(pixels()[18],0xff555555);assert.equal(pixels()[19],0xff555555);assert.equal(pixels()[4],0xffefcdab);assert.equal(pixels()[5],0xff563412);assert.equal(pixels()[1],0xff563412);assert.equal(pixels()[2],0xffefcdab);
 c.manualPatternToggle('mirror');await c.manualPatternWhenIdle();assert.equal(pixels()[4],0xff555555);assert.equal(pixels()[5],0xff555555);assert.equal(pixels()[1],0xff563412);assert.equal(pixels()[2],0xffefcdab);
});

function repeatFixture(){
 const c=fixture({W:4,H:1,VX:0,VW:4,VH:1});c.st.paintFrameMode='off';c.fillBase=Uint32Array.of(0xff101010,0xff202020,0xff101010,0xff202020);
 c.draw=()=>{c.manualPaintFrameSync();const px=c.fillBase.slice();if(c.fillMask)for(let i=0;i<px.length;i++)if(c.fillMask[i])px[i]=c.fillMask[i];c.manualPaintLayerApply(px);c.templatePaintApply?.(px);c.paintRepeatDraw(px);c.shown=px;};c.draw();return c;
}
test('frame repeat adopts existing paint and keeps native cells across bit/frame/owner changes; OFF preserves original paint',()=>{
 const c=repeatFixture(),bits=c.f.val.slice();c.paint(0,0);const own=c.fillMask.slice();c.$('paintFrameMode').value='colour';c.paintRepeatChange();assert.equal(c.shown[2],own[0]);assert.equal(c.paintRepeatSeed.entries[1],0x101010);
 c.$('paintFrameMode').value='off';c.paintRepeatChange();assert.equal(c.shown[0],own[0]);assert.equal(c.shown[2],c.fillBase[2]);
 c.$('paintFrameMode').value='cells';c.paintRepeatChange();const seed=c.paintRepeatSeed;c.k++;c.fillMask=null;c.f={...c.f,val:c.f.val.slice().fill(0)};c.draw();assert.equal(c.paintRepeatSeed,seed);assert.equal(c.shown[0],own[0]);assert.equal(c.shown[2],c.fillBase[2]);assert.deepEqual(bits,Int8Array.of(0,1,0,1));
});
test('repeat erasure and Clear share Undo/Redo with their seed, without touching field bits',()=>{
 const c=repeatFixture();c.st.paintFrameMode='cells';c.paint(0,0);const seed=c.paintRepeatSeed,bits=c.f.val.slice();c.k++;c.fillMask=null;c.draw();assert.ok(c.paintRepeatLayer[0]);assert.equal(c.eraseFillAt(.1,.1),true);assert.equal(c.paintRepeatSeed,null);
 c.historyStep(false);assert.equal(c.paintRepeatSeed,seed);c.historyStep(true);assert.equal(c.paintRepeatSeed,null);c.historyStep(false);c.$('bFillClear').onclick();assert.equal(c.paintRepeatSeed,null);c.historyStep(false);assert.equal(c.paintRepeatSeed,seed);assert.deepEqual(c.f.val,bits);
});
test('repeat seeds collect template/isolated raster paints and source changes discard them',()=>{
 const c=repeatFixture();c.st.paintFrameMode='colour';c.templatePaintApply=px=>{px[1]=0xffaabbcc;};c.pushHistory({indices:new Uint32Array(0),previous:new Uint32Array(0),bytes:1});c.draw();assert.equal(c.shown[3],0xffaabbcc);
 c.fieldSourceKey=()=> 'different source';c.draw();assert.equal(c.paintRepeatSeed,null);
});

test('new strokes remember visible source RGB before paint; repaint keeps the unpainted original',()=>{
 const c=repeatFixture();c.st.paintFrameMode='colour';let shown=Uint32Array.of(0xff717171,0xff202020,0xff717171,0xff202020);c.pxView=()=>({data:new Uint8ClampedArray(shown.buffer)});
 c.paint(0,0);assert.equal(c.paintRepeatSeed.entries[1],0x717171);shown=Uint32Array.of(0xff563412,0xff202020,0xff563412,0xff202020);c.paint(0,0,'#abcdef');assert.equal(c.paintRepeatSeed.entries[1],0x717171);
 c.k++;c.fillMask=null;c.fillBase=Uint32Array.of(0xff202020,0xff717171,0xff202020,0xff717171);c.draw();assert.equal(c.shown[1],0xffefcdab);assert.equal(c.shown[3],0xffefcdab);
});

test('adopting existing paint reconstructs current heat colour without advancing heat or changing semantic cells',()=>{
 const f={W:4,H:1,val:Int8Array.of(0,1,0,1)},semantic=Int8Array.of(0,1,0,1),base=Uint32Array.of(0xff101010,0xff202020,0xff101010,0xff202020);
 const c={st:{heat:true},f,geo:{anchor:1},img:{width:4,height:1},fillBase:base,contourBits:semantic,k:7,RK:1,VX:0,VW:4,VH:1,third:null,pxHide:new Set(),
  heatF:f,heatPrev:f.val.slice(),heatK:7,heatPN:0,heatRun:Uint8Array.of(1,0,0,0),heatCool:new Uint8Array(4),HEAT_N:8,HEAT_C:[0xff5bd3ff],HEAT_COOL:0xffff9b4f,
  parityField:()=>f,edgeFlowOn:()=>true,rombP:()=>-1,parityActive:()=>false,lockCell:(px,q,colour)=>{px[q]=colour;},mixPx:(colour,under,alpha)=>{const ch=s=>Math.round((colour>>>s&255)*alpha+(under>>>s&255)*(1-alpha));return (0xff000000|ch(16)<<16|ch(8)<<8|ch(0))>>>0;}};
 vm.createContext(c);vm.runInContext(fn('heatApply')+'\n'+fn('paintRepeatBase'),c);
 const first=c.paintRepeatBase(),again=c.paintRepeatBase();assert.equal(first[0],c.mixPx(c.HEAT_C[0],base[0],.85));assert.deepEqual(first,again);
 assert.equal(c.contourBits,semantic);assert.deepEqual(semantic,Int8Array.of(0,1,0,1));assert.equal(c.heatK,7);assert.deepEqual(c.heatRun,Uint8Array.of(1,0,0,0));assert.deepEqual(base,c.fillBase);
});

test('colour repeat matches the visible pixel family filter instead of hidden raw colours',()=>{
 const c=repeatFixture();c.st.paintFrameMode='colour';c.pxHide.add('hidden');c.EMPTY=[0,0,0];c.pxFam=()=> 'hidden';
 c.paintRepeatSeed={version:1,scope:c.paintRepeatScope(),domain:'cells',width:4,height:1,geometry:'',entries:Uint32Array.of(0,0,0xff123456)};
 const displayed=Uint32Array.of(0xff000000,0xff202020,0xff000000,0xff202020);c.pxView=()=>({data:new Uint8ClampedArray(displayed.buffer)});
 const raw=c.fillBase.slice();c.paintRepeatDraw(raw);assert.deepEqual([...raw],[0xff123456,0xff202020,0xff123456,0xff202020]);
 assert.deepEqual([...c.paintRepeatBase()],Array(4).fill(0xff000000));
});

test('animation reuses its overlay buffer and clears pixels that no longer belong to the seed',()=>{
 const c=repeatFixture();c.st.paintFrameMode='cells';c.paint(0,0);c.fillMask=null;c.k++;c.draw();
 const layer=c.paintRepeatLayer;c.draw();assert.equal(c.paintRepeatLayer,layer);
 c.paintRepeatSeed={...c.paintRepeatSeed,entries:Uint32Array.of(2,0x101010,0xffabcdef)};c.draw();assert.equal(c.paintRepeatLayer,layer);
 assert.equal(layer[0],0);assert.equal(layer[2],0xffabcdef);assert.equal(c.shown[0],c.fillBase[0]);
});

test('latched isolated bits repaint each shown frame without stopping transport, writing history or carrying old masks',async()=>{
 const c=fixture({W:8,H:1,VX:0,VW:8,VH:1}),api=c.window.mayIsolatedPaint,base=c.draw,hex='#123456',paint=c.rgba([18,52,86]);
 Object.assign(c,{ZL:[],queueSession(){},hexRGB:value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16))});
 c.draw=()=>{base();if(c.st.paintIsolated0||c.st.paintIsolated1)c.isolatedLivePaint(new Uint32Array(c.img.data.buffer));};
 const set=(values)=>c.f.val.set(values),pixels=()=>Array.from(new Uint32Array(c.img.data.buffer)),selected=()=>pixels().flatMap((v,i)=>v===paint?[i]:[]);
 set([1,-1,1,1,0,-1,0,0]);c.playing=true;c.$('fillColour').value=hex;
 c.$('bPaintIsolated1').onclick();await api.whenIdle();assert.equal(api.get(1),true);assert.equal(c.$('bPaintIsolated1')['aria-pressed'],'true');assert.equal(c.playing,true);assert.deepEqual(selected(),[0]);
 c.$('bPaintIsolated0').onclick();await api.whenIdle();assert.deepEqual(selected(),[0,4]);assert.equal(c.$('bPaintIsolated0')['aria-pressed'],'true');
 c.k++;set([1,1,-1,0,0,-1,1,0]);c.draw();assert.equal(c.isolatedFrameWait(),true);await api.whenIdle();assert.deepEqual(selected(),[6,7]);assert.equal(c.isolatedFrameWait(),false);
 const original=c.f.val.slice();c.$('bPaintIsolated1').onclick();await api.whenIdle();assert.deepEqual(selected(),[7]);assert.equal(c.playing,true);
 c.$('fillColour').value='#abcdef';c.draw();assert.equal(pixels()[7],c.rgba([171,205,239]));assert.equal(c.fillHistory.length,0);
 c.$('bPaintIsolated0').onclick();assert.equal(api.get(0),false);assert.equal(c.$('bPaintIsolated0')['aria-pressed'],'false');assert.deepEqual(c.f.val,original);
 assert.equal(c.manualPaintState.layer,null);assert.equal(c.fillMask,null);
});

test('a slow isolated scan cannot publish an old mask after a manual frame jump or disabling its latch',async()=>{
 const c=fixture({W:4,H:1,VX:0,VW:4,VH:1}),base=c.draw,api=c.window.mayIsolatedPaint,engine=c.MayatnikIsolatedBits;
 Object.assign(c,{ZL:[],queueSession(){},hexRGB:s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16))});
 c.draw=()=>{base();if(c.st.paintIsolated1)c.isolatedLivePaint(new Uint32Array(c.img.data.buffer));};
 let release,started;const paused=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 let first=true;c.MayatnikIsolatedBits={...engine,async findGrid(field,options){if(first){first=false;started();await gate;}return engine.findGrid(field,options);}};
 c.f.val.set([1,-1,-1,-1]);c.$('bPaintIsolated1').onclick();await paused;
 c.k++;c.f.val.set([-1,-1,-1,1]);c.draw();await api.whenIdle();const colour=c.rgba([18,52,86]);
 assert.equal(c.isolatedPixel(0),0);assert.equal(c.isolatedPixel(3),colour);
 c.$('bPaintIsolated1').onclick();release();await new Promise(r=>setTimeout(r,0));
 assert.equal(c.isolatedPixel(3),0);assert.equal(c.fillHistory.length,0);assert.equal(c.manualPaintState.layer,null);
});
